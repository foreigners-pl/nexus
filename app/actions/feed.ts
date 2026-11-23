'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { notifyUsers } from '@/app/actions/notifications'

// ------------------------------------------------------------
// Unified step feed: messages + requests built on case_entries /
// case_queries. Old kinds ('note','action','query') all render in
// the same chronological list; request highlights come from
// request_part ('question'|'answer') + query_id.
// ------------------------------------------------------------

async function getCaseContext(supabase: Awaited<ReturnType<typeof createClient>>, caseId: string) {
  const { data } = await supabase
    .from('cases')
    .select('case_code, assigned_to, csr_id, clients(first_name, last_name)')
    .eq('id', caseId)
    .single()
  const c = data as any
  return {
    assignedTo: (c?.assigned_to ?? null) as string | null,
    csrId: (c?.csr_id ?? null) as string | null,
    label: (c?.clients
      ? `${[c.clients.first_name, c.clients.last_name].filter(Boolean).join(' ')} · ${c.case_code ?? ''}`
      : c?.case_code ?? 'Case') as string,
  }
}

async function actorName(supabase: Awaited<ReturnType<typeof createClient>>, userId: string) {
  const { data } = await supabase.from('users').select('display_name, email').eq('id', userId).single()
  return (data?.display_name || data?.email?.split('@')[0] || 'Someone') as string
}

/** Post a plain message into a step's feed. */
export async function postStepMessage(caseId: string, stepId: string, body: string, attachmentIds: string[] = []) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const trimmed = body.trim()
  if (!trimmed && attachmentIds.length === 0) return { error: 'Message cannot be empty' }

  const { data: entry, error } = await supabase.from('case_entries').insert({
    case_id: caseId,
    step_id: stepId,
    kind: 'note',
    body: trimmed || null,
    created_by: user.id,
  }).select('id').single()

  if (error || !entry) return { error: 'Failed to send message' }

  if (attachmentIds.length > 0) {
    await supabase.from('case_attachments').update({ entry_id: entry.id }).in('id', attachmentIds)
  }

  const ctx = await getCaseContext(supabase, caseId)
  const name = await actorName(supabase, user.id)
  const recipients = [ctx.assignedTo, ctx.csrId].filter((id): id is string => !!id && id !== user.id)
  await notifyUsers(recipients, {
    kind: 'note',
    title: `New message on ${ctx.label}`,
    body: `${name}: ${(trimmed || 'Sent an attachment').slice(0, 140)}`,
    link: `/cases/${caseId}/progress?s=${stepId}`,
    caseId,
  })
  return { success: true, entryId: entry.id }
}

/**
 * Send a request on this step. Requires >=1 of the requester's own
 * messages as the highlighted question. Blocked while that user has
 * an unanswered open request or an unmarked answer on this step.
 */
export async function sendStepRequest(caseId: string, stepId: string, entryIds: string[]) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }
  if (!entryIds.length) return { error: 'Highlight at least one of your messages' }

  const ctx = await getCaseContext(supabase, caseId)
  const isCsr = ctx.csrId === user.id
  const assignedTo = isCsr ? ctx.assignedTo : ctx.csrId
  if (!assignedTo) return { error: isCsr ? 'No lawyer assigned to this case yet' : 'No CSR assigned to this case' }

  // Gate: one live request per step per requester
  const { data: live } = await supabase
    .from('case_queries')
    .select('id, status')
    .eq('case_id', caseId)
    .eq('step_id', stepId)
    .eq('opened_by', user.id)
    .neq('status', 'closed')
    .is('seen_at', null)
    .limit(1)
  if (live && live.length > 0) {
    return { error: live[0].status === 'answered' ? 'Mark the answer as seen first' : 'You already have an open request on this step' }
  }

  // Verify the highlighted messages are the user's own
  const { data: selected } = await supabase
    .from('case_entries')
    .select('id, created_by')
    .in('id', entryIds)
  if (!selected || selected.length === 0 || selected.some(e => e.created_by !== user.id)) {
    return { error: 'You can only request on your own messages' }
  }

  const { data: query, error } = await supabase.from('case_queries').insert({
    case_id: caseId,
    step_id: stepId,
    opened_by: user.id,
    assigned_to: assignedTo,
    direction: isCsr ? 'csr_to_legal' : 'legal_to_csr',
    status: 'open',
  }).select('id').single()
  if (error || !query) return { error: 'Failed to send request' }

  await supabase.from('case_entries')
    .update({ query_id: query.id, request_part: 'question' })
    .in('id', entryIds)

  revalidatePath(`/cases/${caseId}`)

  const name = await actorName(supabase, user.id)
  await notifyUsers([assignedTo], {
    kind: 'query',
    title: `New request on ${ctx.label}`,
    body: `${name} sent you a request`,
    link: `/cases/${caseId}/progress?s=${stepId}`,
    caseId,
  })
  return { success: true, queryId: query.id }
}

