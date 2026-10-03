'use server'

import { createClient } from '@/lib/supabase/server'

export type NotificationKind = 'task' | 'deadline' | 'note' | 'query'

interface NotifyInput {
  kind: NotificationKind
  title: string
  body?: string | null
  link?: string | null
  caseId?: string
  cardId?: string
}

/** Insert one notification per recipient. Never notifies the actor. */
export async function notifyUsers(userIds: (string | null | undefined)[], input: NotifyInput) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return

  const recipients = [...new Set(userIds.filter((id): id is string => !!id))]
    .filter(id => id !== user.id)
  if (recipients.length === 0) return

  await supabase.from('notifications').insert(
    recipients.map(uid => ({
      user_id: uid,
      kind: input.kind,
      title: input.title,
      body: input.body ?? null,
      link: input.link ?? null,
      actor_id: user.id,
      case_id: input.caseId ?? null,
      card_id: input.cardId ?? null,
    }))
  )
}

/** Recipients + label for case-level events (the case CSR + legal). */
export async function getCaseNotifyContext(caseId: string): Promise<{
  recipients: string[]
  caseLabel: string
  actorName: string
}> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const [caseRes, actorRes] = await Promise.all([
    supabase
      .from('cases')
      .select('case_code, csr_id, assigned_to, clients(first_name, last_name)')
      .eq('id', caseId)
      .single(),
    user
      ? supabase.from('users').select('display_name, email').eq('id', user.id).single()
      : Promise.resolve({ data: null }),
  ])

  const c = caseRes.data as any
  const clientName = c?.clients
    ? [c.clients.first_name, c.clients.last_name].filter(Boolean).join(' ')
    : null

  return {
    recipients: [c?.csr_id, c?.assigned_to].filter(Boolean),
    caseLabel: [c?.case_code, clientName].filter(Boolean).join(' · ') || 'a case',
    actorName: actorRes.data?.display_name || actorRes.data?.email || 'Someone',
  }
}

export interface AppNotification {
  id: string
  kind: NotificationKind
  title: string
  body: string | null
  link: string | null
  read_at: string | null
  created_at: string
  actor_name: string | null
}

export async function getMyNotifications(limit = 30): Promise<{
  notifications: AppNotification[]
  unreadCount: number
}> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { notifications: [], unreadCount: 0 }

  const { data } = await supabase
    .from('notifications')
    .select('id, kind, title, body, link, read_at, created_at, actor:users!actor_id(display_name, email)')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(limit)

  const notifications: AppNotification[] = (data || []).map((n: any) => ({
    id: n.id,
    kind: n.kind,
    title: n.title,
    body: n.body,
    link: n.link,
    read_at: n.read_at,
    created_at: n.created_at,
    actor_name: n.actor?.display_name || n.actor?.email || null,
  }))

  return {
    notifications,
    unreadCount: notifications.filter(n => !n.read_at).length,
  }
}

export async function markNotificationRead(id: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return

  await supabase
    .from('notifications')
    .update({ read_at: new Date().toISOString() })
    .eq('id', id)
    .eq('user_id', user.id)
    .is('read_at', null)
}

export async function markAllNotificationsRead() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return

  await supabase
    .from('notifications')
    .update({ read_at: new Date().toISOString() })
    .eq('user_id', user.id)
    .is('read_at', null)
}
