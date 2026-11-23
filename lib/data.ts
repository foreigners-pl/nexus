// Client-side data fetchers — direct browser→Supabase parallel queries.
// These mirror the server-action bundles but skip the Vercel hop entirely:
// a page's data loads in ~1-2 roundtrips to Supabase with no function cold start.
// Mutations stay in app/actions/* (server actions).

import { createClient } from '@/lib/supabase/client'

const supabase = createClient()

async function meId(): Promise<string | null> {
  // getSession reads the locally stored session — no network call.
  const { data } = await supabase.auth.getSession()
  return data.session?.user.id ?? null
}

// ============================================================
// Case page bundle
// ============================================================

export async function fetchComments(caseId: string) {
  const [{ data }, { data: sessionData }] = await Promise.all([
    supabase
      .from('comments')
      .select('*')
      .eq('case_id', caseId)
      .order('created_at', { ascending: false }),
    supabase.auth.getSession(),
  ])

  const me = sessionData.session?.user
  return (data || []).map((comment: any) => ({
    ...comment,
    users: {
      id: comment.user_id,
      email: comment.user_id === me?.id ? me?.email || 'Unknown' : 'Unknown User',
      display_name: comment.user_id === me?.id ? me?.user_metadata?.display_name || me?.email : null,
    },
  }))
}

export async function fetchCasePageData(idOrCode: string) {
  const [me, caseRes] = await Promise.all([
    meId(),
    idOrCode.startsWith('C')
      ? supabase.from('cases').select('*').eq('case_code', idOrCode).single()
      : supabase.from('cases').select('*').eq('id', idOrCode).single(),
  ])

  const caseData = caseRes.data
  if (!caseData) return { error: 'Case not found' as const }

  const [clientRes, phonesRes, serviceRes, stepRes, installmentsRes, attachmentsRes, commentsCountRes] = await Promise.all([
    caseData.client_id
      ? supabase.from('clients').select('*').eq('id', caseData.client_id).single()
      : Promise.resolve({ data: null }),
    caseData.client_id
      ? supabase.from('contact_numbers').select('*').eq('client_id', caseData.client_id).order('number')
      : Promise.resolve({ data: null }),
    supabase.from('case_services').select('services(name)').eq('case_id', caseData.id).limit(1).maybeSingle(),
    caseData.current_step_id
      ? supabase.from('case_steps').select('name').eq('id', caseData.current_step_id).maybeSingle()
      : Promise.resolve({ data: null }),
    supabase.from('installments').select('amount, paid, parent_installment_id').eq('case_id', caseData.id),
    supabase.from('case_attachments').select('id', { count: 'exact', head: true }).eq('case_id', caseData.id),
    supabase.from('comments').select('id', { count: 'exact', head: true }).eq('case_id', caseData.id),
  ])

  const svc = (serviceRes.data?.services as { name?: string } | null)?.name
    || (caseData.custom_service_name as string | null)
    || ''
  const inst = (installmentsRes.data || []) as { amount: number; paid: boolean; parent_installment_id?: string }[]

  return {
    currentUserId: me ?? undefined,
    case: caseData,
    client: clientRes.data,
    phones: phonesRes.data || [],
    serviceName: svc,
    currentStepName: (stepRes.data as { name?: string } | null)?.name || '',
    paidAmount: inst.filter(i => i.paid && !i.parent_installment_id).reduce((sum, i) => sum + (i.amount || 0), 0),
    fileCount: attachmentsRes.count || 0,
    commentsCount: commentsCountRes.count || 0,
  }
}

export async function fetchCaseHeaderData(idOrCode: string) {
  const select = 'id, case_code, client_id, custom_service_name, case_services!fk_case_services_case(services(name))'
  const { data: caseRow } = idOrCode.startsWith('C')
    ? await supabase.from('cases').select(select).eq('case_code', idOrCode).single()
    : await supabase.from('cases').select(select).eq('id', idOrCode).single()

  if (!caseRow) return { error: 'Case not found' as const }

  const svc = (caseRow.case_services as { services?: { name?: string } }[] | null)?.[0]?.services?.name
    || (caseRow.custom_service_name as string | null)
    || null
  let clientName = ''
  let phone = ''
  if (caseRow.client_id) {
    const [clientRes, phoneRes] = await Promise.all([
      supabase.from('clients').select('first_name, last_name, contact_email').eq('id', caseRow.client_id).single(),
      supabase.from('contact_numbers').select('country_code, number').eq('client_id', caseRow.client_id).limit(1).maybeSingle(),
    ])
    const c = clientRes.data
    clientName = c ? ([c.first_name, c.last_name].filter(Boolean).join(' ') || c.contact_email || '') : ''
    phone = phoneRes.data ? `${phoneRes.data.country_code || ''} ${phoneRes.data.number}`.trim() : ''
  }

  return {
    caseId: caseRow.id as string,
    clientId: (caseRow.client_id as string | null) ?? null,
    caseCode: (caseRow.case_code as string) || 'Case',
    clientName: clientName || '',
    title: svc || (caseRow.case_code as string) || 'Case',
    subtitle: [clientName, phone].filter(Boolean).join(' · '),
    serviceName: svc || '',
    phone,
  }
}

