'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { getAccess, canMirror, type Access } from '@/lib/access'
import { runTool, type BotUser } from '@/lib/bot/tools'
import { sendPushToUsers } from '@/app/actions/push'

type Target = BotUser & { role_name: string | null }

/** Mirror permission for a specific target — final boss mirrors anyone,
 *  managers only their reportees. */
async function mirrorAccess(userId: string): Promise<{ access: Access; target: Target } | null> {
  if (!/^[0-9a-f-]{36}$/i.test(userId)) return null
  const access = await getAccess()
  if (!access || !canMirror(access, userId)) return null
  const admin = createAdminClient()
  const { data } = await admin
    .from('users')
    .select('id, display_name, email, role:roles(name)')
    .eq('id', userId)
    .single()
  if (!data) return null
  return {
    access,
    target: {
      id: data.id,
      display_name: data.display_name,
      email: (data as any).email ?? '',
      role_name: (data as any).role?.name ?? null,
    },
  }
}

export async function getViewAsUser(userId: string): Promise<{ id: string; name: string; role: string | null } | null> {
  const m = await mirrorAccess(userId)
  if (!m) return null
  const t = m.target
  return { id: t.id, name: t.display_name || t.email, role: t.role_name }
}

/** Requests-page data for the target — the same three collections
 *  RequestsContent renders (board tasks, live queries, answer history). */
export async function getViewAsRequests(userId: string) {
  const m = await mirrorAccess(userId)
  if (!m) return null
  const t = m.target
  const supabase = createAdminClient()

  // Board tasks — mirrors fetchMyOpenTasks: assigned cards not in a final column.
  const { data: assigns } = await supabase.from('card_assignees').select('card_id').eq('user_id', t.id)
  let tasks: any[] = []
  if (assigns?.length) {
    const { data: cards } = await supabase
      .from('cards')
      .select('id, title, description, due_date, created_at, board_id, status_id, boards(id, name), board_statuses(id, name, color, position)')
      .in('id', assigns.map((a: any) => a.card_id))
      .order('due_date', { ascending: true, nullsFirst: false })
    const boardIds = [...new Set((cards || []).map((c: any) => c.board_id))]
    const { data: statuses } = boardIds.length
      ? await supabase.from('board_statuses').select('id, board_id, position').in('board_id', boardIds)
      : { data: [] }
    const maxPos = new Map<string, number>()
    for (const s of statuses || []) {
      const prev = maxPos.get(s.board_id)
      if (prev === undefined || (s.position ?? 0) > prev) maxPos.set(s.board_id, s.position ?? 0)
    }
    const finalIds = new Set((statuses || []).filter((s: any) => (s.position ?? 0) === maxPos.get(s.board_id)).map((s: any) => s.id))
    tasks = (cards || []).filter((c: any) => !finalIds.has(c.status_id)).map((c: any) => ({
      ...c,
      boards: Array.isArray(c.boards) ? c.boards[0] || null : c.boards,
      board_statuses: Array.isArray(c.board_statuses) ? c.board_statuses[0] || null : c.board_statuses,
    }))
  }

  // Live requests — mirrors getMyQueries, needs_me judged against the target.
  const { data: qData } = await supabase
    .from('case_queries')
    .select('id, case_id, step_id, status, direction, created_at, answered_at, seen_at, opened_by, assigned_to, case_steps(name), cases(case_code, clients(first_name, last_name))')
    .or(`and(assigned_to.eq.${t.id},status.eq.open),and(opened_by.eq.${t.id},status.eq.answered,seen_at.is.null)`)
    .order('created_at', { ascending: false })
  const qids = (qData || []).map((q: any) => q.id)
  const { data: qEntries } = qids.length
    ? await supabase.from('case_entries').select('id, query_id, body').in('query_id', qids).eq('request_part', 'question')
    : { data: [] }
  const entryByQuery = new Map((qEntries || []).map((e: any) => [e.query_id, e]))
  const clientOf = (c: any) => c?.clients ? [c.clients.first_name, c.clients.last_name].filter(Boolean).join(' ') : null
  const queries = (qData || []).map((q: any) => ({
    id: q.id,
    case_id: q.case_id,
    entry_id: entryByQuery.get(q.id)?.id ?? null,
    step_id: q.step_id ?? null,
    status: q.status,
    direction: q.direction,
    created_at: q.created_at,
    answered_at: q.answered_at ?? null,
    pending_since: q.status === 'answered' ? (q.answered_at ?? q.created_at) : q.created_at,
    needs_me: (q.assigned_to === t.id && q.status === 'open' ? 'respond' : 'seen') as 'respond' | 'seen',
    preview: entryByQuery.get(q.id)?.body ?? null,
    case_code: q.cases?.case_code ?? null,
    client_name: clientOf(q.cases),
    step_name: q.case_steps?.name ?? null,
  }))

  // Answered history — mirrors getMyAnsweredHistory(10).
  const { data: hData } = await supabase
    .from('case_queries')
    .select('id, case_id, step_id, status, created_at, answered_at, seen_at, case_steps(name), cases(case_code, clients(first_name, last_name))')
    .eq('opened_by', t.id)
    .in('status', ['answered', 'closed'])
    .not('answered_at', 'is', null)
    .order('answered_at', { ascending: false })
    .limit(10)
  const history = (hData || []).map((q: any) => ({
    id: q.id,
    case_id: q.case_id,
    step_id: q.step_id ?? null,
    status: q.status,
    answered_at: q.answered_at ?? null,
    seen_at: q.seen_at ?? null,
    case_code: q.cases?.case_code ?? null,
    client_name: clientOf(q.cases),
    step_name: q.case_steps?.name ?? null,
  }))

  return { tasks, queries, history }
}

