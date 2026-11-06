'use server'

import { createClient } from '@/lib/supabase/server'
import mammoth from 'mammoth'
import type { Service } from '@/types/database'

export async function getServices(): Promise<Service[]> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []
  const { data } = await supabase.from('services').select('*').order('name')
  return (data || []) as Service[]
}

export async function getServiceForEdit(serviceId: string): Promise<ParsedProtocol | null> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data: service } = await supabase.from('services').select('*').eq('id', serviceId).single()
  if (!service) return null

  const { data: steps } = await supabase
    .from('service_steps')
    .select('*')
    .eq('service_id', serviceId)
    .order('position')

  const { data: eligibility } = await supabase
    .from('service_eligibility')
    .select('*')
    .eq('service_id', serviceId)
    .order('position')

  const extras = (service.protocol_extras as Record<string, unknown>) || {}

  const saleExecution = (extras.saleExecution as string[]) || []
  const legalHandoff = (extras.legalHandoff as string[]) || []

  return {
    serviceName: service.name || '',
    category: service.category || '',
    migrated: service.migrated ?? false,
    serviceDescription: service.description || '',
    servicePrice: service.gross_price ?? null,
    steps: (steps || []).map((s: any) => ({ name: s.name, description: s.description || '', price: null, isRequired: s.is_required })),
    statusItems: (eligibility || []).filter((e: any) => e.type === 'status').map((e: any) => ({ title: e.title, description: e.description || null })),
    documentItems: (eligibility || []).filter((e: any) => e.type === 'documents').map((e: any) => ({ title: e.title, description: e.description || null })),
    optionalStages: (extras.optionalStages as ParsedOptionItem[]) || [],
    allInclusive: (extras.allInclusive as { name: string; price: number | null; items: string[] } | null) || null,
    saleExecution,
    legalHandoff,
    executionStages: (extras.executionStages as { name: string; items: string[] }[]) || [],
    closureStages: (extras.closureStages as string[]) || [],
    sectionDescriptions: {},
  }
}

export interface ParsedStep {
  name: string
  description: string
  price: number | null
  isRequired: boolean
}

export interface ParsedEligibilityItem {
  title: string
  description: string | null
}

export interface ParsedOptionItem {
  name: string
  price: number | null
}

export interface ParsedProtocol {
  serviceName: string
  category: string
  migrated: boolean
  serviceDescription: string
  servicePrice: number | null
  steps: ParsedStep[]
  optionalStages: ParsedOptionItem[]
  allInclusive: { name: string; price: number | null; items: string[] } | null
  saleExecution: string[]
  legalHandoff: string[]
  executionStages?: { name: string; items: string[] }[]
  closureStages: string[]
  statusItems: ParsedEligibilityItem[]
  documentItems: ParsedEligibilityItem[]
  sectionDescriptions: Record<string, string>
}

function extractPrice(text: string): { name: string; price: number | null } {
  const match = text.match(/(.+?)\s*[-–—]\s*([\d\s,]+)(?:\s*pln)?$/i)
  if (match) {
    const priceText = match[2].replace(/\s/g, '').replace(/,/g, '')
    const price = parseInt(priceText, 10)
    if (!isNaN(price)) {
      return { name: match[1].trim(), price }
    }
  }
  return { name: text, price: null }
}

