'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import type { ActivityLog, Case, Card, Installment, User } from '@/types/database'
import type { ActivityType } from '@/lib/activity-types'
import { DEFAULT_FEED } from '@/lib/activity-types'

// ============================================
// ACTIVITY LOG ACTIONS
// ============================================

/**
 * Log an activity event for a user
 * This should be called from server actions when events happen
 */
export async function logActivity(params: {
  userId: string           // Who this activity is FOR
  actorId?: string | null  // Who performed the action (null for system)
  actionType: ActivityType // The type of action (case_assigned, task_comment, etc.)
  entityType: 'case' | 'card' | 'installment' | 'invoice'
  entityId: string
  message: string
  metadata?: Record<string, any>
}): Promise<{ id?: string; error?: string }> {
  console.log('🔔 logActivity called:', params)
  
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('activity_log')
    .insert({
      user_id: params.userId,
      actor_id: params.actorId || null,
      action_type: params.actionType,
      entity_type: params.entityType,
      entity_id: params.entityId,
      message: params.message,
      metadata: params.metadata || {},
    })
    .select('id')
    .single()

  if (error) {
    console.error('❌ Error logging activity:', error)
    return { error: error.message }
  }

  console.log('✅ Activity logged:', data?.id)
  
  // Revalidate home page to show new activity
  revalidatePath('/home')
  
  return { id: data?.id }
}

/**
 * Log activity for multiple users at once (e.g., all assignees on a case)
 */
export async function logActivityForUsers(params: {
  userIds: string[]
  actorId?: string | null
  actionType: ActivityType
  entityType: 'case' | 'card' | 'installment' | 'invoice'
  entityId: string
  message: string
  metadata?: Record<string, any>
}): Promise<{ count: number; error?: string }> {
  if (params.userIds.length === 0) return { count: 0 }
  
  const supabase = await createClient()
  
  // Filter out the actor from notifications (don't notify yourself)
  const usersToNotify = params.actorId 
    ? params.userIds.filter(id => id !== params.actorId)
    : params.userIds

  if (usersToNotify.length === 0) return { count: 0 }

  const records = usersToNotify.map(userId => ({
    user_id: userId,
    actor_id: params.actorId || null,
    action_type: params.actionType,
    entity_type: params.entityType,
    entity_id: params.entityId,
    message: params.message,
    metadata: params.metadata || {},
  }))

  const { data, error } = await supabase
    .from('activity_log')
    .insert(records)
    .select('id')

  if (error) {
    console.error('Error logging activities:', error)
    return { count: 0, error: error.message }
  }

  // Revalidate home page to show new activities
  revalidatePath('/home')

  return { count: data?.length || 0 }
}

/**
 * Get activities for the current user, filtered by their feed preferences
 */
export async function getMyActivities(limit = 20): Promise<{ activities: ActivityLog[]; error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) return { activities: [], error: 'Not authenticated' }

  // Get user's feed preferences
  const { data: prefs } = await supabase
    .from('user_activity_preferences')
    .select('show_in_feed')
    .eq('user_id', user.id)
    .single()

  // Use preferences or default (all on)
  const allowedTypes = (prefs?.show_in_feed && prefs.show_in_feed.length > 0) 
    ? prefs.show_in_feed 
    : DEFAULT_FEED

  const { data, error } = await supabase
    .from('activity_log')
    .select('*')
    .eq('user_id', user.id)
    .in('action_type', allowedTypes)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) {
    console.error('Error fetching activities:', error)
    return { activities: [], error: error.message }
  }

  return { activities: data || [] }
}

export async function getUnreadActivityCount(): Promise<{ count: number; error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) return { count: 0, error: 'Not authenticated' }

  const { count, error } = await supabase
    .from('activity_log')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .eq('is_read', false)

  if (error) {
    console.error('Error fetching unread count:', error)
    return { count: 0, error: error.message }
  }

  return { count: count || 0 }
}

export async function markActivityRead(activityId: string): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) return { error: 'Not authenticated' }

  const { error } = await supabase
    .from('activity_log')
    .update({ is_read: true })
    .eq('id', activityId)
    .eq('user_id', user.id)

  if (error) {
    console.error('Error marking activity read:', error)
    return { error: error.message }
  }

  revalidatePath('/home')
  return {}
}

export async function markAllActivitiesRead(): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) return { error: 'Not authenticated' }

  const { error } = await supabase
    .from('activity_log')
    .update({ is_read: true })
    .eq('user_id', user.id)
    .eq('is_read', false)

  if (error) {
    console.error('Error marking all activities read:', error)
    return { error: error.message }
  }

  revalidatePath('/home')
  return {}
}

// ============================================
// WEEKLY TIMELINE ACTIONS
// ============================================

