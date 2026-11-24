import { GoogleGenAI, Type } from '@google/genai'
import { createAdminClient } from '@/lib/supabase/admin'
import { runTool, type BotUser } from './tools'

/**
 * In-app assistant pipeline:
 *   CRM user (from session) → history → Gemini w/ tools → reply
 */

// Model selection: ask the API what this key can call (ListModels), prefer
// flash-class, then verify by generation — candidates that reject with
// model-not-found are skipped. The winner is cached per server instance.
// GEMINI_MODEL pins one explicitly if set.
const PREFERRED = [
  'gemini-3.5-flash-lite',
  'gemini-2.5-flash-lite',
  'gemini-3-flash-preview',
  'gemini-2.5-flash',
  'gemini-2.0-flash',
  'gemini-2.5-pro',
  'gemini-3-pro-preview',
]
const STATIC_FALLBACK = ['gemini-3.5-flash-lite', 'gemini-2.5-flash-lite', 'gemini-2.0-flash']
let resolvedModel: string | null = null
let listedModels: string[] | null = null

const isModelGone = (e: any) => /not found|no longer|does not exist|not supported/i.test(e?.message || '')
// A model under load (503) should also yield to the next candidate.
const isModelBusy = (e: any) => e?.status === 503 || /high demand|unavailable|overloaded/i.test(e?.message || '')

