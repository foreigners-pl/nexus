'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { notifyUsers, getCaseNotifyContext } from './notifications'

// ============================================================
// Types
// ============================================================
export interface CaseStep {
  id: string
  case_id: string
  name: string
  position: number
  is_required: boolean
  step_type: 'presale' | 'consultation' | 'service' | 'custom'
  service_id: string | null
  completed_at: string | null
  completed_by: string | null
  created_at: string
}

export interface CaseEntry {
  id: string
  case_id: string
  step_id: string | null
  kind: 'note' | 'action' | 'query'
  body: string | null
  created_by: string | null
  created_at: string
  due_date: string | null
  waiting_on: string | null
  completed_at: string | null
  completed_by: string | null
  query_id: string | null
  author?: { display_name: string | null; email: string } | null
}

// ============================================================
// Step generation — called on case creation and when a service
// is attached to a case. Safe to call repeatedly (no dupes).
// ============================================================

/** Creates the Pre-sale + Consultation system steps if missing. */
export async function ensureSystemSteps(caseId: string) {
  const supabase = await createClient()
  const { data: existing } = await supabase
    .from('case_steps')
    .select('id, step_type')
    .eq('case_id', caseId)
    .in('step_type', ['presale', 'consultation'])

  const types = new Set((existing || []).map(s => s.step_type))
  const toInsert = []
  if (!types.has('presale')) {
    toInsert.push({ case_id: caseId, name: 'Pre-sale', position: -2, is_required: true, step_type: 'presale' })
  }
  if (!types.has('consultation')) {
    toInsert.push({ case_id: caseId, name: 'Consultation', position: -1, is_required: false, step_type: 'consultation' })
  }
  if (toInsert.length > 0) {
    await supabase.from('case_steps').insert(toInsert)
  }
}

/** Copies a service's template steps onto the case (once per service). */
export async function generateStepsForService(caseId: string, serviceId: string) {
  const supabase = await createClient()

  // Skip if steps for this service already exist on the case
  const { data: existing } = await supabase
    .from('case_steps')
    .select('id')
    .eq('case_id', caseId)
    .eq('service_id', serviceId)
    .limit(1)
  if (existing && existing.length > 0) return

  const { data: template } = await supabase
    .from('service_steps')
    .select('name, position, is_required')
    .eq('service_id', serviceId)
    .order('position')

  if (!template || template.length === 0) return

  // Slot this service's steps after existing service steps (100-slot blocks)
  const { data: svcSteps } = await supabase
    .from('case_steps')
    .select('service_id')
    .eq('case_id', caseId)
    .eq('step_type', 'service')
  const blockIdx = new Set((svcSteps || []).map(s => s.service_id)).size

  await supabase.from('case_steps').insert(
    template.map(t => ({
      case_id: caseId,
      name: t.name,
      position: t.position + blockIdx * 100,
      is_required: t.is_required,
      step_type: 'service',
      service_id: serviceId,
    }))
  )
}

/** Sets current_step_id on a brand-new case (first step = Pre-sale). */
export async function setInitialStep(caseId: string) {
  const supabase = await createClient()
  const { data: presale } = await supabase
    .from('case_steps')
    .select('id')
    .eq('case_id', caseId)
    .eq('step_type', 'presale')
    .single()
  if (presale) {
    await supabase.from('cases').update({ current_step_id: presale.id }).eq('id', caseId)
  }
}

// ============================================================
// Reads
// ============================================================