interface TimelineCase extends Case {
  clients?: { first_name?: string; last_name?: string }
  status?: { name: string }
}

interface TimelineCard extends Card {
  boards?: { name: string }
  board_statuses?: { name: string; color?: string }
}

interface TimelineInstallment extends Installment {
  cases?: {
    case_code?: string
    clients?: { first_name?: string; last_name?: string }
  }
}

export async function getWeeklyCases(startDate: string): Promise<{ cases: TimelineCase[]; error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) return { cases: [], error: 'Not authenticated' }

  // Calculate end date (7 days from start)
  const start = new Date(startDate)
  const end = new Date(start)
  end.setDate(end.getDate() + 7)
  const endDateStr = end.toISOString().split('T')[0]

  console.log('[getWeeklyCases] Date range:', startDate, 'to', endDateStr)

  // First get case IDs assigned to this user
  const { data: assignments, error: assignError } = await supabase
    .from('case_assignees')
    .select('case_id')
    .eq('user_id', user.id)

  console.log('[getWeeklyCases] User:', user.id, 'Assignments:', assignments?.length, 'Error:', assignError)

  if (!assignments || assignments.length === 0) {
    return { cases: [] }
  }

  const caseIds = assignments.map(a => a.case_id)
  console.log('[getWeeklyCases] Case IDs:', caseIds)

  // Get cases with due dates in this week
  const { data, error } = await supabase
    .from('cases')
    .select(`
      *,
      clients(first_name, last_name),
      status(name)
    `)
    .in('id', caseIds)
    .gte('due_date', startDate)
    .lt('due_date', endDateStr)
    .order('due_date', { ascending: true })

  console.log('[getWeeklyCases] Cases found:', data?.length, 'Error:', error)
  if (data && data.length > 0) {
    console.log('[getWeeklyCases] First case due_date:', data[0].due_date)
  }

  if (error) {
    console.error('Error fetching weekly cases:', error)
    return { cases: [], error: error.message }
  }

  return { cases: data || [] }
}

export async function getWeeklyCards(startDate: string): Promise<{ cards: TimelineCard[]; error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) return { cards: [], error: 'Not authenticated' }

  // Calculate end date (7 days from start)
  const start = new Date(startDate)
  const end = new Date(start)
  end.setDate(end.getDate() + 7)
  const endDateStr = end.toISOString().split('T')[0]

  // First get card IDs assigned to this user
  const { data: assignments } = await supabase
    .from('card_assignees')
    .select('card_id')
    .eq('user_id', user.id)

  if (!assignments || assignments.length === 0) {
    return { cards: [] }
  }

  const cardIds = assignments.map(a => a.card_id)

  // Get cards with due dates in this week
  const { data, error } = await supabase
    .from('cards')
    .select(`
      *,
      boards(name),
      board_statuses(name, color)
    `)
    .in('id', cardIds)
    .gte('due_date', startDate)
    .lt('due_date', endDateStr)
    .order('due_date', { ascending: true })

  if (error) {
    console.error('Error fetching weekly cards:', error)
    return { cards: [], error: error.message }
  }

  return { cards: data || [] }
}

export async function getWeeklyPayments(startDate: string): Promise<{ payments: TimelineInstallment[]; error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) return { payments: [], error: 'Not authenticated' }

  // Calculate end date (7 days from start)
  const start = new Date(startDate)
  const end = new Date(start)
  end.setDate(end.getDate() + 7)
  const endDateStr = end.toISOString().split('T')[0]

  console.log('[getWeeklyPayments] Date range:', startDate, 'to', endDateStr)

  // First get case IDs assigned to this user
  const { data: assignments } = await supabase
    .from('case_assignees')
    .select('case_id')
    .eq('user_id', user.id)

  console.log('[getWeeklyPayments] Assignments:', assignments?.length)

  if (!assignments || assignments.length === 0) {
    return { payments: [] }
  }

  const caseIds = assignments.map(a => a.case_id)

  // Get unpaid installments from those cases with due dates in this week
  const { data, error } = await supabase
    .from('installments')
    .select(`
      *,
      cases!fk_installments_case(
        case_code,
        clients(first_name, last_name)
      )
    `)
    .in('case_id', caseIds)
    .eq('paid', false)
    .gte('due_date', startDate)
    .lt('due_date', endDateStr)
    .order('due_date', { ascending: true })

  console.log('[getWeeklyPayments] Payments found:', data?.length, 'Error:', error)

  if (error) {
    console.error('Error fetching weekly payments:', error)
    return { payments: [], error: error.message }
  }

  return { payments: data || [] }
}