// ============================================================
// Client page bundle
// ============================================================

export async function fetchClientPageData(idOrCode: string) {
  const { data: clientData, error } = idOrCode.startsWith('CL')
    ? await supabase.from('clients').select('*').eq('client_code', idOrCode).single()
    : await supabase.from('clients').select('*').eq('id', idOrCode).single()

  if (error || !clientData) return { error: 'Client not found' as const }
  const id = clientData.id

  const [phonesRes, notesRes, casesRes, countryRes, cityRes] = await Promise.all([
    supabase.from('contact_numbers').select('*').eq('client_id', id).order('number'),
    supabase
      .from('client_notes')
      .select('*')
      .eq('client_id', id)
      .order('is_pinned', { ascending: false })
      .order('created_at', { ascending: false }),
    supabase
      .from('cases')
      .select(`
        *,
        status(name),
        csr:users!cases_csr_id_fkey(id, display_name, email),
        legal:users!cases_assigned_to_fkey(id, display_name, email),
        case_services:case_services!case_id(services(name))
      `)
      .eq('client_id', id)
      .order('created_at', { ascending: false }),
    clientData.country_of_origin
      ? supabase.from('countries').select('country').eq('id', clientData.country_of_origin).single()
      : Promise.resolve({ data: null }),
    clientData.city_in_poland
      ? supabase.from('cities').select('city').eq('id', clientData.city_in_poland).single()
      : Promise.resolve({ data: null }),
  ])

  return {
    client: clientData,
    phoneNumbers: phonesRes.data || [],
    notes: notesRes.data || [],
    cases: casesRes.data || [],
    countryName: (countryRes.data as { country?: string } | null)?.country || null,
    cityName: (cityRes.data as { city?: string } | null)?.city || null,
  }
}

// ============================================================
// Workflow (progress page) + entry detail
// ============================================================

export async function fetchCaseWorkflow(caseId: string) {
  const [me, caseRes, stepsRes, entriesRes, queriesRes, servicesRes, eligibilityRes, attachmentsRes] = await Promise.all([
    meId(),
    supabase.from('cases').select('current_step_id, csr_id, assigned_to').eq('id', caseId).single(),
    supabase.from('case_steps').select('*').eq('case_id', caseId).order('position'),
    supabase
      .from('case_entries')
      .select('*, author:users!created_by(display_name, email)')
      .eq('case_id', caseId)
      .order('created_at', { ascending: true }),
    supabase.from('case_queries').select('*').eq('case_id', caseId),
    supabase.from('case_services').select('service_id').eq('case_id', caseId).limit(1),
    supabase.from('case_eligibility').select('*').eq('case_id', caseId),
    supabase.from('case_attachments').select('id, entry_id, file_name, file_path, file_type, file_size').eq('case_id', caseId).not('entry_id', 'is', null),
  ])

  const entries = (entriesRes.data || []) as any[]
  const openAction = entries.find(e => e.kind === 'action' && !e.completed_at) || null
  const queries: Record<string, any> = {}
  for (const q of queriesRes.data || []) queries[q.id] = q

  const attachmentsByEntry: Record<string, any[]> = {}
  for (const a of attachmentsRes.data || []) {
    if (!a.entry_id) continue
    ;(attachmentsByEntry[a.entry_id] ||= []).push(a)
  }

  // Actor names for request/action event lines — query lifecycle actors
  // aren't covered by entry authors, so resolve them here.
  const actorIds = new Set<string>()
  for (const q of queriesRes.data || []) {
    for (const id of [q.opened_by, q.assigned_to, q.answered_by, q.seen_by]) if (id) actorIds.add(id)
  }
  for (const e of entries) {
    if (e.completed_by) actorIds.add(e.completed_by)
  }
  const usersById: Record<string, { display_name: string | null; email: string }> = {}
  if (actorIds.size) {
    const { data: us } = await supabase.from('users').select('id, display_name, email').in('id', [...actorIds])
    for (const u of us || []) usersById[u.id] = u
  }

  const serviceId = (servicesRes.data?.[0] as any)?.service_id ?? null
  const eligibilityRows = (eligibilityRes.data || []) as any[]
  const statusRow = eligibilityRows.find(e => e.type === 'status')
  const documentsRow = eligibilityRows.find(e => e.type === 'documents')

  let eligibilityItems: any[] = []
  if (serviceId) {
    const { data: items } = await supabase
      .from('service_eligibility')
      .select('*')
      .eq('service_id', serviceId)
      .order('position')
    eligibilityItems = items || []
  }

  return {
    steps: (stepsRes.data || []) as any[],
    entries,
    queries,
    currentStepId: caseRes.data?.current_step_id ?? null,
    csrId: (caseRes.data as any)?.csr_id ?? null,
    legalId: (caseRes.data as any)?.assigned_to ?? null,
    openAction,
    meId: me,
    attachmentsByEntry,
    usersById,
    serviceId,
    eligibility: {
      statusCompleted: !!statusRow?.completed_at,
      documentsCompleted: !!documentsRow?.completed_at,
      statusAt: statusRow?.completed_at ?? null,
      documentsAt: documentsRow?.completed_at ?? null,
    },
    eligibilityItems,
  }
}