/**
 * Close an open request: the assignee highlights >=1 of their own
 * feed messages as the answer. Moves to 'answered' for the requester.
 */
export async function answerStepRequest(queryId: string, entryIds: string[]) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }
  if (!entryIds.length) return { error: 'Highlight at least one of your messages as the answer' }

  const { data: query } = await supabase
    .from('case_queries')
    .select('id, case_id, step_id, opened_by, assigned_to, status')
    .eq('id', queryId)
    .single()
  if (!query || query.status !== 'open') return { error: 'Request not found or already answered' }
  if (query.assigned_to !== user.id) return { error: 'Only the person this was sent to can answer it' }

  const { data: selected } = await supabase
    .from('case_entries')
    .select('id, created_by')
    .in('id', entryIds)
  if (!selected || selected.length === 0 || selected.some(e => e.created_by !== user.id)) {
    return { error: 'You can only mark your own messages as the answer' }
  }

  const now = new Date().toISOString()
  await supabase.from('case_entries')
    .update({ query_id: queryId, request_part: 'answer' })
    .in('id', entryIds)

  await supabase.from('case_queries').update({
    status: 'answered',
    answered_at: now,
    answered_by: user.id,
  }).eq('id', queryId)

  revalidatePath(`/cases/${query.case_id}`)

  const ctx = await getCaseContext(supabase, query.case_id)
  const name = await actorName(supabase, user.id)
  await notifyUsers([query.opened_by], {
    kind: 'query',
    title: `Request answered on ${ctx.label}`,
    body: `${name} answered your request`,
    link: `/cases/${query.case_id}/progress?s=${query.step_id}`,
    caseId: query.case_id,
  })
  return { success: true }
}

/** Requester confirms they saw the answer. Clears it from their queue. */
export async function markRequestSeen(queryId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const { data: query } = await supabase
    .from('case_queries')
    .select('id, case_id, opened_by, status')
    .eq('id', queryId)
    .single()
  if (!query || query.opened_by !== user.id || query.status !== 'answered' || !queryId) {
    return { error: 'Nothing to mark as seen' }
  }

  await supabase.from('case_queries').update({
    status: 'closed',
    seen_at: new Date().toISOString(),
    seen_by: user.id,
    closed_at: new Date().toISOString(),
  }).eq('id', queryId)

  revalidatePath(`/cases/${query.case_id}`)
  return { success: true }
}

/** Last N requests I sent that got answered — includes ones already marked
 *  seen, so accidental marks can be dug back up. */
export async function getMyAnsweredHistory(limit = 10) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { queries: [] as any[] }

  const { data } = await supabase
    .from('case_queries')
    .select(`
      id, case_id, step_id, status, created_at, answered_at, seen_at,
      case_steps(name),
      cases(case_code, clients(first_name, last_name))
    `)
    .eq('opened_by', user.id)
    .in('status', ['answered', 'closed'])
    .not('answered_at', 'is', null)
    .order('answered_at', { ascending: false })
    .limit(limit)

  return {
    queries: (data || []).map((q: any) => ({
      id: q.id,
      case_id: q.case_id,
      step_id: q.step_id ?? null,
      status: q.status,
      answered_at: q.answered_at ?? null,
      seen_at: q.seen_at ?? null,
      case_code: q.cases?.case_code ?? null,
      client_name: q.cases?.clients
        ? [q.cases.clients.first_name, q.cases.clients.last_name].filter(Boolean).join(' ')
        : null,
      step_name: q.case_steps?.name ?? null,
    })),
  }
}

/** Mark every answered request of mine as seen (home page bulk action). */
export async function markAllRequestsSeen() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const now = new Date().toISOString()
  await supabase.from('case_queries')
    .update({ status: 'closed', seen_at: now, seen_by: user.id, closed_at: now })
    .eq('opened_by', user.id)
    .eq('status', 'answered')
    .is('seen_at', null)

  revalidatePath('/requests')
  revalidatePath('/')
  return { success: true }
}