// Get today's items count (cases, tasks, payments)
export async function getTodayCount(): Promise<{ count: number; error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) return { count: 0, error: 'Not authenticated' }

  const today = new Date().toISOString().split('T')[0]
  const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0]

  // First get case IDs assigned to this user
  const { data: caseAssignments } = await supabase
    .from('case_assignees')
    .select('case_id')
    .eq('user_id', user.id)

  const caseIds = (caseAssignments || []).map(a => a.case_id)

  // Get cases due today
  let casesCount = 0
  if (caseIds.length > 0) {
    const { count } = await supabase
      .from('cases')
      .select('id', { count: 'exact', head: true })
      .in('id', caseIds)
      .gte('due_date', today)
      .lt('due_date', tomorrow)
    casesCount = count || 0
  }

  // Get tasks due today (cards)
  const { count: tasksCount } = await supabase
    .from('cards')
    .select('id', { count: 'exact', head: true })
    .gte('due_date', today)
    .lt('due_date', tomorrow)

  // Get payments due today for assigned cases
  let paymentsCount = 0
  if (caseIds.length > 0) {
    const { count } = await supabase
      .from('installments')
      .select('id', { count: 'exact', head: true })
      .in('case_id', caseIds)
      .eq('paid', false)
      .gte('due_date', today)
      .lt('due_date', tomorrow)
    paymentsCount = count || 0
  }

  return { count: casesCount + (tasksCount || 0) + paymentsCount }
}

// ============================================
// CLAIM QUEUE ACTIONS
// ============================================

interface UnassignedCase extends Case {
  clients?: { first_name?: string; last_name?: string; contact_email?: string }
}

export async function getUnassignedCases(): Promise<{ cases: UnassignedCase[]; error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) return { cases: [], error: 'Not authenticated' }

  // Get cases that have no assignees
  // Using a left join and filtering where assignee is null
  const { data: allCases, error: casesError } = await supabase
    .from('cases')
    .select(`
      *,
      clients(first_name, last_name, contact_email),
      case_assignees(user_id)
    `)
    .order('created_at', { ascending: false })

  if (casesError) {
    console.error('Error fetching cases:', casesError)
    return { cases: [], error: casesError.message }
  }

  // Filter to only unassigned cases (no assignees)
  const unassignedCases = (allCases || []).filter(
    c => !c.case_assignees || c.case_assignees.length === 0
  )

  return { cases: unassignedCases }
}

export async function claimCase(caseId: string): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) return { error: 'Not authenticated' }

  // Insert the current user as an assignee
  const { error } = await supabase
    .from('case_assignees')
    .insert({
      case_id: caseId,
      user_id: user.id
    })

  if (error) {
    console.error('Error claiming case:', error)
    return { error: error.message }
  }

  // Log the claim activity manually (trigger handles assignment notification)
  const { data: caseData } = await supabase
    .from('cases')
    .select('case_code, clients(first_name, last_name)')
    .eq('id', caseId)
    .single()

  if (caseData) {
    const client = Array.isArray(caseData.clients) ? caseData.clients[0] : caseData.clients
    const clientName = client 
      ? [client.first_name, client.last_name].filter(Boolean).join(' ')
      : 'Unknown'
    
    await supabase.from('activity_log').insert({
      user_id: user.id,
      actor_id: user.id,
      action_type: 'claimed',
      entity_type: 'case',
      entity_id: caseId,
      message: `You claimed case ${caseData.case_code || 'Unknown'}`,
      metadata: {
        case_code: caseData.case_code,
        client_name: clientName
      }
    })
  }

  revalidatePath('/home')
  return {}
}

// ============================================
// MY CASES TAB
// ============================================

interface MyCaseItem {
  id: string
  case_code: string | null
  created_at: string
  due_date: string | null
  status: { id: string; name: string; color?: string } | null
  clients: { id: string; first_name?: string; last_name?: string; contact_email?: string } | null
}