export async function getCaseWorkflow(caseId: string): Promise<{
  steps: CaseStep[]
  entries: CaseEntry[]
  queries: Record<string, CaseQuery>
  currentStepId: string | null
  openAction: CaseEntry | null
  meId: string | null
  error?: string
}> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { steps: [], entries: [], queries: {}, currentStepId: null, openAction: null, meId: null, error: 'Not authenticated' }

  const [caseRes, stepsRes, entriesRes, queriesRes] = await Promise.all([
    supabase.from('cases').select('current_step_id').eq('id', caseId).single(),
    supabase.from('case_steps').select('*').eq('case_id', caseId).order('position'),
    supabase
      .from('case_entries')
      .select('*, author:users!created_by(display_name, email)')
      .eq('case_id', caseId)
      .order('created_at', { ascending: false }),
    supabase.from('case_queries').select('*').eq('case_id', caseId),
  ])

  const entries = (entriesRes.data || []) as CaseEntry[]
  const openAction = entries.find(e => e.kind === 'action' && !e.completed_at) || null
  const queries: Record<string, CaseQuery> = {}
  for (const q of queriesRes.data || []) queries[q.id] = q as CaseQuery

  return {
    steps: (stepsRes.data || []) as CaseStep[],
    entries,
    queries,
    currentStepId: caseRes.data?.current_step_id ?? null,
    openAction,
    meId: user.id,
  }
}

/** Single board entry + its step/query/case context — feeds the entry detail page. */
export async function getCaseEntry(entryId: string): Promise<{
  entry: CaseEntry | null
  stepName: string | null
  query: CaseQuery | null
  caseTitle: string | null
  caseSubtitle: string | null
  openerName: string | null
  assigneeName: string | null
  completedByName: string | null
  meId: string | null
}> {
  const empty = { entry: null, stepName: null, query: null, caseTitle: null, caseSubtitle: null, openerName: null, assigneeName: null, completedByName: null, meId: null }
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return empty

  const { data: entry } = await supabase
    .from('case_entries')
    .select('*, author:users!created_by(display_name, email)')
    .eq('id', entryId)
    .single()
  if (!entry) return { ...empty, meId: user.id }

  const [stepRes, queryRes, completerRes, caseRes] = await Promise.all([
    entry.step_id
      ? supabase.from('case_steps').select('name').eq('id', entry.step_id).maybeSingle()
      : Promise.resolve({ data: null }),
    entry.query_id
      ? supabase.from('case_queries').select('*').eq('id', entry.query_id).maybeSingle()
      : Promise.resolve({ data: null }),
    entry.completed_by
      ? supabase.from('users').select('display_name, email').eq('id', entry.completed_by).maybeSingle()
      : Promise.resolve({ data: null }),
    supabase
      .from('cases')
      .select('case_code, client_id, clients(first_name, last_name, contact_email), case_services!fk_case_services_case(services(name))')
      .eq('id', entry.case_id)
      .maybeSingle(),
  ])

  // Case header context: service name as title, client · phone · code as subtitle
  const caseRow = caseRes.data as any
  let caseTitle: string | null = null
  let caseSubtitle: string | null = null
  if (caseRow) {
    const svc = caseRow.case_services?.[0]?.services?.name
    caseTitle = svc || caseRow.case_code || null
    const cl = caseRow.clients
    const clientName = cl ? ([cl.first_name, cl.last_name].filter(Boolean).join(' ') || cl.contact_email) : null
    let phone: string | null = null
    if (caseRow.client_id) {
      const { data: p } = await supabase
        .from('contact_numbers')
        .select('country_code, number')
        .eq('client_id', caseRow.client_id)
        .limit(1)
        .maybeSingle()
      if (p) phone = `${p.country_code || ''} ${p.number}`.trim()
    }
    caseSubtitle = [clientName, phone, caseRow.case_code].filter(Boolean).join(' · ') || null
  }

  const query = (queryRes.data || null) as CaseQuery | null
  let openerName: string | null = null
  let assigneeName: string | null = null
  const partyIds = [query?.opened_by, query?.assigned_to].filter(Boolean) as string[]
  if (partyIds.length) {
    const { data: partyUsers } = await supabase
      .from('users').select('id, display_name, email').in('id', partyIds)
    const nameOf = (id?: string | null) => {
      const u = (partyUsers || []).find((p: any) => p.id === id)
      return u ? u.display_name || u.email.split('@')[0] : null
    }
    openerName = nameOf(query?.opened_by)
    assigneeName = nameOf(query?.assigned_to)
  }

  const completer = completerRes.data as { display_name: string | null; email: string } | null
  return {
    entry: entry as CaseEntry,
    stepName: (stepRes.data as { name: string } | null)?.name ?? null,
    query,
    caseTitle,
    caseSubtitle,
    openerName,
    assigneeName,
    completedByName: completer ? completer.display_name || completer.email.split('@')[0] : null,
    meId: user.id,
  }
}