export async function fetchCaseEntry(entryId: string) {
  const empty = { entry: null, stepName: null, query: null, caseTitle: null, caseSubtitle: null, caseCode: null, clientName: null, serviceName: null, phone: null, clientId: null, openerName: null, assigneeName: null, completedByName: null, meId: null }
  const me = await meId()

  const { data: entry } = await supabase
    .from('case_entries')
    .select('*, author:users!created_by(display_name, email)')
    .eq('id', entryId)
    .single()
  if (!entry) return { ...empty, meId: me }

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
      .select('case_code, client_id, custom_service_name, clients(first_name, last_name, contact_email), case_services!fk_case_services_case(services(name))')
      .eq('id', entry.case_id)
      .maybeSingle(),
  ])

  const caseRow = caseRes.data as any
  let caseTitle: string | null = null
  let caseSubtitle: string | null = null
  let caseCode: string | null = null
  let clientName: string | null = null
  let serviceName: string | null = null
  let phone: string | null = null
  if (caseRow) {
    const svc = caseRow.case_services?.[0]?.services?.name ?? caseRow.custom_service_name ?? null
    serviceName = svc
    const cl = caseRow.clients
    clientName = cl ? ([cl.first_name, cl.last_name].filter(Boolean).join(' ') || cl.contact_email) : null
    caseCode = caseRow.case_code || null
    if (caseRow.client_id) {
      const { data: p } = await supabase
        .from('contact_numbers')
        .select('country_code, number')
        .eq('client_id', caseRow.client_id)
        .limit(1)
        .maybeSingle()
      if (p) phone = `${p.country_code || ''} ${p.number}`.trim()
    }
    caseTitle = clientName || caseRow.case_code || null
    caseSubtitle = [svc, phone].filter(Boolean).join(' · ') || null
  }

  const query = (queryRes.data || null) as any
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
    entry: entry as any,
    stepName: (stepRes.data as { name?: string } | null)?.name ?? null,
    query,
    caseTitle,
    caseSubtitle,
    caseCode,
    clientName,
    serviceName,
    phone,
    clientId: (caseRow?.client_id as string | undefined) ?? null,
    openerName,
    assigneeName,
    completedByName: completer ? completer.display_name || completer.email.split('@')[0] : null,
    meId: me,
  }
}

// ============================================================
// Billing + attachments
// ============================================================