export async function getMyCases(searchQuery?: string, statusFilter?: string): Promise<{ cases: MyCaseItem[]; error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) return { cases: [], error: 'Not authenticated' }

  // First get case IDs assigned to this user
  const { data: assignments, error: assignError } = await supabase
    .from('case_assignees')
    .select('case_id')
    .eq('user_id', user.id)

  if (assignError) {
    console.error('Error fetching assignments:', assignError)
    return { cases: [], error: assignError.message }
  }

  if (!assignments || assignments.length === 0) {
    return { cases: [] }
  }

  const caseIds = assignments.map(a => a.case_id)

  // Now fetch those cases
  let query = supabase
    .from('cases')
    .select(`
      id,
      case_code,
      created_at,
      due_date,
      status(id, name, color),
      clients(id, first_name, last_name, contact_email)
    `)
    .in('id', caseIds)
    .order('created_at', { ascending: false })

  if (statusFilter && statusFilter !== 'all') {
    query = query.eq('status_id', statusFilter)
  }

  const { data, error } = await query

  if (error) {
    console.error('Error fetching my cases:', error)
    return { cases: [], error: error.message }
  }

  // Transform data to handle arrays from Supabase
  const cases: MyCaseItem[] = (data || []).map(c => ({
    id: c.id,
    case_code: c.case_code,
    created_at: c.created_at,
    due_date: c.due_date,
    status: Array.isArray(c.status) ? c.status[0] || null : c.status,
    clients: Array.isArray(c.clients) ? c.clients[0] || null : c.clients
  }))

  // Filter by search query if provided
  if (searchQuery) {
    const q = searchQuery.toLowerCase()
    return {
      cases: cases.filter(c => {
        const clientName = [c.clients?.first_name, c.clients?.last_name].filter(Boolean).join(' ').toLowerCase()
        const caseCode = (c.case_code || '').toLowerCase()
        const email = (c.clients?.contact_email || '').toLowerCase()
        return clientName.includes(q) || caseCode.includes(q) || email.includes(q)
      })
    }
  }

  return { cases }
}

// ============================================
// OPEN TASKS TAB
// ============================================

interface OpenTaskItem {
  id: string
  title: string
  description: string | null
  due_date: string | null
  board_id: string
  status_id: string | null
  boards: { id: string; name: string } | null
  board_statuses: { id: string; name: string; color?: string } | null
}

export async function getMyOpenTasks(): Promise<{ tasks: OpenTaskItem[]; error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) return { tasks: [], error: 'Not authenticated' }

  // First get card IDs assigned to this user
  const { data: cardAssignments } = await supabase
    .from('card_assignees')
    .select('card_id')
    .eq('user_id', user.id)

  if (!cardAssignments || cardAssignments.length === 0) {
    return { tasks: [] }
  }

  const cardIds = cardAssignments.map(a => a.card_id)

  // Get those cards
  const { data, error } = await supabase
    .from('cards')
    .select(`
      id,
      title,
      description,
      due_date,
      board_id,
      status_id,
      boards(id, name),
      board_statuses(id, name, color)
    `)
    .in('id', cardIds)
    .order('due_date', { ascending: true, nullsFirst: false })

  if (error) {
    console.error('Error fetching open tasks:', error)
    return { tasks: [], error: error.message }
  }

  // Transform tasks
  const openTasks: OpenTaskItem[] = (data || []).map(t => {
    const boards = Array.isArray(t.boards) ? t.boards[0] || null : t.boards
    const board_statuses = Array.isArray(t.board_statuses) ? t.board_statuses[0] || null : t.board_statuses
    return {
      id: t.id,
      title: t.title,
      description: t.description,
      due_date: t.due_date,
      board_id: t.board_id,
      status_id: t.status_id,
      boards,
      board_statuses
    }
  })

  return { tasks: openTasks }
}

// ============================================
// PENDING PAYMENTS TAB
// ============================================

interface PendingPaymentCase {
  case_id: string
  case_code: string | null
  client_name: string
  total_price: number
  total_paid: number
  total_scheduled: number
  unscheduled: number
  installments: {
    id: string
    amount: number
    due_date: string | null
    paid: boolean
    label: string | null
  }[]
}

export async function getMyPendingPayments(): Promise<{ cases: PendingPaymentCase[]; error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) return { cases: [], error: 'Not authenticated' }

  // First get case IDs assigned to this user
  const { data: assignments } = await supabase
    .from('case_assignees')
    .select('case_id')
    .eq('user_id', user.id)

  if (!assignments || assignments.length === 0) {
    return { cases: [] }
  }

  const caseIds = assignments.map(a => a.case_id)

  // Get those cases with their case_services and installments
  const { data: myCases, error: casesError } = await supabase
    .from('cases')
    .select(`
      id,
      case_code,
      clients(first_name, last_name),
      case_services!fk_case_services_case(
        total_price
      ),
      installments!fk_installments_case(
        id,
        amount,
        due_date,
        paid,
        label
      )
    `)
    .in('id', caseIds)

  if (casesError) {
    console.error('Error fetching pending payments:', casesError)
    return { cases: [], error: casesError.message }
  }

  const pendingCases: PendingPaymentCase[] = []

  for (const c of myCases || []) {
    const client = Array.isArray(c.clients) ? c.clients[0] : c.clients
    const clientName = client ? [client.first_name, client.last_name].filter(Boolean).join(' ') : 'Unknown'
    
    // Calculate totals
    const totalPrice = (c.case_services || []).reduce((sum, s) => sum + (s.total_price || 0), 0)
    const installments = c.installments || []
    const totalPaid = installments.filter(i => i.paid).reduce((sum, i) => sum + (i.amount || 0), 0)
    const totalScheduled = installments.reduce((sum, i) => sum + (i.amount || 0), 0)
    const unscheduled = totalPrice - totalScheduled
    
    // Only include cases with unpaid installments or unscheduled amounts
    const hasUnpaid = installments.some(i => !i.paid)
    
    if (hasUnpaid || unscheduled > 0) {
      pendingCases.push({
        case_id: c.id,
        case_code: c.case_code,
        client_name: clientName,
        total_price: totalPrice,
        total_paid: totalPaid,
        total_scheduled: totalScheduled,
        unscheduled: unscheduled,
        installments: installments.filter(i => !i.paid).sort((a, b) => {
          if (!a.due_date) return 1
          if (!b.due_date) return -1
          return new Date(a.due_date).getTime() - new Date(b.due_date).getTime()
        })
      })
    }
  }

  // Sort by earliest upcoming payment
  pendingCases.sort((a, b) => {
    const aDate = a.installments[0]?.due_date
    const bDate = b.installments[0]?.due_date
    if (!aDate) return 1
    if (!bDate) return -1
    return new Date(aDate).getTime() - new Date(bDate).getTime()
  })

  return { cases: pendingCases }
}