function normalizeHtml(html: string) {
  return html
    .replace(/<\/?strong>/gi, '')
    .replace(/<\/?em>/gi, '')
    .replace(/<\/?span[^>]*>/gi, '')
    .replace(/<\/p>/gi, '\n')
    .replace(/<p>/gi, '\n')
    .replace(/<ul>/gi, '\n[UL_START]\n')
    .replace(/<\/ul>/gi, '\n[UL_END]\n')
    .replace(/<ol>/gi, '\n')
    .replace(/<\/ol>/gi, '\n')
    .replace(/<li>/gi, '\n[LI] ')
    .replace(/<\/li>/gi, '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/&nbsp;/g, ' ')
}

export async function parseServiceProtocol(base64Docx: string): Promise<ParsedProtocol & { error?: string }> {
  try {
    const buffer = Buffer.from(base64Docx, 'base64')
    const htmlResult = await mammoth.convertToHtml({ buffer })
    const raw = normalizeHtml(htmlResult.value)
    const lines = raw
      .split(/\r?\n/)
      .map(l => l.trim())
      .filter(Boolean)

    let serviceDescription = ''
    let servicePrice: number | null = null
    const steps: ParsedStep[] = []
    const optionalStages: ParsedOptionItem[] = []
    let allInclusive: { name: string; price: number | null; items: string[] } | null = null
    const executionStages: { name: string; items: string[] }[] = []
    const closureStages: string[] = []
    const statusItems: ParsedEligibilityItem[] = []
    const documentItems: ParsedEligibilityItem[] = []
    const sectionDescriptions: Record<string, string> = {}

    let topSection: 'outline' | 'eligibility' | 'execution' | 'closure' | null = null
    let subsection = ''
    let inList = false
    let pendingDescription = ''
    let listBuffer: string[] = []

    const isHeading = (text: string, keyword: string) =>
      text.toLowerCase().includes(keyword)

    const flushList = () => {
      if (subsection && pendingDescription) {
        sectionDescriptions[subsection] = pendingDescription
      }

      if (!inList || listBuffer.length === 0) {
        listBuffer = []
        pendingDescription = ''
        inList = false
        return
      }

      if (topSection === 'outline') {
        if (isHeading(subsection, 'mandatory stages')) {
          for (const item of listBuffer) {
            const { name, price } = extractPrice(item)
            steps.push({ name, description: '', price, isRequired: true })
          }
        } else if (isHeading(subsection, 'optional stages') || isHeading(subsection, 'option stages')) {
          for (const item of listBuffer) {
            const { name, price } = extractPrice(item)
            optionalStages.push({ name, price })
          }
        } else if (isHeading(subsection, 'all inclusive')) {
          const { name, price } = extractPrice(subsection)
          allInclusive = { name, price, items: listBuffer.filter(Boolean) }
        }
      } else if (topSection === 'eligibility') {
        const target = isHeading(subsection, 'status')
          ? statusItems
          : documentItems
        for (const item of listBuffer) {
          target.push({ title: item, description: '' })
        }
      } else if (topSection === 'execution') {
        executionStages.push({ name: subsection, items: listBuffer.filter(Boolean) })
      } else if (topSection === 'closure') {
        closureStages.push(...listBuffer.filter(Boolean))
      }

      listBuffer = []
      pendingDescription = ''
      inList = false
    }

    for (const line of lines) {
      if (line === '[UL_START]') {
        inList = true
        continue
      }
      if (line === '[UL_END]') {
        flushList()
        continue
      }

      const lower = line.toLowerCase()

      if (lower.startsWith('description:')) {
        pendingDescription = line.replace(/^description:/i, '').trim()
        continue
      }

      // Top-level sections (DOCX renders these as ordered-list items, so strip [LI])
      if (isHeading(line, 'service outline')) {
        flushList()
        topSection = 'outline'
        subsection = ''
        continue
      }
      if (isHeading(line, 'eligibility verification')) {
        flushList()
        topSection = 'eligibility'
        subsection = ''
        continue
      }
      if (isHeading(line, 'execution and completion')) {
        flushList()
        topSection = 'execution'
        subsection = ''
        continue
      }
      if (isHeading(line, 'service closure')) {
        flushList()
        topSection = 'closure'
        subsection = ''
        continue
      }

      // First "Description:" before any section = service description
      if (!serviceDescription && pendingDescription && !topSection) {
        serviceDescription = pendingDescription
        pendingDescription = ''
        continue
      }

      // Subsection headings
      if (topSection && line && !lower.startsWith('[li] ')) {
        flushList()
        subsection = line
        if (topSection === 'outline' && isHeading(line, 'mandatory stages')) {
          const { price } = extractPrice(line)
          servicePrice = price
        }
        continue
      }

      // Regular list items
      if (lower.startsWith('[li] ')) {
        const item = line.replace(/^\[li\]\s*/i, '').trim()
        if (item) listBuffer.push(item)
        continue
      }
    }

    flushList()

    return {
      serviceName: '',
      category: '',
      migrated: false,
      serviceDescription,
      servicePrice,
      steps,
      optionalStages,
      allInclusive,
      saleExecution: [],
      legalHandoff: [],
      executionStages,
      closureStages,
      statusItems,
      documentItems,
      sectionDescriptions,
    }
  } catch (e: any) {
    return {
      serviceName: '',
      category: '',
      migrated: false,
      serviceDescription: '',
      servicePrice: null,
      steps: [],
      optionalStages: [],
      allInclusive: null,
      saleExecution: [],
      legalHandoff: [],
      executionStages: [],
      closureStages: [],
      statusItems: [],
      documentItems: [],
      sectionDescriptions: {},
      error: e?.message || 'Failed to parse document',
    }
  }
}

export async function createService(name: string): Promise<{ id?: string; error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }
  const { data, error } = await supabase.from('services').insert({ name }).select('id').single()
  if (error) return { error: error.message }
  return { id: data.id }
}