export async function fetchBillingData(idOrCode: string, ensureBalance: (caseId: string) => Promise<unknown>) {
  const { data: caseRow } = idOrCode.startsWith('C')
    ? await supabase.from('cases').select('*').eq('case_code', idOrCode).single()
    : await supabase.from('cases').select('*').eq('id', idOrCode).single()

  if (!caseRow) return { error: 'Case not found' as const }

  // ensureBalance is the balance-installment resync server action (a write —
  // stays server-side). Runs in parallel with the client/phone/service reads.
  const [clientRes, phoneRes, servicesRes] = await Promise.all([
    caseRow.client_id
      ? supabase.from('clients').select('*').eq('id', caseRow.client_id).single()
      : Promise.resolve({ data: null }),
    caseRow.client_id
      ? supabase.from('contact_numbers').select('country_code, number').eq('client_id', caseRow.client_id).limit(1).maybeSingle()
      : Promise.resolve({ data: null }),
    supabase.from('case_services').select('*, services(*)').eq('case_id', caseRow.id),
    ensureBalance(caseRow.id),
  ])

  const instRes = await supabase
    .from('installments')
    .select('*')
    .eq('case_id', caseRow.id)
    .order('position', { ascending: true })

  return {
    case: caseRow,
    client: clientRes.data,
    clientPhone: phoneRes.data ? `${phoneRes.data.country_code || ''} ${phoneRes.data.number}`.trim() : '',
    caseServices: servicesRes.data || [],
    installments: instRes.data || [],
  }
}

export async function fetchAttachments(caseId: string) {
  const { data } = await supabase
    .from('case_attachments')
    .select('*')
    .eq('case_id', caseId)
    .order('created_at', { ascending: false })

  const uploaderIds = [...new Set((data || []).map((a: any) => a.uploaded_by).filter(Boolean))] as string[]
  const names: Record<string, { display_name: string | null; email: string }> = {}
  if (uploaderIds.length) {
    const { data: users } = await supabase
      .from('users')
      .select('id, display_name, email')
      .in('id', uploaderIds)
    for (const u of users || []) names[u.id] = u
  }

  return (data || []).map((a: any) => ({
    ...a,
    uploader: a.uploaded_by ? names[a.uploaded_by] ?? null : null,
  }))
}

export async function fetchCurrentUser() {
  const me = await meId()
  if (!me) return { user: null }
  const { data } = await supabase.from('users').select('*').eq('id', me).single()
  return { user: data }
}

const CLIENT_SEARCH_SELECT = 'id, first_name, last_name, contact_email, contact_numbers(number)'

export interface ClientSearchResult {
  id: string
  first_name: string | null
  last_name: string | null
  contact_email: string | null
  phones: string[]
}

/** Client search by name/email/phone — same logic as the server action. */
export async function searchClientsQuery(query: string, limit = 5): Promise<{ results: ClientSearchResult[]; error?: string }> {
  const q = query.trim()
  if (!q) return { results: [] }

  const pattern = `%${q}%`
  const digits = q.replace(/\D/g, '')
  const clientOr = [
    `first_name.ilike.${pattern}`,
    `last_name.ilike.${pattern}`,
    `contact_email.ilike.${pattern}`,
  ].join(',')

  const phonePatterns = [...new Set(
    [digits, digits.slice(-9)].filter(d => d.length >= 3).map(d => `%${d}%`)
  )]

  const [byClientRes, phoneMatchesRes] = await Promise.all([
    supabase.from('clients').select(CLIENT_SEARCH_SELECT).or(clientOr).limit(limit),
    phonePatterns.length > 0
      ? supabase.from('contact_numbers').select('client_id').or(phonePatterns.map(p => `number.ilike.${p}`).join(',')).limit(limit)
      : Promise.resolve({ data: null }),
  ])

  if (byClientRes.error) return { results: [], error: byClientRes.error.message }

  const phoneClientIds = [...new Set((phoneMatchesRes.data || []).map(p => p.client_id))]
    .filter(id => !(byClientRes.data || []).some(c => c.id === id))

  let byPhone: any[] = []
  if (phoneClientIds.length > 0) {
    const { data } = await supabase
      .from('clients')
      .select(CLIENT_SEARCH_SELECT)
      .in('id', phoneClientIds)
      .limit(limit)
    byPhone = data || []
  }

  const merged = [...(byClientRes.data || []), ...byPhone].slice(0, limit)
  return {
    results: merged.map(c => ({
      id: c.id,
      first_name: c.first_name,
      last_name: c.last_name,
      contact_email: c.contact_email,
      phones: (c.contact_numbers || []).map((p: any) => p.number),
    })),
  }
}

// ============================================================
// Home / requests / actions
// ============================================================