/** Actions-page data for the target — open actions + neglected cases,
 *  identical to ActionsContent's fetch pair. */
export async function getViewAsActionsData(userId: string) {
  const m = await mirrorAccess(userId)
  if (!m) return null
  const t = m.target
  const supabase = createAdminClient()
  const clientOf = (c: any) => c?.clients ? [c.clients.first_name, c.clients.last_name].filter(Boolean).join(' ') : null

  const { data } = await supabase
    .from('case_entries')
    .select('id, body, due_date, waiting_on, case_id, step_id, cases!inner(case_code, clients(first_name, last_name))')
    .eq('kind', 'action')
    .eq('created_by', t.id)
    .is('completed_at', null)
    .order('due_date', { ascending: true, nullsFirst: false })
  const actions = (data || []).map((a: any) => ({
    id: a.id,
    body: a.body,
    due_date: a.due_date,
    waiting_on: a.waiting_on,
    case_id: a.case_id,
    step_id: a.step_id ?? null,
    case_code: a.cases?.case_code ?? null,
    client_name: clientOf(a.cases),
  }))

  const { data: rows } = await supabase
    .from('cases')
    .select('id, case_code, status:status_id(name), step:case_steps!cases_current_step_id_fkey(name, step_type), clients(first_name, last_name)')
    .or(`assigned_to.eq.${t.id},csr_id.eq.${t.id}`)
  const eligible = (rows || []).filter((c: any) =>
    c.step && c.step.step_type !== 'eligibility' && c.step.step_type !== 'presale' &&
    !(c.status?.name || '').toLowerCase().startsWith('complet'))
  let missing: any[] = []
  if (eligible.length) {
    const { data: open } = await supabase
      .from('case_entries')
      .select('case_id')
      .eq('kind', 'action')
      .is('completed_at', null)
      .in('case_id', eligible.map((c: any) => c.id))
    const has = new Set((open || []).map((r: any) => r.case_id))
    missing = eligible.filter((c: any) => !has.has(c.id)).map((c: any) => ({
      case_id: c.id,
      case_code: c.case_code ?? null,
      client_name: clientOf(c),
      step_name: c.step?.name ?? null,
    }))
  }

  return { actions, missing }
}

/** Recent clients approximation — the real list lives in device-local
 *  storage, so the mirror shows the clients of the target's most recently
 *  active cases instead. */
export async function getViewAsRecentClients(userId: string): Promise<{ clients: { id: string; name: string; viewed_at: number }[] }> {
  const m = await mirrorAccess(userId)
  if (!m) return { clients: [] }
  const t = m.target
  const supabase = createAdminClient()

  const { data: rows } = await supabase
    .from('cases')
    .select('id, client_id, clients(first_name, last_name)')
    .or(`assigned_to.eq.${t.id},csr_id.eq.${t.id}`)
  if (!rows?.length) return { clients: [] }

  const { data: acts } = await supabase
    .from('case_entries')
    .select('case_id, created_at')
    .in('case_id', rows.map((r: any) => r.id))
    .order('created_at', { ascending: false })
  const latest = new Map<string, string>()
  for (const a of acts || []) {
    if (!latest.has(a.case_id)) latest.set(a.case_id, a.created_at)
  }

  const seen = new Set<string>()
  const clients = [...rows]
    .sort((a: any, b: any) => (latest.get(b.id) ?? '').localeCompare(latest.get(a.id) ?? ''))
    .map((r: any) => {
      const c = Array.isArray(r.clients) ? r.clients[0] : r.clients
      return c ? {
        id: c.id ?? r.client_id,
        name: [c.first_name, c.last_name].filter(Boolean).join(' '),
        viewed_at: new Date(latest.get(r.id) ?? 0).getTime(),
      } : null
    })
    .filter((c): c is { id: string; name: string; viewed_at: number } => !!c?.id && !!c.name && !seen.has(c.id) && !!seen.add(c.id))
    .slice(0, 10)

  return { clients }
}