// ============================================
// OVERDUE TAB
// ============================================

interface OverdueCase {
  id: string
  case_code: string | null
  due_date: string
  client_name: string
  days_overdue: number
}

interface OverdueTask {
  id: string
  title: string
  due_date: string
  board_id: string
  board_name: string
  days_overdue: number
}

interface OverduePayment {
  id: string
  case_id: string
  case_code: string | null
  client_name: string
  amount: number
  due_date: string
  days_overdue: number
}

interface OverdueItems {
  cases: OverdueCase[]
  tasks: OverdueTask[]
  payments: OverduePayment[]
}

export async function getMyOverdueItems(): Promise<{ items: OverdueItems; error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) return { items: { cases: [], tasks: [], payments: [] }, error: 'Not authenticated' }

  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const todayStr = today.toISOString().split('T')[0]

  // First get case IDs assigned to this user
  const { data: caseAssignments } = await supabase
    .from('case_assignees')
    .select('case_id')
    .eq('user_id', user.id)

  const caseIds = (caseAssignments || []).map(a => a.case_id)

  // Get overdue cases
  const { data: overdueCases } = caseIds.length > 0 ? await supabase
    .from('cases')
    .select(`
      id,
      case_code,
      due_date,
      clients(first_name, last_name)
    `)
    .in('id', caseIds)
    .lt('due_date', todayStr)
    .order('due_date', { ascending: true }) : { data: [] }

  // Get card IDs assigned to this user
  const { data: cardAssignments } = await supabase
    .from('card_assignees')
    .select('card_id')
    .eq('user_id', user.id)

  const cardIds = (cardAssignments || []).map(a => a.card_id)

  // Get overdue tasks (cards not complete)
  const { data: overdueTasks } = cardIds.length > 0 ? await supabase
    .from('cards')
    .select(`
      id,
      title,
      due_date,
      board_id,
      boards(name),
      board_statuses(name, color)
    `)
    .in('id', cardIds)
    .lt('due_date', todayStr)
    .order('due_date', { ascending: true }) : { data: [] }

  // Get overdue payments for assigned cases
  const { data: overduePayments } = caseIds.length > 0 ? await supabase
    .from('installments')
    .select(`
      id,
      amount,
      due_date,
      case_id,
      cases!fk_installments_case(
        case_code,
        clients(first_name, last_name)
      )
    `)
    .in('case_id', caseIds)
    .eq('paid', false)
    .lt('due_date', todayStr)
    .order('due_date', { ascending: true }) : { data: [] }

  const calcDaysOverdue = (dateStr: string) => {
    const date = new Date(dateStr)
    return Math.floor((today.getTime() - date.getTime()) / (1000 * 60 * 60 * 24))
  }

  const cases: OverdueCase[] = (overdueCases || []).map(c => {
    const client = Array.isArray(c.clients) ? c.clients[0] : c.clients
    return {
      id: c.id,
      case_code: c.case_code,
      due_date: c.due_date!,
      client_name: client ? [client.first_name, client.last_name].filter(Boolean).join(' ') : 'Unknown',
      days_overdue: calcDaysOverdue(c.due_date!)
    }
  })

  const tasks: OverdueTask[] = (overdueTasks || []).map(t => {
    const boards = Array.isArray(t.boards) ? t.boards[0] : t.boards
    return {
      id: t.id,
      title: t.title,
      due_date: t.due_date!,
      board_id: t.board_id,
      board_name: boards?.name || 'Unknown',
      days_overdue: calcDaysOverdue(t.due_date!)
    }
  })

  const payments: OverduePayment[] = (overduePayments || []).map(p => {
    const caseData = Array.isArray(p.cases) ? p.cases[0] : p.cases
    const client = Array.isArray(caseData?.clients) ? caseData?.clients[0] : caseData?.clients
    return {
      id: p.id,
      case_id: p.case_id,
      case_code: caseData?.case_code || null,
      client_name: client ? [client.first_name, client.last_name].filter(Boolean).join(' ') : 'Unknown',
      amount: p.amount,
      due_date: p.due_date!,
      days_overdue: calcDaysOverdue(p.due_date!)
    }
  })

  return { items: { cases, tasks, payments } }
}