export async function deleteService(serviceId: string): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'Not authenticated' }

  const { error: linkError } = await supabase
    .from('case_services')
    .delete()
    .eq('service_id', serviceId)
  if (linkError) return { success: false, error: linkError.message }

  const { error } = await supabase
    .from('services')
    .delete()
    .eq('id', serviceId)
  if (error) return { success: false, error: error.message }
  return { success: true }
}

export async function saveServiceProtocol(
  serviceId: string,
  data: ParsedProtocol
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'Not authenticated' }

  const protocolExtras = {
    optionalStages: data.optionalStages,
    allInclusive: data.allInclusive,
    saleExecution: data.saleExecution,
    legalHandoff: data.legalHandoff,
    closureStages: data.closureStages,
  }

  const updates: Record<string, unknown> = {
    description: data.serviceDescription,
    gross_price: data.servicePrice,
    protocol_extras: protocolExtras,
    category: data.category || null,
    migrated: data.migrated,
  }
  if (data.serviceName.trim()) {
    updates.name = data.serviceName.trim()
  }

  const { error: svcError } = await supabase
    .from('services')
    .update(updates)
    .eq('id', serviceId)

  if (svcError) return { success: false, error: svcError.message }

  // Replace existing service steps with mandatory steps only
  await supabase.from('service_steps').delete().eq('service_id', serviceId)

  const stepInserts = data.steps.map((step, i) => ({
    service_id: serviceId,
    name: step.name,
    description: step.description,
    position: i * 100,
    is_required: true,
  }))

  if (stepInserts.length > 0) {
    const { error } = await supabase.from('service_steps').insert(stepInserts)
    if (error) return { success: false, error: error.message }
  }

  // Replace existing eligibility items
  await supabase.from('service_eligibility').delete().eq('service_id', serviceId)

  const eligibilityInserts = [
    ...data.statusItems.map((item, i) => ({
      service_id: serviceId,
      type: 'status' as const,
      title: item.title,
      description: item.description,
      position: i,
    })),
    ...data.documentItems.map((item, i) => ({
      service_id: serviceId,
      type: 'documents' as const,
      title: item.title,
      description: item.description,
      position: i,
    })),
  ]

  if (eligibilityInserts.length > 0) {
    const { error } = await supabase.from('service_eligibility').insert(eligibilityInserts)
    if (error) return { success: false, error: error.message }
  }

  return { success: true }
}

// ============================================================
// Usage overview
// ============================================================

/** Heartbeat — bumps users.last_seen_at, throttled to one write per 5 min. */
export async function touchLastSeen() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return

  const { data: me } = await supabase
    .from('users')
    .select('last_seen_at')
    .eq('id', user.id)
    .single()

  const stale = !me?.last_seen_at ||
    Date.now() - new Date(me.last_seen_at).getTime() > 5 * 60 * 1000
  if (stale) {
    await supabase
      .from('users')
      .update({ last_seen_at: new Date().toISOString() })
      .eq('id', user.id)
  }
}

export interface UsageItem {
  id: string
  title: string
  subtitle: string
  date: string | null
  tag: 'new' | 'late' | 'upcoming' | 'reply' | 'review' | 'neglected'
  href: string
}

export interface UsageRow {
  userId: string
  name: string
  role: string | null
  lastSeenAt: string | null
  requestsNew: number
  requestsLate: number
  actionsUpcoming: number
  actionsLate: number
  neglected: number
  requests: UsageItem[]
  actions: UsageItem[]
  neglectedCases: UsageItem[]
}