/** YYYY-MM-DD of a timestamp in the viewer's local timezone. */
function localDateKey(iso: string, offsetMinutes: number): string {
  return new Date(new Date(iso).getTime() - offsetMinutes * 60000).toISOString().slice(0, 10)
}

/** The target's assistant sessions — one per local day, newest first. */
export async function getViewAsSessions(userId: string, tzOffset = 0): Promise<{ sessions: { date: string; count: number; tokens: number }[] }> {
  const m = await mirrorAccess(userId)
  if (!m) return { sessions: [] }
  const t = m.target
  const admin = createAdminClient()
  const { data } = await admin
    .from('bot_messages')
    .select('created_at, tokens')
    .eq('user_id', t.id)
    .order('created_at', { ascending: false })
    .limit(2000)
  const byDay = new Map<string, { count: number; tokens: number }>()
  for (const m of data || []) {
    const key = localDateKey(m.created_at, tzOffset)
    const day = byDay.get(key) || { count: 0, tokens: 0 }
    day.count++
    day.tokens += m.tokens ?? 0
    byDay.set(key, day)
  }
  return { sessions: [...byDay.entries()].map(([date, v]) => ({ date, ...v })) }
}

/** One of the target's sessions, oldest first — read-only transcript. */
export async function getViewAsSession(userId: string, date: string, tzOffset = 0, opts?: { limit?: number; before?: string }): Promise<{ messages: { role: string; text: string; created_at: string; audio_path: string | null }[] }> {
  const m = await mirrorAccess(userId)
  if (!m || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return { messages: [] }
  const t = m.target
  const admin = createAdminClient()
  const { data } = await admin
    .from('bot_messages')
    .select('role, text, created_at, audio_path')
    .eq('user_id', t.id)
    .order('created_at', { ascending: false })
    .limit(500)
  let msgs = (data || []).filter(m => localDateKey(m.created_at, tzOffset) === date)
  if (opts?.before) msgs = msgs.filter(m => m.created_at < opts.before!)
  if (opts?.limit) msgs = msgs.slice(0, opts.limit)
  return { messages: msgs.reverse() }
}

/** Playback URL for a voice message owned by the target user. */
export async function getViewAsAudioUrl(userId: string, path: string): Promise<{ url?: string; error?: string }> {
  if (!await mirrorAccess(userId)) return { error: 'No access' }
  if (!path.startsWith(`staging/${userId}/`)) return { error: 'Invalid audio' }
  const admin = createAdminClient()
  const { data, error } = await admin.storage.from('case_attachments').createSignedUrl(path, 3600)
  return error || !data ? { error: 'No audio' } : { url: data.signedUrl }
}

/** Viewer taps "Nudge" — the assistant drops a queue summary into the
 *  member's chat and pings them, as if the member had been reminded. */
export async function nudgeUser(userId: string): Promise<{ ok?: boolean; summary?: string; error?: string }> {
  const m = await mirrorAccess(userId)
  if (!m) return { error: 'No access' }
  const { access, target: t } = m
  const supabase = createAdminClient()

  const [req, act] = await Promise.all([
    runTool(supabase, t, 'list_requests', {}),
    runTool(supabase, t, 'list_actions', {}),
  ])
  const toAnswer = (req?.to_answer || []) as any[]
  const lateReq = toAnswer.filter(q => q.late).length
  const newReq = toAnswer.length - lateReq
  const review = (req?.answered_awaiting_seen || []).length
  const tasks = (req?.tasks || []).length
  const lateAct = (act?.late || []).length
  const upcoming = (act?.upcoming || []).length
  const undated = (act?.undated || []).length
  const neglected = (act?.neglected_cases || []).length
  const total = newReq + lateReq + review + tasks + lateAct + upcoming + undated + neglected
  if (!total) return { error: `${t.display_name} is all clear — nothing to nudge about` }

  const n = (x: number, s: string, p?: string) => x ? `${x} ${x === 1 ? s : (p ?? s + 's')}` : null
  const parts = [
    n(lateReq, 'late request'),
    n(newReq, 'new request'),
    n(review, 'answer to review'),
    n(tasks, 'board task'),
    n(lateAct, 'late action'),
    n(upcoming, 'upcoming action'),
    n(undated, 'undated action'),
    n(neglected, 'neglected case'),
  ].filter(Boolean) as string[]
  const summary = parts.join(', ')

  const text = `${access.name} asked me to nudge you — here's where things stand: ${summary}. Want help clearing any of these?`
  await supabase.from('bot_messages').insert({ user_id: t.id, role: 'model', text })
  await supabase.from('user_alerts').insert({
    user_id: t.id,
    kind: 'task',
    title: `Nudge from ${access.name}`,
    body: summary,
    link: '/assistant',
    actor_id: access.userId,
    case_id: null,
  })
  await sendPushToUsers([t.id], {
    title: `Nudge from ${access.name}`,
    body: summary,
    url: '/assistant',
  })
  return { ok: true, summary }
}
