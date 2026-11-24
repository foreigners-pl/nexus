import { GoogleGenAI, Type } from '@google/genai'
import { createAdminClient } from '@/lib/supabase/admin'
import { runTool, type BotUser } from './tools'

/**
 * Messenger bot pipeline:
 *   psid → CRM user (link code if unknown) → history → Gemini w/ tools → reply
 */

const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-flash'
const PAGE_TOKEN = process.env.META_PAGE_TOKEN!
const GRAPH = 'https://graph.facebook.com/v21.0'

const SYSTEM_PROMPT = `You are the Nexus CRM assistant on Facebook Messenger, talking to staff of a legal-services company.

The CRM organises work into CASES (identified by a code like C0000582 and a client name). Each case moves through workflow STEPS. Key concepts:
- Step feed: every step has a chat-like feed of messages and thin event lines.
- Requests: a user highlights their own message(s) on a step as a formal request to the other party (CSR ↔ legal). The assignee answers; the requester then marks it seen before requesting again.
- Actions: personal reminders with a due date, set on a case.
- Eligibility: presale confirmation steps.

Rules:
- You act as the linked user — be concise, plain text only (Messenger), no markdown.
- For write actions (messages, requests, answers, actions, cancellations), just do them — the user asked you to.
- If a case reference is ambiguous, ask which one.
- If the user asks for something the tools can't do, say so briefly.
- Answer in the language the user writes in.`

const FUNCTION_DECLARATIONS = [
  {
    name: 'list_requests',
    description: "List the user's pending requests: ones they must answer, and answered ones they must mark as seen.",
    parameters: { type: Type.OBJECT, properties: {}, required: [] },
  },
  {
    name: 'list_actions',
    description: "List the user's open action reminders across cases.",
    parameters: { type: Type.OBJECT, properties: {}, required: [] },
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
]

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! })

export async function sendMessenger(psid: string, text: string) {
  // Messenger caps messages at ~2000 chars — split on newlines if needed
  const chunks = text.match(/[\s\S]{1,1900}/g) || ['…']
  for (const chunk of chunks) {
    await fetch(`${GRAPH}/me/messages?access_token=${PAGE_TOKEN}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ recipient: { id: psid }, message: { text: chunk } }),
    }).catch(() => {})
  }
}

export async function sendTyping(psid: string) {
  await fetch(`${GRAPH}/me/messages?access_token=${PAGE_TOKEN}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ recipient: { id: psid }, sender_action: 'typing_on' }),
  }).catch(() => {})
}

/** Entry point for one incoming Messenger text message. */
export async function handleMessengerMessage(psid: string, text: string) {
  const supabase = createAdminClient()

  const { data: user } = await supabase
    .from('users')
    .select('id, display_name, email')
    .eq('messenger_psid', psid)
    .maybeSingle() as { data: BotUser | null }

  if (!user) {
    // Link flow: a code from Settings → Messenger (6 chars, valid 15 min)
    const code = text.trim().toUpperCase()
    if (/^[A-Z0-9]{6}$/.test(code)) {
      const cutoff = new Date(Date.now() - 15 * 60 * 1000).toISOString()
      const { data: match } = await supabase
        .from('users')
        .select('id, display_name, email')
        .eq('messenger_code', code)
        .gt('messenger_code_at', cutoff)
        .maybeSingle() as { data: BotUser | null }
      if (match) {
        await supabase.from('users').update({ messenger_psid: psid, messenger_code: null, messenger_code_at: null }).eq('id', match.id)
        await sendMessenger(psid, `Linked — you're ${match.display_name || match.email}. Ask me anything: your requests, cases, actions, or tell me to post something.`)
        return
      }
    }
    await sendMessenger(psid, 'Hi! This is the Nexus CRM bot. To link your account: open the CRM → Settings → Messenger bot → Generate code, then send me the 6-character code.')
    return
  }

  await sendTyping(psid)

  // Recent history for context (kept short — Messenger chats are shallow)
  const { data: history } = await supabase
    .from('bot_messages')
    .select('role, text')
    .eq('psid', psid)
    .order('created_at', { ascending: false })
    .limit(14)
  const contents: any[] = (history || []).reverse().map(m => ({ role: m.role, parts: [{ text: m.text }] }))
  contents.push({ role: 'user', parts: [{ text }] })

  let reply = ''
  try {
    for (let i = 0; i < 8; i++) {
      const res = await ai.models.generateContent({
        model: GEMINI_MODEL,
        contents,
        config: {
          systemInstruction: `${SYSTEM_PROMPT}\n\nYou are talking to ${user.display_name || user.email}. Today is ${new Date().toDateString()}.`,
          tools: [{ functionDeclarations: FUNCTION_DECLARATIONS as any }],
        },
      })

      const calls = res.functionCalls
      if (calls && calls.length) {
        contents.push(res.candidates?.[0]?.content ?? { role: 'model', parts: calls.map(c => ({ functionCall: c })) })
        const parts = await Promise.all(calls.map(async call => ({
          functionResponse: {
            name: call.name,
            response: { result: await runTool(supabase, user, call.name!, call.args ?? {}).catch((e: Error) => ({ error: e.message })) },
          },
        })))
        contents.push({ role: 'user', parts })
        continue
      }

      reply = res.text || ''
      break
    }
  } catch (e: any) {
    reply = `Something broke on my side (${e.message?.slice(0, 80) || 'unknown error'}). Try again in a moment.`
  }
  if (!reply) reply = 'I got nothing back — try rephrasing?'

  await sendMessenger(psid, reply)

  // Persist the turn (best-effort)
  await supabase.from('bot_messages').insert([
    { psid, role: 'user', text },
    { psid, role: 'model', text: reply.slice(0, 2000) },
  ]).then(() => {}, () => {})
}