/** The board entry that carries a given query (for deep links). */
export async function getEntryIdForQuery(queryId: string): Promise<string | null> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('case_entries')
    .select('id')
    .eq('query_id', queryId)
    .limit(1)
    .maybeSingle()
  return data?.id ?? null
}

// ============================================================
// Step actions
// ============================================================

export async function moveToStep(caseId: string, stepId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const { data: caseRow } = await supabase
    .from('cases')
    .select('current_step_id')
    .eq('id', caseId)
    .single()

  if (!caseRow || caseRow.current_step_id === stepId) {
    return { success: true }
  }

  // Mark the step we're leaving as completed (once)
  if (caseRow.current_step_id) {
    await supabase
      .from('case_steps')
      .update({ completed_at: new Date().toISOString(), completed_by: user.id })
      .eq('id', caseRow.current_step_id)
      .is('completed_at', null)
  }

  // Activate the target step (revisiting re-opens it)
  await supabase
    .from('case_steps')
    .update({ completed_at: null, completed_by: null })
    .eq('id', stepId)

  await supabase.from('cases').update({ current_step_id: stepId }).eq('id', caseId)

  revalidatePath(`/cases/${caseId}`)
  return { success: true }
}

export async function addCustomStep(caseId: string, name: string, afterStepId?: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const trimmed = name.trim()
  if (!trimmed) return { error: 'Step name is required' }

  const { data: steps } = await supabase
    .from('case_steps')
    .select('id, position')
    .eq('case_id', caseId)
    .order('position')

  let position = ((steps || []).at(-1)?.position ?? 0) + 1
  if (afterStepId && steps) {
    const idx = steps.findIndex(s => s.id === afterStepId)
    if (idx >= 0) {
      position = steps[idx].position + 1
      // Shift later steps down to make room
      for (const s of steps.slice(idx + 1)) {
        await supabase.from('case_steps').update({ position: s.position + 1 }).eq('id', s.id)
      }
    }
  }

  const { error } = await supabase.from('case_steps').insert({
    case_id: caseId,
    name: trimmed,
    position,
    is_required: false,
    step_type: 'custom',
  })

  if (error) return { error: 'Failed to add step' }
  revalidatePath(`/cases/${caseId}`)
  return { success: true }
}

// ============================================================
// Board entries
// ============================================================

async function getActiveStepId(supabase: Awaited<ReturnType<typeof createClient>>, caseId: string) {
  const { data } = await supabase
    .from('cases')
    .select('current_step_id')
    .eq('id', caseId)
    .single()
  return data?.current_step_id ?? null
}

export async function addNote(caseId: string, body: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const trimmed = body.trim()
  if (!trimmed) return { error: 'Note cannot be empty' }

  const { data: entry, error } = await supabase.from('case_entries').insert({
    case_id: caseId,
    step_id: await getActiveStepId(supabase, caseId),
    kind: 'note',
    body: trimmed,
    created_by: user.id,
  }).select('id').single()

  if (error) return { error: 'Failed to add note' }
  revalidatePath(`/cases/${caseId}`)

  const ctx = await getCaseNotifyContext(caseId)
  await notifyUsers(ctx.recipients, {
    kind: 'note',
    title: `New note on ${ctx.caseLabel}`,
    body: `${ctx.actorName}: ${trimmed.length > 140 ? trimmed.slice(0, 140) + '…' : trimmed}`,
    link: `/cases/${caseId}/progress/${entry.id}`,
    caseId,
  })
  return { success: true }
}