// ============================================
// DASHBOARD STATS
// ============================================

interface DashboardStats {
  myCasesCount: number
  myTasksCount: number
  pendingPaymentsTotal: number
  overdueCount: number
}

export async function getDashboardStats(): Promise<{ stats: DashboardStats; error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) return { stats: { myCasesCount: 0, myTasksCount: 0, pendingPaymentsTotal: 0, overdueCount: 0 }, error: 'Not authenticated' }

  const today = new Date().toISOString().split('T')[0]

  // Get my cases count
  const { count: casesCount } = await supabase
    .from('case_assignees')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', user.id)

  // Get my tasks (cards) count
  const { count: tasksCount } = await supabase
    .from('card_assignees')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', user.id)

  // Get case IDs assigned to this user
  const { data: caseAssignments } = await supabase
    .from('case_assignees')
    .select('case_id')
    .eq('user_id', user.id)

  const caseIds = (caseAssignments || []).map(a => a.case_id)

  // Get card IDs assigned to this user
  const { data: cardAssignments } = await supabase
    .from('card_assignees')
    .select('card_id')
    .eq('user_id', user.id)

  const cardIds = (cardAssignments || []).map(a => a.card_id)

  // Get pending payments total from my cases
  let pendingTotal = 0
  if (caseIds.length > 0) {
    const { data: myInstallments } = await supabase
      .from('installments')
      .select('amount')
      .in('case_id', caseIds)
      .eq('paid', false)
    pendingTotal = (myInstallments || []).reduce((sum, inst) => sum + (inst.amount || 0), 0)
  }

  // Get overdue cases count
  let overdueCasesCount = 0
  if (caseIds.length > 0) {
    const { count } = await supabase
      .from('cases')
      .select('id', { count: 'exact', head: true })
      .in('id', caseIds)
      .lt('due_date', today)
    overdueCasesCount = count || 0
  }

  // Get overdue cards count
  let overdueCardsCount = 0
  if (cardIds.length > 0) {
    const { count } = await supabase
      .from('cards')
      .select('id', { count: 'exact', head: true })
      .in('id', cardIds)
      .lt('due_date', today)
    overdueCardsCount = count || 0
  }

  // Get overdue payments count
  let overduePaymentsCount = 0
  if (caseIds.length > 0) {
    const { count } = await supabase
      .from('installments')
      .select('id', { count: 'exact', head: true })
      .in('case_id', caseIds)
      .eq('paid', false)
      .lt('due_date', today)
    overduePaymentsCount = count || 0
  }

  return {
    stats: {
      myCasesCount: casesCount || 0,
      myTasksCount: tasksCount || 0,
      pendingPaymentsTotal: pendingTotal,
      overdueCount: overdueCasesCount + overdueCardsCount + overduePaymentsCount
    }
  }
}

// ============================================
// CURRENT USER
// ============================================

export async function getCurrentUser(): Promise<{ user: User | null; error?: string }> {
  const supabase = await createClient()
  const { data: { user: authUser } } = await supabase.auth.getUser()
  
  if (!authUser) return { user: null, error: 'Not authenticated' }

  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('id', authUser.id)
    .single()

  if (error) {
    console.error('Error fetching user:', error)
    return { user: null, error: error.message }
  }

  return { user: data }
}

// ============================================
// CONSOLIDATED DASHBOARD DATA LOADER
// ============================================

export interface DashboardData {
  user: User | null
  activities: ActivityLog[]
  unassignedCases: any[]
  myCases: any[]
  myTasks: any[]
  myPayments: any[]
  myOverdue: { cases: any[]; tasks: any[]; payments: any[] }
  todayCount: number
  todayCounts: { cases: number; tasks: number; payments: number }
}

