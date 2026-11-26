'use client'

import { useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { savePushSubscription } from '@/app/actions/push'

export function ServiceWorkerRegistrar() {
  useEffect(() => {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) return
    navigator.serviceWorker.register('/sw.js').catch(() => {})

    // Re-link an existing browser subscription to the signed-in account.
    // Subscriptions live per-origin, not per-account — an account switch
    // (or a pruned row) leaves the browser subscribed but the DB row
    // owned by nobody, so pushes silently go nowhere. Upsert heals it.
    const syncSubscription = async () => {
      try {
        const reg = await navigator.serviceWorker.ready
        const sub = await reg.pushManager.getSubscription()
        if (!sub) return
        const j = sub.toJSON() as { endpoint?: string; keys?: { p256dh?: string; auth?: string } }
        if (!j.endpoint || !j.keys?.p256dh || !j.keys?.auth) return
        await savePushSubscription(
          { endpoint: j.endpoint, keys: { p256dh: j.keys.p256dh, auth: j.keys.auth } },
          navigator.userAgent,
        )
      } catch {
        // best-effort — a missed sync only means push stays off
      }
    }

    const supabase = createClient()
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) void syncSubscription()
    })
    // A sign-in after mount should also link the device immediately —
    // no reload needed for push to start working on the new account.
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_IN') void syncSubscription()
    })
    return () => subscription.unsubscribe()
  }, [])
  return null
}
