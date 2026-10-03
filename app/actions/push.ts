'use server'

import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import webpush from 'web-push'

export interface PushSubscriptionInput {
  endpoint: string
  keys: { p256dh: string; auth: string }
}

/** Store/refresh the caller's push subscription (upsert on endpoint). */
export async function savePushSubscription(sub: PushSubscriptionInput, userAgent?: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }
  if (!sub?.endpoint || !sub.keys?.p256dh || !sub.keys?.auth) {
    return { error: 'Malformed subscription' }
  }

  const { error } = await supabase
    .from('push_subscriptions')
    .upsert({
      user_id: user.id,
      endpoint: sub.endpoint,
      p256dh: sub.keys.p256dh,
      auth: sub.keys.auth,
      user_agent: userAgent ?? null,
      last_seen_at: new Date().toISOString(),
    }, { onConflict: 'endpoint' })

  if (error) return { error: error.message }
  return { success: true }
}

export async function removePushSubscription(endpoint: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  await supabase
    .from('push_subscriptions')
    .delete()
    .eq('user_id', user.id)
    .eq('endpoint', endpoint)
  return { success: true }
}

/**
 * Fan-out a Web Push to every subscription of the given users.
 * Uses the service-role client: recipients' rows are not visible to
 * the acting user under RLS. Stale endpoints (404/410) are pruned.
 */
export async function sendPushToUsers(
  userIds: string[],
  payload: { title: string; body?: string | null; url?: string | null },
) {
  const pub = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
  const priv = process.env.VAPID_PRIVATE_KEY
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!pub || !priv || !serviceKey || userIds.length === 0) return

  const admin = createAdminClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceKey)
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT || 'mailto:nexus@foreigners.pl',
    pub,
    priv,
  )

  const { data: subs } = await admin
    .from('push_subscriptions')
    .select('endpoint, p256dh, auth')
    .in('user_id', userIds)
  if (!subs?.length) return

  const body = JSON.stringify({
    title: payload.title,
    body: payload.body ?? '',
    url: payload.url || '/home',
  })

  const dead: string[] = []
  await Promise.all(subs.map(async (s) => {
    try {
      await webpush.sendNotification(
        { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
        body,
      )
    } catch (err: any) {
      if (err?.statusCode === 404 || err?.statusCode === 410) {
        dead.push(s.endpoint)
      } else {
        console.error('[push] send failed:', err?.statusCode, err?.message)
      }
    }
  }))

  if (dead.length) {
    await admin.from('push_subscriptions').delete().in('endpoint', dead)
  }
}