async function modelCandidates(): Promise<string[]> {
  try {
    const pager = await ai.models.list({ config: { pageSize: 200 } })
    listedModels = ((pager.page || []) as any[])
      .filter(m => {
        const actions = m.supportedActions ?? m.supportedGenerationMethods
        return !actions || actions.includes('generateContent')
      })
      .map(m => (m.name || '').replace(/^models\//, ''))
      .filter(Boolean)
  } catch { listedModels = null }

  const listed = listedModels || []
  return [...new Set([
    process.env.GEMINI_MODEL,
    ...PREFERRED.filter(p => listed.includes(p)),
    ...listed.filter(n => n.startsWith('gemini')),
    ...STATIC_FALLBACK,
  ].filter((m): m is string => !!m))]
}

async function generate(contents: any[], systemInstruction: string): Promise<{ res: any; calls: number }> {
  const order = resolvedModel ? [resolvedModel, ...(await modelCandidates()).filter(m => m !== resolvedModel)] : await modelCandidates()
  let lastErr: any
  let calls = 0
  for (const model of order) {
    try {
      calls++
      const res = await ai.models.generateContent({
        model,
        contents,
        config: { systemInstruction, tools: [{ functionDeclarations: FUNCTION_DECLARATIONS as any }] },
      })
      resolvedModel = model
      return { res, calls }
    } catch (e: any) {
      if (!isModelGone(e) && !isModelBusy(e)) throw e
      lastErr = e
    }
  }
  if (listedModels?.length) lastErr = new Error(`Models available to this key: ${listedModels.join(', ')}`)
  throw Object.assign(lastErr, { apiCalls: calls })
}

const SYSTEM_PROMPT = `You are the Nexus CRM assistant, chatting inside the CRM app with staff of a legal-services company.

The CRM organises work into CASES (identified by a code like C0000582 and a client name). Each case moves through workflow STEPS. Key concepts:
- Step feed: every step has a chat-like feed of messages and thin event lines.
- Requests: a user highlights their own message(s) on a step as a formal request to the other party (CSR ↔ legal). The assignee answers; the requester then marks it seen before requesting again. A request waiting over 24h is "late". Board tasks appear in the same queue.
- Actions: personal reminders with a due date, set on a case. Late = past due. A case is "neglected" when it has zero open actions.
- Notifications: informational alerts (new requests, answers, deadlines) the user receives; they can be marked as read.
- Eligibility: presale confirmation steps.

Rules:
- You act as the signed-in user — be concise, plain text, no markdown except links.
- Linkify case and client mentions with [label](/path): name-first like [Damjann Test (C0000586)](/cases/C0000586) — always put the client name first with the code in brackets, never the bare code alone; clients need their id like [Milana Novak](/clients/<uuid>). Only linkify on first mention. When the topic is requests, messages, or actions on a case, link straight to its feed like [Damjann Test (C0000586)](/cases/C0000586/progress); for billing/money topics use /cases/<code>/billing instead.
- For multi-part requests (e.g. create a client, then a case, then messages) work through them in order with tool calls; only stop to ask when something is genuinely ambiguous.
- New clients/cases: create_client makes the person; create_case needs an existing client, optionally a service and a lawyer. Messages and requests go to the case's current step.
- For write actions (messages, requests, answers, actions, cancellations), just do them — the user asked you to.
- Follow counts and specifics literally: if they ask for N messages, send exactly N — no extra "initiated" or filler messages they didn't request. A request counts as one of the messages.
- Each day is a fresh session — you only see today's chat. For anything from earlier days use read_session; say "let me check" rather than guessing what was discussed.
- If a case reference is ambiguous, ask which one.
- If the user asks for something the tools can't do, say so briefly.
- Answer in the language the user writes in.`

const FUNCTION_DECLARATIONS = [
  {
    name: 'list_requests',
    description: "The user's request queue, bucketed: to_answer (each flagged late if waiting >24h), answered_awaiting_seen, and board tasks assigned to them.",
    parameters: { type: Type.OBJECT, properties: {}, required: [] },
  },
  {
    name: 'list_actions',
    description: "The user's open action reminders bucketed into late / upcoming / undated, plus neglected_cases (their cases with zero open actions).",
    parameters: { type: Type.OBJECT, properties: {}, required: [] },
  },
  {
    name: 'list_notifications',
    description: "List the user's most recent notifications with an unread count — new requests, answers, deadlines, notes.",
    parameters: { type: Type.OBJECT, properties: {}, required: [] },
  },
  {
    name: 'mark_notifications_read',
    description: 'Mark all of the user\'s notifications as read.',
    parameters: { type: Type.OBJECT, properties: {}, required: [] },
  },
  {
    name: 'create_client',
    description: 'Create a new client record from a full name (split into first/last automatically), with optional email and phone.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        name: { type: Type.STRING, description: 'Full name, e.g. "John Smith"' },
        email: { type: Type.STRING },
        phone: { type: Type.STRING },
      },
      required: ['name'],
    },
  },
  {
    name: 'create_case',
    description: 'Create a new case for an existing client. Optionally attach a service by name fragment (e.g. "TRC") and assign a lawyer by name. If the client is unknown, create them first with create_client.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        client: { type: Type.STRING, description: 'Client name' },
        service: { type: Type.STRING, description: 'Service name fragment' },
        lawyer: { type: Type.STRING, description: 'Name of the team member to assign as lawyer' },
      },
      required: ['client'],
    },
  },
  {
    name: 'assign_case',
    description: "Assign or reassign the lawyer (or CSR with role='csr') on an existing case. The new assignee gets a notification.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        case: { type: Type.STRING },
        user: { type: Type.STRING, description: 'Team member name or email' },
        role: { type: Type.STRING, description: "'lawyer' (default) or 'csr'" },
      },
      required: ['case', 'user'],
    },
  },
  {
    name: 'find_client',
    description: 'Look up a client by name or email — returns their phone numbers, email, and case codes.',
    parameters: {
      type: Type.OBJECT,
      properties: { name: { type: Type.STRING, description: 'Client name or email fragment' } },
      required: ['name'],
    },
  },
  {
    name: 'list_cases',
    description: 'List the most recent cases with code, client name, and current step.',
    parameters: { type: Type.OBJECT, properties: {}, required: [] },
  },
  {
    name: 'get_case',
    description: 'Get a case overview: client, current step, live request count, open actions.',
    parameters: {
      type: Type.OBJECT,
      properties: { case: { type: Type.STRING, description: 'Case code (e.g. C0000582) or client name' } },
      required: ['case'],
    },
  },
  {
    name: 'read_feed',
    description: 'Read recent messages/events from a case feed (newest first). Optionally filter to a step name.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        case: { type: Type.STRING },
        step: { type: Type.STRING, description: 'Optional step name to filter by' },
        limit: { type: Type.NUMBER, description: 'Max items, default 15' },
      },
      required: ['case'],
    },
  },
  {
    name: 'send_message',
    description: 'Post a message to the case current step feed as the user.',
    parameters: {
      type: Type.OBJECT,
      properties: { case: { type: Type.STRING }, text: { type: Type.STRING } },
      required: ['case', 'text'],
    },
  },
  {
    name: 'send_request',
    description: 'Send a formal request on the case current step. The text becomes a highlighted question message. Fails if the user already has an open/unseen request on that step.',
    parameters: {
      type: Type.OBJECT,
      properties: { case: { type: Type.STRING }, text: { type: Type.STRING } },
      required: ['case', 'text'],
    },
  },
  {
    name: 'answer_request',
    description: 'Answer the open request addressed to the user on a case. The text becomes a highlighted answer message.',
    parameters: {
      type: Type.OBJECT,
      properties: { case: { type: Type.STRING }, text: { type: Type.STRING } },
      required: ['case', 'text'],
    },
  },
  {
    name: 'mark_request_seen',
    description: "Mark the answered request on a case as seen, clearing it from the user's queue.",
    parameters: {
      type: Type.OBJECT,
      properties: { case: { type: Type.STRING } },
      required: ['case'],
    },
  },
  {
    name: 'attach_files',
    description: 'Attach the user\'s staged file(s) to a case — moves them into the case files and posts a feed note. The staged names are listed in the system context when present.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        case: { type: Type.STRING },
        file: { type: Type.STRING, description: 'Optional: only attach the staged file matching this name' },
      },
      required: ['case'],
    },
  },
  {
    name: 'cancel_request',
    description: "Cancel the user's own open (unanswered) request on a case.",
    parameters: {
      type: Type.OBJECT,
      properties: { case: { type: Type.STRING } },
      required: ['case'],
    },
  },
  {
    name: 'set_action',
    description: 'Set a personal action reminder on a case with a due date.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        case: { type: Type.STRING },
        text: { type: Type.STRING, description: 'What to do' },
        due_date: { type: Type.STRING, description: 'YYYY-MM-DD' },
      },
      required: ['case', 'text', 'due_date'],
    },
  },
  {
    name: 'complete_action',
    description: 'Mark one of the user\'s open actions as done. Optionally narrow by case and/or text match.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        case: { type: Type.STRING },
        text: { type: Type.STRING, description: 'Part of the action text to match' },
      },
      required: [],
    },
  },
  {
    name: 'read_session',
    description: 'Read back a past day\'s chat session with this user — for "what did we discuss on Friday" questions. Each day resets, so older chats only exist here.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        date: { type: Type.STRING, description: 'YYYY-MM-DD, "today" or "yesterday"' },
      },
      required: ['date'],
    },
  },
]

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! })