export async function createAction(caseId: string, body: string, dueDate: string, waitingOn?: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const trimmed = body.trim()
  if (!trimmed) return { error: 'Action description is required' }
  if (!dueDate) return { error: 'Due date is required' }

  // Enforce a single open action per case
  const { data: openActions } = await supabase
    .from('case_entries')
    .select('id')
    .eq('case_id', caseId)
    .eq('kind', 'action')
    .is('completed_at', null)
    .limit(1)
  if (openActions && openActions.length > 0) {
    return { error: 'Complete the current action first' }
  }

  const { data: entry, error } = await supabase.from('case_entries').insert({
    case_id: caseId,
    step_id: await getActiveStepId(supabase, caseId),
    kind: 'action',
    body: trimmed,
    due_date: dueDate,
    waiting_on: waitingOn || null,
    created_by: user.id,
  }).select('id').single()

  if (error) return { error: 'Failed to create action' }
  revalidatePath(`/cases/${caseId}`)

  const ctx = await getCaseNotifyContext(caseId)
  await notifyUsers(ctx.recipients, {
    kind: 'deadline',
    title: `New deadline on ${ctx.caseLabel}`,
    body: `${trimmed} — due ${new Date(dueDate).toLocaleDateString()}`,
    link: `/cases/${caseId}/progress/${entry.id}`,
    caseId,
  })
  return { success: true }
}

export async function completeAction(entryId: string, caseId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const { error } = await supabase
    .from('case_entries')
    .update({ completed_at: new Date().toISOString(), completed_by: user.id })
    .eq('id', entryId)
    .eq('kind', 'action')
    .is('completed_at', null)

  if (error) return { error: 'Failed to complete action' }
  revalidatePath(`/cases/${caseId}`)
  return { success: true }
}

export async function updateAction(entryId: string, caseId: string, body: string, dueDate: string, waitingOn?: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const { data: old } = await supabase
    .from('case_entries')
    .select('due_date')
    .eq('id', entryId)
    .single()

  const { error } = await supabase
    .from('case_entries')
    .update({ body: body.trim(), due_date: dueDate, waiting_on: waitingOn || null })
    .eq('id', entryId)
    .eq('kind', 'action')
    .is('completed_at', null)

  if (error) return { error: 'Failed to update action' }
  revalidatePath(`/cases/${caseId}`)

  if (old?.due_date !== dueDate) {
    const ctx = await getCaseNotifyContext(caseId)
    await notifyUsers(ctx.recipients, {
      kind: 'deadline',
      title: `Deadline moved on ${ctx.caseLabel}`,
      body: `${body.trim()} — now due ${new Date(dueDate).toLocaleDateString()}`,
      link: `/cases/${caseId}/progress/${entryId}`,
      caseId,
    })
  }
  return { success: true }
}

export interface MyAction {
  id: string
  body: string | null
  due_date: string | null
  waiting_on: string | null
  case_id: string
  case_code: string | null
  client_name: string | null
}

/** Open actions on cases where the user is the lawyer or the CSR. */
export async function getMyOpenActions(): Promise<{ actions: MyAction[]; error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { actions: [], error: 'Not authenticated' }

  const { data, error } = await supabase
    .from('case_entries')
    .select('id, body, due_date, waiting_on, case_id, cases!inner(case_code, assigned_to, csr_id, clients(first_name, last_name))')
    .eq('kind', 'action')
    .is('completed_at', null)
    .or(`assigned_to.eq.${user.id},csr_id.eq.${user.id}`, { foreignTable: 'cases' })
    .order('due_date', { ascending: true, nullsFirst: false })

  if (error) return { actions: [], error: error.message }

  return {
    actions: (data || []).map((a: any) => ({
      id: a.id,
      body: a.body,
      due_date: a.due_date,
      waiting_on: a.waiting_on,
      case_id: a.case_id,
      case_code: a.cases?.case_code ?? null,
      client_name: a.cases?.clients
        ? [a.cases.clients.first_name, a.cases.clients.last_name].filter(Boolean).join(' ')
        : null,
    })),
  }
}

// ============================================================
// Queries — CSR <-> legal threads living on the step board
// ============================================================

export interface CaseQuery {
  id: string
  case_id: string
  step_id: string | null
  opened_by: string | null
  assigned_to: string | null
  direction: 'csr_to_legal' | 'legal_to_csr'
  status: 'open' | 'answered' | 'closed'
  created_at: string
  closed_at: string | null
}

export interface QueryMessage {
  id: string
  query_id: string
  author_id: string | null
  body: string
  created_at: string
  author?: { display_name: string | null; email: string } | null
}