export async function getAllDashboardData(): Promise<{ data: DashboardData; error?: string }> {
  const supabase = await createClient()
  const { data: { user: authUser } } = await supabase.auth.getUser()
  
  if (!authUser) {
    return { 
      data: {
        user: null,
        activities: [],
        unassignedCases: [],
        myCases: [],
        myTasks: [],
        myPayments: [],
        myOverdue: { cases: [], tasks: [], payments: [] },
        todayCount: 0,
        todayCounts: { cases: 0, tasks: 0, payments: 0 }
      },
      error: 'Not authenticated' 
    }
  }

  // Use local date formatting to avoid timezone issues
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
  const tomorrow = new Date(today)
  tomorrow.setDate(tomorrow.getDate() + 1)
  const tomorrowStr = `${tomorrow.getFullYear()}-${String(tomorrow.getMonth() + 1).padStart(2, '0')}-${String(tomorrow.getDate()).padStart(2, '0')}`

  // Fetch user profile, case assignments, and card assignments in parallel
  const [
    userResult,
    activitiesResult,
    caseAssignmentsResult,
    cardAssignmentsResult
  ] = await Promise.all([
    supabase.from('users').select('*').eq('id', authUser.id).single(),
    supabase.from('activity_log').select('*').eq('user_id', authUser.id).order('created_at', { ascending: false }).limit(15),
    supabase.from('case_assignees').select('case_id').eq('user_id', authUser.id),
    supabase.from('card_assignees').select('card_id').eq('user_id', authUser.id)
  ])

  const caseIds = (caseAssignmentsResult.data || []).map(a => a.case_id)
  const cardIds = (cardAssignmentsResult.data || []).map(a => a.card_id)

  // Now fetch all case-related and card-related data in parallel
  const [
    allCasesResult,
    myCasesResult,
    myCardsResult,
    myInstallmentsResult,
    overdueCasesResult,
    overdueCardsResult,
    overdueInstallmentsResult,
    todayCasesResult,
    todayCardsResult,
    todayInstallmentsResult
  ] = await Promise.all([
    // Unassigned cases (all cases with their assignees)
    supabase.from('cases').select('*, clients(first_name, last_name, contact_email), case_assignees(user_id)').order('created_at', { ascending: false }),
    // My cases
    caseIds.length > 0 
      ? supabase.from('cases').select('id, case_code, created_at, due_date, status(id, name, color), clients(id, first_name, last_name, contact_email)').in('id', caseIds).order('created_at', { ascending: false })
      : Promise.resolve({ data: [] }),
    // My cards/tasks
    cardIds.length > 0
      ? supabase.from('cards').select('id, title, description, due_date, board_id, status_id, boards(id, name), board_statuses(id, name, color)').in('id', cardIds).order('due_date', { ascending: true, nullsFirst: false })
      : Promise.resolve({ data: [] }),
    // My installments (for pending payments)
    caseIds.length > 0
      ? supabase.from('cases').select('id, case_code, clients(first_name, last_name), case_services!fk_case_services_case(total_price), installments!fk_installments_case(id, amount, due_date, paid, label)').in('id', caseIds)
      : Promise.resolve({ data: [] }),
    // Overdue cases
    caseIds.length > 0
      ? supabase.from('cases').select('id, case_code, due_date, clients(first_name, last_name)').in('id', caseIds).lt('due_date', todayStr).order('due_date', { ascending: true })
      : Promise.resolve({ data: [] }),
    // Overdue cards
    cardIds.length > 0
      ? supabase.from('cards').select('id, title, due_date, board_id, boards(name), board_statuses(name, color)').in('id', cardIds).lt('due_date', todayStr).order('due_date', { ascending: true })
      : Promise.resolve({ data: [] }),
    // Overdue installments
    caseIds.length > 0
      ? supabase.from('installments').select('id, amount, due_date, case_id, cases!fk_installments_case(case_code, clients(first_name, last_name))').in('case_id', caseIds).eq('paid', false).lt('due_date', todayStr).order('due_date', { ascending: true })
      : Promise.resolve({ data: [] }),
    // Today's cases
    caseIds.length > 0
      ? supabase.from('cases').select('id', { count: 'exact', head: true }).in('id', caseIds).gte('due_date', todayStr).lt('due_date', tomorrowStr)
      : Promise.resolve({ count: 0 }),
    // Today's cards
    cardIds.length > 0
      ? supabase.from('cards').select('id', { count: 'exact', head: true }).in('id', cardIds).gte('due_date', todayStr).lt('due_date', tomorrowStr)
      : Promise.resolve({ count: 0 }),
    // Today's installments
    caseIds.length > 0
      ? supabase.from('installments').select('id', { count: 'exact', head: true }).in('case_id', caseIds).eq('paid', false).gte('due_date', todayStr).lt('due_date', tomorrowStr)
      : Promise.resolve({ count: 0 })
  ])

  // Process unassigned cases
  const unassignedCases = (allCasesResult.data || []).filter(
    c => !c.case_assignees || c.case_assignees.length === 0
  )

  // Process my cases
  const myCases = (myCasesResult.data || []).map(c => ({
    id: c.id,
    case_code: c.case_code,
    created_at: c.created_at,
    due_date: c.due_date,
    status: Array.isArray(c.status) ? c.status[0] || null : c.status,
    clients: Array.isArray(c.clients) ? c.clients[0] || null : c.clients
  }))

  // Process my tasks
  const myTasks = (myCardsResult.data || []).map(t => ({
    id: t.id,
    title: t.title,
    description: t.description,
    due_date: t.due_date,
    board_id: t.board_id,
    status_id: t.status_id,
    boards: Array.isArray(t.boards) ? t.boards[0] || null : t.boards,
    board_statuses: Array.isArray(t.board_statuses) ? t.board_statuses[0] || null : t.board_statuses
  }))

  // Process pending payments
  const myPayments: any[] = []
  for (const c of myInstallmentsResult.data || []) {
    const client = Array.isArray(c.clients) ? c.clients[0] : c.clients
    const clientName = client ? [client.first_name, client.last_name].filter(Boolean).join(' ') : 'Unknown'
    const totalPrice = (c.case_services || []).reduce((sum: number, s: any) => sum + (s.total_price || 0), 0)
    const installments = c.installments || []
    const totalPaid = installments.filter((i: any) => i.paid).reduce((sum: number, i: any) => sum + (i.amount || 0), 0)
    const totalScheduled = installments.reduce((sum: number, i: any) => sum + (i.amount || 0), 0)
    const unscheduled = totalPrice - totalScheduled
    const hasUnpaid = installments.some((i: any) => !i.paid)
    
    if (hasUnpaid || unscheduled > 0) {
      myPayments.push({
        case_id: c.id,
        case_code: c.case_code,
        client_name: clientName,
        total_price: totalPrice,
        total_paid: totalPaid,
        total_scheduled: totalScheduled,
        unscheduled: unscheduled,
        installments: installments.filter((i: any) => !i.paid).sort((a: any, b: any) => {
          if (!a.due_date) return 1
          if (!b.due_date) return -1
          return new Date(a.due_date).getTime() - new Date(b.due_date).getTime()
        })
      })
    }
  }

  // Process overdue items
  const calcDaysOverdue = (dateStr: string) => {
    const date = new Date(dateStr)
    return Math.floor((today.getTime() - date.getTime()) / (1000 * 60 * 60 * 24))
  }

  const overdueCases = (overdueCasesResult.data || []).map(c => {
    const client = Array.isArray(c.clients) ? c.clients[0] : c.clients
    return {
      id: c.id,
      case_code: c.case_code,
      due_date: c.due_date!,
      client_name: client ? [client.first_name, client.last_name].filter(Boolean).join(' ') : 'Unknown',
      days_overdue: calcDaysOverdue(c.due_date!)
    }
  })

  const overdueTasks = (overdueCardsResult.data || []).map(t => {
    const boards = Array.isArray(t.boards) ? t.boards[0] : t.boards
    return {
      id: t.id,
      title: t.title,
      due_date: t.due_date!,
      board_id: t.board_id,
      board_name: boards?.name || 'Unknown',
      days_overdue: calcDaysOverdue(t.due_date!)
    }
  })

  const overduePayments = (overdueInstallmentsResult.data || []).map(p => {
    const caseData = Array.isArray(p.cases) ? p.cases[0] : p.cases
    const client = Array.isArray(caseData?.clients) ? caseData?.clients[0] : caseData?.clients
    return {
      id: p.id,
      case_id: p.case_id,
      case_code: caseData?.case_code || null,
      client_name: client ? [client.first_name, client.last_name].filter(Boolean).join(' ') : 'Unknown',
      amount: p.amount,
      due_date: p.due_date!,
      days_overdue: calcDaysOverdue(p.due_date!)
    }
  })

  // Calculate today count
  const todayCasesCount = todayCasesResult.count || 0
  const todayTasksCount = todayCardsResult.count || 0
  const todayPaymentsCount = todayInstallmentsResult.count || 0
  const todayCount = todayCasesCount + todayTasksCount + todayPaymentsCount

  return {
    data: {
      user: userResult.data,
      activities: activitiesResult.data || [],
      unassignedCases,
      myCases,
      myTasks,
      myPayments,
      myOverdue: { cases: overdueCases, tasks: overdueTasks, payments: overduePayments },
      todayCount,
      todayCounts: { cases: todayCasesCount, tasks: todayTasksCount, payments: todayPaymentsCount }
    }
  }
}