/** Transcribe a voice message through the resolved model — no tools. */
export async function transcribeAudio(mimeType: string, base64: string): Promise<{ text: string; calls: number; tokens: number }> {
  const { res, calls } = await generate(
    [{
      role: 'user',
      parts: [
        { inlineData: { mimeType, data: base64 } },
        { text: 'Transcribe this voice message verbatim, in the language spoken. Output only the transcript — no quotes, no labels.' },
      ],
    }],
    'You transcribe voice messages verbatim.',
  )
  return { text: (res.text || '').trim(), calls, tokens: res.usageMetadata?.totalTokenCount ?? 0 }
}

/** One assistant turn: history + user text → Gemini w/ tools → reply. */
export async function runBotTurn(user: BotUser, text: string, sinceIso?: string, opts?: { audioPath?: string; extraCalls?: number; extraTokens?: number; tzOffset?: number }): Promise<string> {
  const supabase = createAdminClient()

  let historyQ = supabase
    .from('bot_messages')
    .select('role, text')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(14)
  // Sessions reset daily — the model only sees today's messages.
  if (sinceIso) historyQ = historyQ.gte('created_at', sinceIso)
  const { data: history } = await historyQ

  const { data: pend } = await supabase
    .from('bot_pending_files').select('name').eq('user_id', user.id)

  const contents: any[] = (history || []).reverse().map(m => ({ role: m.role, parts: [{ text: m.text }] }))
  contents.push({ role: 'user', parts: [{ text }] })

  let reply = ''
  let tokens = 0
  let apiCalls = 0
  try {
    let emptyRetries = 0
    for (let i = 0; i < 8; i++) {
      const { res, calls } = await generate(
        contents,
        `${SYSTEM_PROMPT}\n\nYou are talking to ${user.display_name || user.email}. Today is ${new Date().toDateString()}.` +
        (pend?.length ? `\nThe user staged files to attach: ${pend.map((p: any) => p.name).join(', ')} — call attach_files once they say (or you can infer) which case.` : ''),
      )
      apiCalls += calls
      tokens += res.usageMetadata?.totalTokenCount ?? 0

      const fnCalls = res.functionCalls
      if (fnCalls && fnCalls.length) {
        contents.push(res.candidates?.[0]?.content ?? { role: 'model', parts: fnCalls.map((c: any) => ({ functionCall: c })) })
        const parts = await Promise.all(fnCalls.map(async (call: any) => ({
          functionResponse: {
            name: call.name,
            response: { result: await runTool(supabase, user, call.name!, call.args ?? {}, { tzOffset: opts?.tzOffset }).catch((e: Error) => ({ error: e.message })) },
          },
        })))
        contents.push({ role: 'user', parts })
        continue
      }

      reply = res.text || ''
      // Gemini occasionally returns an empty candidate — retry the turn a
      // couple of times before giving up.
      if (reply || ++emptyRetries >= 3) break
    }
  } catch (e: any) {
    apiCalls += e?.apiCalls ?? 0
    const msg = e?.message || ''
    reply = e?.status === 429 || /quota|rate.?limit|RESOURCE_EXHAUSTED/i.test(msg)
      ? "I'm out of Gemini quota for now — the free tier caps requests per minute/day. Give it a minute and try again."
      : isModelBusy(e)
        ? 'Gemini is under heavy load right now — give it a moment and try again.'
        : `Something broke on my side (${msg.slice(0, 300) || 'unknown error'}). Try again in a moment.`
  }
  if (!reply) reply = 'I got nothing back — try rephrasing?'

  await supabase.from('bot_messages').insert([
    { user_id: user.id, role: 'user', text, audio_path: opts?.audioPath ?? null },
    {
      user_id: user.id, role: 'model', text: reply.slice(0, 2000),
      tokens: tokens + (opts?.extraTokens ?? 0),
      calls: apiCalls + (opts?.extraCalls ?? 0),
    },
  ]).then(() => {}, () => {})

  return reply
}

/** Recent conversation for rendering the chat on load. */
export async function getBotHistory(userId: string, sinceIso?: string, limit = 40, before?: string) {
  const supabase = createAdminClient()
  let q = supabase
    .from('bot_messages')
    .select('role, text, created_at, audio_path')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit)
  if (sinceIso) q = q.gte('created_at', sinceIso)
  if (before) q = q.lt('created_at', before)
  const { data } = await q
  return (data || []).reverse() as { role: string; text: string; created_at: string; audio_path: string | null }[]
}