/**
 * Opens a query on the case's active step. Routing is automatic:
 * the case CSR's queries go to the assigned lawyer, everyone else's
 * go to the CSR. (Manager fallback for missing lawyer comes later.)
 */
export async function openQuery(caseId: string, body: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const trimmed = body.trim()
  if (!trimmed) return { error: 'Question cannot be empty' }

  const { data: caseRow } = await supabase
    .from('cases')
    .select('assigned_to, csr_id, current_step_id')
    .eq('id', caseId)
    .single()
  if (!caseRow) return { error: 'Case not found' }

  const isCsr = caseRow.csr_id === user.id
  const assignedTo = isCsr ? caseRow.assigned_to : caseRow.csr_id
  if (!assignedTo) {
    return { error: isCsr ? 'No lawyer assigned to this case yet' : 'No CSR assigned to this case' }
  }

  const { data: query, error: qErr } = await supabase
    .from('case_queries')
    .insert({
      case_id: caseId,
      step_id: caseRow.current_step_id,
      opened_by: user.id,
      assigned_to: assignedTo,
      direction: isCsr ? 'csr_to_legal' : 'legal_to_csr',
      status: 'open',
    })
    .select('id')
    .single()
  if (qErr || !query) return { error: 'Failed to open query' }

  const [{ error: mErr }, { data: queryEntry, error: eErr }] = await Promise.all([
    supabase.from('case_query_messages').insert({
      query_id: query.id,
      author_id: user.id,
      body: trimmed,
    }),
    supabase.from('case_entries').insert({
      case_id: caseId,
      step_id: caseRow.current_step_id,
      kind: 'query',
      body: trimmed,
      created_by: user.id,
      query_id: query.id,
    }).select('id').single(),
  ])

  if (mErr || eErr) return { error: 'Failed to open query' }
  revalidatePath(`/cases/${caseId}`)

  const ctx = await getCaseNotifyContext(caseId)
  await notifyUsers([assignedTo], {
    kind: 'query',
    title: `New query on ${ctx.caseLabel}`,
    body: `${ctx.actorName}: ${trimmed.length > 140 ? trimmed.slice(0, 140) + '…' : trimmed}`,
    link: `/cases/${caseId}/progress/${queryEntry.id}`,
    caseId,
  })
  return { success: true, queryId: query.id }
}

export async function replyToQuery(queryId: string, caseId: string, body: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const trimmed = body.trim()
  if (!trimmed) return { error: 'Reply cannot be empty' }

  const { data: query } = await supabase
    .from('case_queries')
    .select('opened_by, assigned_to, status')
    .eq('id', queryId)
    .single()
  if (!query) return { error: 'Query not found' }
  if (query.status === 'closed') return { error: 'Query is closed' }

  const { error } = await supabase.from('case_query_messages').insert({
    query_id: queryId,
    author_id: user.id,
    body: trimmed,
  })
  if (error) return { error: 'Failed to send reply' }

  // Assignee answering -> 'answered' (awaiting opener review).
  // Opener following up -> back to 'open' (ball returns to assignee).
  if (user.id === query.assigned_to && query.status === 'open') {
    await supabase.from('case_queries').update({ status: 'answered' }).eq('id', queryId)
  } else if (user.id === query.opened_by && query.status === 'answered') {
    await supabase.from('case_queries').update({ status: 'open' }).eq('id', queryId)
  }

  revalidatePath(`/cases/${caseId}`)

  const otherParty = user.id === query.assigned_to ? query.opened_by : query.assigned_to
  const entryId = await getEntryIdForQuery(queryId)
  const ctx = await getCaseNotifyContext(caseId)
  await notifyUsers([otherParty], {
    kind: 'query',
    title: `Query reply on ${ctx.caseLabel}`,
    body: `${ctx.actorName}: ${trimmed.length > 140 ? trimmed.slice(0, 140) + '…' : trimmed}`,
    link: entryId ? `/cases/${caseId}/progress/${entryId}` : `/cases/${caseId}/progress`,
    caseId,
  })
  return { success: true }
}