export async function getUsageOverview(): Promise<{ users: UsageRow[]; error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { users: [], error: 'Not authenticated' }

  const cutoff24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
  const today = new Date().toISOString().slice(0, 10)

  const [usersRes, queriesRes, actionsRes, casesRes] = await Promise.all([
    supabase.from('users').select('id, display_name, email, role, last_seen_at'),
    supabase
      .from('case_queries')
      .select(`
        id, case_id, status, created_at, opened_by, assigned_to,
        case_steps(name),
        cases(case_code, clients(first_name, last_name)),
        case_query_messages(body, created_at)
      `)
      .in('status', ['open', 'answered'])
      .order('created_at', { ascending: false }),
    supabase
      .from('case_entries')
      .select('id, body, due_date, case_id, step_id, cases!inner(case_code, csr_id, assigned_to, clients(first_name, last_name))')
      .eq('kind', 'action')
      .is('completed_at', null)
      .order('due_date', { ascending: true, nullsFirst: false }),
    supabase
      .from('cases')
      .select('id, case_code, csr_id, assigned_to, status:status_id(name), clients(first_name, last_name), step:case_steps!cases_current_step_id_fkey(name, step_type)'),
  ])

  // entry_id for each query so request rows deep-link to the thread entry
  const queryIds = ((queriesRes.data || []) as any[]).map(q => q.id)
  const { data: queryEntries } = queryIds.length
    ? await supabase.from('case_entries').select('id, query_id').in('query_id', queryIds)
    : { data: [] }
  const entryByQuery = new Map((queryEntries || []).map((e: any) => [e.query_id, e.id]))

  const caseLabel = (c: any) =>
    c?.clients ? [c.clients.first_name, c.clients.last_name].filter(Boolean).join(' ') : null

  const requestsByUser: Record<string, UsageItem[]> = {}
  for (const q of (queriesRes.data || []) as any[]) {
    // assigned + open → they must respond; opened + answered → they must review
    const owner = q.status === 'open' ? q.assigned_to : q.opened_by
    if (!owner) continue
    const entryId = entryByQuery.get(q.id) as string | undefined
    const msgs = (q.case_query_messages || []).sort(
      (a: any, b: any) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    )
    const isNew = (q.created_at || '') >= cutoff24h
    const item: UsageItem = {
      id: q.id,
      title: msgs[0]?.body || 'Request',
      subtitle: [caseLabel(q.cases) || q.cases?.case_code, q.case_steps?.name].filter(Boolean).join(' · '),
      date: q.created_at,
      tag: q.status === 'open' ? (isNew ? 'new' : 'late') : 'review',
      href: entryId
        ? `/cases/${q.case_id}/progress/${entryId}`
        : `/cases/${q.case_id}/progress?q=${q.id}`,
    }
    ;(requestsByUser[owner] ??= []).push(item)
  }

  const openActionCaseIds = new Set<string>()
  const actionsByUser: Record<string, UsageItem[]> = {}
  for (const a of (actionsRes.data || []) as any[]) {
    openActionCaseIds.add(a.case_id)
    const isLate = !!a.due_date && a.due_date < today
    const item: UsageItem = {
      id: a.id,
      title: a.body || 'Action',
      subtitle: [caseLabel(a.cases) || a.cases?.case_code].filter(Boolean).join(' · '),
      date: a.due_date,
      tag: isLate ? 'late' : 'upcoming',
      href: `/cases/${a.case_id}/progress${a.step_id ? `?s=${a.step_id}` : ''}`,
    }
    for (const uid of [a.cases?.csr_id, a.cases?.assigned_to].filter(Boolean) as string[]) {
      ;(actionsByUser[uid] ??= []).push(item)
    }
  }

  const neglectedByUser: Record<string, UsageItem[]> = {}
  for (const c of (casesRes.data || []) as any[]) {
    if (!c.step) continue
    if (c.step.step_type === 'presale' || c.step.step_type === 'consultation') continue
    if ((c.status?.name || '').toLowerCase().startsWith('complet')) continue
    if (openActionCaseIds.has(c.id)) continue
    const item: UsageItem = {
      id: c.id,
      title: caseLabel(c) || c.case_code || 'Case',
      subtitle: c.step.name || 'In service',
      date: null,
      tag: 'neglected',
      href: `/cases/${c.id}/progress`,
    }
    for (const uid of [c.csr_id, c.assigned_to].filter(Boolean) as string[]) {
      ;(neglectedByUser[uid] ??= []).push(item)
    }
  }

  const users: UsageRow[] = (usersRes.data || []).map((u: any) => {
    const reqs = requestsByUser[u.id] || []
    const acts = actionsByUser[u.id] || []
    const neg = neglectedByUser[u.id] || []
    return {
      userId: u.id,
      name: u.display_name || u.email || 'User',
      role: u.role ?? null,
      lastSeenAt: u.last_seen_at ?? null,
      requestsNew: reqs.filter(r => r.tag === 'new').length,
      requestsLate: reqs.filter(r => r.tag === 'late').length,
      actionsUpcoming: acts.filter(a => a.tag === 'upcoming').length,
      actionsLate: acts.filter(a => a.tag === 'late').length,
      neglected: neg.length,
      requests: reqs,
      actions: acts,
      neglectedCases: neg,
    }
  })

  users.sort((a, b) => a.name.localeCompare(b.name))
  return { users }
}