export async function fetchMyQueries() {
  const me = await meId()
  if (!me) return { queries: [] as any[] }

  const { data } = await supabase
    .from('case_queries')
    .select(`
      id, case_id, step_id, status, direction, created_at, answered_at, seen_at, opened_by, assigned_to,
      case_steps(name),
      cases(case_code, clients(first_name, last_name))
    `)
    .or(`and(assigned_to.eq.${me},status.eq.open),and(opened_by.eq.${me},status.eq.answered,seen_at.is.null)`)
    .order('created_at', { ascending: false })

  const queryIds = (data || []).map((q: any) => q.id)
  const { data: entries } = queryIds.length
    ? await supabase
        .from('case_entries')
        .select('id, query_id, body')
        .in('query_id', queryIds)
        .eq('request_part', 'question')
    : { data: [] }
  const entryByQuery = new Map((entries || []).map((e: any) => [e.query_id, e]))

  return {
    queries: (data || []).map((q: any) => {
      const question = entryByQuery.get(q.id)
      return {
        id: q.id,
        case_id: q.case_id,
        entry_id: question?.id ?? null,
        step_id: q.step_id ?? null,
        status: q.status,
        direction: q.direction,
        created_at: q.created_at,
        answered_at: q.answered_at ?? null,
        pending_since: q.status === 'answered' ? (q.answered_at ?? q.created_at) : q.created_at,
        needs_me: q.assigned_to === me && q.status === 'open' ? 'respond' : 'seen',
        preview: question?.body ?? null,
        case_code: q.cases?.case_code ?? null,
        client_name: q.cases?.clients
          ? [q.cases.clients.first_name, q.cases.clients.last_name].filter(Boolean).join(' ')
          : null,
        step_name: q.case_steps?.name ?? null,
      }
    }),
  }
}

/** Last N requests I sent that got answered — includes ones already marked
 *  seen, so accidental marks can be dug back up. */