/** Only the person who opened the query can close it. */
export async function closeQuery(queryId: string, caseId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const { error } = await supabase
    .from('case_queries')
    .update({ status: 'closed', closed_at: new Date().toISOString() })
    .eq('id', queryId)
    .eq('opened_by', user.id)
    .neq('status', 'closed')

  if (error) return { error: 'Failed to close query' }
  revalidatePath(`/cases/${caseId}`)
  return { success: true }
}

export async function getQueryThread(queryId: string): Promise<{
  query: CaseQuery | null
  messages: QueryMessage[]
  meId: string | null
}> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const [qRes, mRes] = await Promise.all([
    supabase.from('case_queries').select('*').eq('id', queryId).single(),
    supabase
      .from('case_query_messages')
      .select('*, author:users!author_id(display_name, email)')
      .eq('query_id', queryId)
      .order('created_at'),
  ])

  return {
    query: (qRes.data || null) as CaseQuery | null,
    messages: (mRes.data || []) as QueryMessage[],
    meId: user?.id ?? null,
  }
}

export interface MyQuery {
  id: string
  case_id: string
  entry_id: string | null
  status: 'open' | 'answered' | 'closed'
  direction: 'csr_to_legal' | 'legal_to_csr'
  created_at: string
  needs_me: 'respond' | 'review'
  preview: string | null
  case_code: string | null
  client_name: string | null
  step_name: string | null
}

/**
 * Queries that currently need ME: ones assigned to me still 'open'
 * (I must respond), plus ones I opened that are 'answered'
 * (awaiting my review/close).
 */
export async function getMyQueries(): Promise<{ queries: MyQuery[]; error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { queries: [], error: 'Not authenticated' }

  const { data, error } = await supabase
    .from('case_queries')
    .select(`
      id, case_id, status, direction, created_at, opened_by, assigned_to,
      case_steps(name),
      cases(case_code, clients(first_name, last_name)),
      case_query_messages(body, created_at),
      case_entries(id)
    `)
    .or(`and(assigned_to.eq.${user.id},status.eq.open),and(opened_by.eq.${user.id},status.eq.answered)`)
    .order('created_at', { ascending: false })

  if (error) return { queries: [], error: error.message }

  return {
    queries: (data || []).map((q: any) => {
      const msgs = (q.case_query_messages || []).sort(
        (a: any, b: any) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      )
      return {
        id: q.id,
        case_id: q.case_id,
        entry_id: (q.case_entries || [])[0]?.id ?? null,
        status: q.status,
        direction: q.direction,
        created_at: q.created_at,
        needs_me: q.assigned_to === user.id && q.status === 'open' ? 'respond' : 'review',
        preview: msgs[0]?.body ?? null,
        case_code: q.cases?.case_code ?? null,
        client_name: q.cases?.clients
          ? [q.cases.clients.first_name, q.cases.clients.last_name].filter(Boolean).join(' ')
          : null,
        step_name: q.case_steps?.name ?? null,
      } as MyQuery
    }),
  }
}

/** Query metadata for board rows — statuses keyed by query_id. */
export async function getCaseQueries(caseId: string): Promise<Record<string, CaseQuery>> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('case_queries')
    .select('*')
    .eq('case_id', caseId)
  const map: Record<string, CaseQuery> = {}
  for (const q of data || []) map[q.id] = q as CaseQuery
  return map
}

// ============================================================
// Service step templates (Settings)
// ============================================================

export async function getServiceSteps(serviceId: string) {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('service_steps')
    .select('id, name, position, is_required')
    .eq('service_id', serviceId)
    .order('position')
  if (error) return { steps: [], error: error.message }
  return { steps: data || [] }
}

export async function saveServiceSteps(
  serviceId: string,
  steps: { name: string; is_required: boolean }[]
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  // Replace all template steps for this service
  await supabase.from('service_steps').delete().eq('service_id', serviceId)

  const rows = steps
    .filter(s => s.name.trim())
    .map((s, i) => ({
      service_id: serviceId,
      name: s.name.trim(),
      position: i,
      is_required: s.is_required,
    }))

  if (rows.length > 0) {
    const { error } = await supabase.from('service_steps').insert(rows)
    if (error) return { error: error.message }
  }

  return { success: true }
}