export async function fetchMyAnsweredHistory(limit = 10) {
  const me = await meId()
  if (!me) return { queries: [] as any[] }

  const { data } = await supabase
    .from('case_queries')
    .select(`
      id, case_id, step_id, status, direction, created_at, answered_at, seen_at, opened_by, assigned_to,
      case_steps(name),
      cases(case_code, clients(first_name, last_name))
    `)
    .eq('opened_by', me)
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
      created_at: q.created_at,
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

export async function fetchMyOpenActions() {
  const me = await meId()
  if (!me) return { actions: [] as any[] }

  const { data } = await supabase
    .from('case_entries')
    .select('id, body, due_date, waiting_on, case_id, step_id, cases!inner(case_code, clients(first_name, last_name))')
    .eq('kind', 'action')
    .eq('created_by', me)
    .is('completed_at', null)
    .order('due_date', { ascending: true, nullsFirst: false })

  return {
    actions: (data || []).map((a: any) => ({
      id: a.id,
      body: a.body,
      due_date: a.due_date,
      waiting_on: a.waiting_on,
      case_id: a.case_id,
      step_id: a.step_id ?? null,
      case_code: a.cases?.case_code ?? null,
      client_name: a.cases?.clients
        ? [a.cases.clients.first_name, a.cases.clients.last_name].filter(Boolean).join(' ')
        : null,
    })),
  }
}

export async function fetchCasesMissingActions() {
  const me = await meId()
  if (!me) return { cases: [] as any[] }

  const { data: rows } = await supabase
    .from('cases')
    .select('id, case_code, status:status_id(name), step:case_steps!cases_current_step_id_fkey(name, step_type), clients(first_name, last_name)')
    .or(`assigned_to.eq.${me},csr_id.eq.${me}`)

  const eligible = (rows || []).filter((c: any) =>
    c.step &&
    // Eligibility and Pre-sale can't hold actions — flagging them as
    // neglected is noise. Consultation onward can, so it counts.
    c.step.step_type !== 'eligibility' &&
    c.step.step_type !== 'presale' &&
    !(c.status?.name || '').toLowerCase().startsWith('complet')
  )
  if (eligible.length === 0) return { cases: [] }

  const { data: openActions } = await supabase
    .from('case_entries')
    .select('case_id')
    .eq('kind', 'action')
    .is('completed_at', null)
    .in('case_id', eligible.map((c: any) => c.id))

  const hasAction = new Set((openActions || []).map(r => r.case_id))
  return {
    cases: eligible
      .filter((c: any) => !hasAction.has(c.id))
      .map((c: any) => ({
        case_id: c.id,
        case_code: c.case_code ?? null,
        client_name: c.clients
          ? [c.clients.first_name, c.clients.last_name].filter(Boolean).join(' ')
          : null,
        step_name: c.step?.name ?? null,
      })),
  }
}

/** Board cards assigned to the user that aren't in a final status column. */
export async function fetchMyOpenTasks() {
  const me = await meId()
  if (!me) return { tasks: [] as any[] }

  const { data: cardAssignments } = await supabase
    .from('card_assignees')
    .select('card_id')
    .eq('user_id', me)

  if (!cardAssignments || cardAssignments.length === 0) return { tasks: [] }

  const cardIds = cardAssignments.map(a => a.card_id)
  const { data } = await supabase
    .from('cards')
    .select(`
      id, title, description, due_date, created_at, board_id, status_id,
      boards(id, name),
      board_statuses(id, name, color, position)
    `)
    .in('id', cardIds)
    .order('due_date', { ascending: true, nullsFirst: false })

  const boardIds = [...new Set((data || []).map((t: any) => t.board_id))]
  const { data: statuses } = boardIds.length
    ? await supabase.from('board_statuses').select('id, board_id, position').in('board_id', boardIds)
    : { data: [] }

  const maxPositionByBoard = new Map<string, number>()
  for (const s of statuses || []) {
    const prev = maxPositionByBoard.get(s.board_id)
    if (prev === undefined || (s.position ?? 0) > prev) {
      maxPositionByBoard.set(s.board_id, s.position ?? 0)
    }
  }
  const finalStatusIds = new Set(
    (statuses || []).filter(s => (s.position ?? 0) === maxPositionByBoard.get(s.board_id)).map(s => s.id)
  )

  return {
    tasks: (data || [])
      .filter((t: any) => !finalStatusIds.has(t.status_id))
      .map((t: any) => ({
        ...t,
        boards: Array.isArray(t.boards) ? t.boards[0] || null : t.boards,
        board_statuses: Array.isArray(t.board_statuses) ? t.board_statuses[0] || null : t.board_statuses,
      })),
  }
}

// ============================================================
// Wiki — same filters as app/actions/wiki.ts, minus the Vercel hop.
// Fetching all folders' documents in ONE query replaces the old
// per-folder server actions.
// ============================================================

export async function fetchWikiFolders(isShared: boolean) {
  const me = await meId()
  if (!me) return []

  if (isShared) {
    const { data: accessRecords } = await supabase
      .from('wiki_folder_access')
      .select('folder_id')
      .eq('user_id', me)

    const accessIds = (accessRecords || []).map(r => r.folder_id)

    let query = supabase.from('wiki_folders').select('*')
    if (accessIds.length > 0) {
      query = query.or(`id.in.(${accessIds.join(',')}),and(owner_id.eq.${me},is_shared.eq.true)`)
    } else {
      query = query.eq('owner_id', me).eq('is_shared', true)
    }

    const { data } = await query
      .order('position', { ascending: true })
      .order('created_at', { ascending: false })
    return data || []
  }

  const { data } = await supabase
    .from('wiki_folders')
    .select('*')
    .eq('owner_id', me)
    .eq('is_shared', false)
    .order('position', { ascending: true })
    .order('created_at', { ascending: false })
  return data || []
}

/** Documents for many folders in a single query, grouped by folder_id. */
export async function fetchWikiDocumentsMap(folderIds: string[]) {
  const map: Record<string, any[]> = Object.fromEntries(folderIds.map(id => [id, []]))
  if (folderIds.length === 0) return map

  const { data } = await supabase
    .from('wiki_documents')
    .select('*')
    .in('folder_id', folderIds)
    .order('position', { ascending: true })
    .order('created_at', { ascending: false })

  for (const d of data || []) {
    if (map[d.folder_id]) map[d.folder_id].push(d)
  }
  return map
}

export async function fetchWikiDocuments(folderId: string) {
  const { data } = await supabase
    .from('wiki_documents')
    .select('*')
    .eq('folder_id', folderId)
    .order('position', { ascending: true })
    .order('created_at', { ascending: false })
  return data || []
}

export async function fetchUserFolderAccess(folderId: string): Promise<'owner' | 'editor' | 'viewer' | null> {
  const me = await meId()
  if (!me) return null

  const { data: folder } = await supabase
    .from('wiki_folders')
    .select('owner_id')
    .eq('id', folderId)
    .single()

  if (!folder) return null
  if (folder.owner_id === me) return 'owner'

  const { data: access } = await supabase
    .from('wiki_folder_access')
    .select('access_level')
    .eq('folder_id', folderId)
    .eq('user_id', me)
    .single()

  return (access?.access_level as 'editor' | 'viewer') ?? null
}
