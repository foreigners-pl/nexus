'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import {
  Bell,
  ListChecks,
  CalendarClock,
  StickyNote,
  MessageSquare,
  Loader2,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import {
  getMyNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  type AppNotification,
} from '@/app/actions/notifications'
import { savePushSubscription } from '@/app/actions/push'
import { usePaneNavigate } from '@/lib/panes'
import { MobileBackHeader } from '@/components/mobile/MobileBackHeader'

function urlB64ToUint8Array(v: string): Uint8Array<ArrayBuffer> {
  const pad = '='.repeat((4 - (v.length % 4)) % 4)
  const b64 = (v + pad).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(b64)
  const out = new Uint8Array(new ArrayBuffer(raw.length))
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i)
  return out
}

const KIND_META: Record<AppNotification['kind'], { icon: typeof Bell; cls: string }> = {
  task: { icon: ListChecks, cls: 'bg-purple-500/15 text-purple-400' },
  deadline: { icon: CalendarClock, cls: 'bg-orange-500/15 text-orange-400' },
  note: { icon: StickyNote, cls: 'bg-[hsl(var(--color-surface-active))] text-[hsl(var(--color-text-secondary))]' },
  query: { icon: MessageSquare, cls: 'bg-blue-500/15 text-blue-400' },
}

function timeAgo(iso: string) {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000)
  if (s < 60) return 'just now'
  const m = Math.floor(s / 60)
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}

export function NotificationsContent() {
  const router = useRouter()
  const openPane = usePaneNavigate()
  const [notifications, setNotifications] = useState<AppNotification[] | null>(null)
  const [unread, setUnread] = useState(0)
  const [userId, setUserId] = useState<string | null>(null)
  const [pushState, setPushState] = useState<'unknown' | 'unsupported' | 'denied' | 'off' | 'on'>('unknown')
  const [pushBusy, setPushBusy] = useState(false)
  const [pushError, setPushError] = useState<string | null>(null)

  const load = useCallback(async () => {
    const { notifications, unreadCount } = await getMyNotifications(50)
    setNotifications(notifications)
    setUnread(unreadCount)
  }, [])

  useEffect(() => {
    load()
    const supabase = createClient()
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUserId(session?.user?.id ?? null)
    })
  }, [load])

  useEffect(() => {
    if (!userId) return
    const supabase = createClient()
    const channel = supabase
      .channel('notifications-page')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'user_alerts', filter: `user_id=eq.${userId}` },
        () => load()
      )
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [userId, load])

  useEffect(() => {
    if (typeof Notification === 'undefined' || !('serviceWorker' in navigator) || !('PushManager' in window)) {
      setPushState('unsupported')
      return
    }
    if (Notification.permission === 'denied') { setPushState('denied'); return }
    navigator.serviceWorker.ready
      .then(r => r.pushManager.getSubscription())
      .then(s => setPushState(s ? 'on' : 'off'))
      .catch(() => setPushState('off'))
  }, [])

  const enablePush = async () => {
    setPushBusy(true)
    setPushError(null)
    try {
      const perm = await Notification.requestPermission()
      if (perm !== 'granted') { setPushState(perm === 'denied' ? 'denied' : 'off'); return }
      const reg = await navigator.serviceWorker.ready
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlB64ToUint8Array(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || ''),
      })
      const j = sub.toJSON() as { endpoint?: string; keys?: { p256dh?: string; auth?: string } }
      if (!j.endpoint || !j.keys?.p256dh || !j.keys?.auth) {
        throw new Error('Browser returned an incomplete subscription')
      }
      const res = await savePushSubscription(
        { endpoint: j.endpoint, keys: { p256dh: j.keys.p256dh, auth: j.keys.auth } },
        navigator.userAgent,
      )
      if (res && 'error' in res && res.error) throw new Error(res.error)
      setPushState('on')
    } catch (e) {
      console.error('push subscribe failed:', e)
      setPushError(e instanceof Error ? e.message : 'Could not enable push')
    } finally {
      setPushBusy(false)
    }
  }

  const openNotification = async (n: AppNotification) => {
    if (!n.read_at) {
      setNotifications(prev => prev?.map(x => x.id === n.id ? { ...x, read_at: new Date().toISOString() } : x) ?? prev)
      setUnread(u => Math.max(0, u - 1))
      markNotificationRead(n.id)
    }
    if (n.link && !openPane(n.link)) router.push(n.link)
  }

  const markAll = async () => {
    const now = new Date().toISOString()
    setNotifications(prev => prev?.map(x => ({ ...x, read_at: x.read_at ?? now })) ?? prev)
    setUnread(0)
    await markAllNotificationsRead()
  }

  return (
    <div className="space-y-4">
      <MobileBackHeader title="Notifications" />

      {pushState !== 'on' && pushState !== 'unknown' && (
        <div className="bg-[hsl(var(--color-surface))] border border-[hsl(var(--color-border))] rounded-2xl px-4 py-3.5">
          {pushState === 'denied' ? (
            <p className="text-xs text-[hsl(var(--color-text-muted))]">
              Notifications are blocked in your browser settings — allow them to get alerts on this device.
            </p>
          ) : pushState === 'unsupported' ? (
            <p className="text-xs text-[hsl(var(--color-text-muted))]">
              Push notifications are not supported in this browser.
            </p>
          ) : (
            <>
              <button
                onClick={enablePush}
                disabled={pushBusy}
                className="w-full h-10 rounded-xl bg-[hsl(var(--color-primary))] text-white text-sm font-semibold active:bg-[hsl(var(--color-primary-hover))] disabled:opacity-50 flex items-center justify-center gap-2"
              >
                <Bell className="w-4 h-4" />
                {pushBusy ? 'Enabling…' : 'Enable push notifications'}
              </button>
              {pushError && (
                <p className="text-xs text-red-400 mt-1.5">{pushError}</p>
              )}
            </>
          )}
        </div>
      )}

      {unread > 0 && (
        <div className="flex items-center justify-between px-1">
          <p className="text-xs text-[hsl(var(--color-text-secondary))]">{unread} unread</p>
          <button onClick={markAll} className="text-xs font-medium text-[hsl(var(--color-primary))]">
            Mark all read
          </button>
        </div>
      )}

      {!notifications ? (
        <div className="flex justify-center py-10">
          <Loader2 className="w-5 h-5 animate-spin text-[hsl(var(--color-text-muted))]" />
        </div>
      ) : notifications.length === 0 ? (
        <div className="bg-[hsl(var(--color-surface))] border border-[hsl(var(--color-border))] rounded-2xl p-8 text-center">
          <p className="text-sm text-[hsl(var(--color-text-secondary))]">No notifications yet</p>
        </div>
      ) : (
        <ul className="bg-[hsl(var(--color-surface))] border border-[hsl(var(--color-border))] rounded-2xl divide-y divide-[hsl(var(--color-border))] overflow-hidden">
          {notifications.map(n => {
            const meta = KIND_META[n.kind] || KIND_META.note
            const Icon = meta.icon
            return (
              <li key={n.id}>
                <button
                  onClick={() => openNotification(n)}
                  className="w-full flex gap-3 px-4 py-3.5 text-left active:bg-[hsl(var(--color-surface-hover))]"
                >
                  <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${meta.cls}`}>
                    <Icon className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm ${n.read_at ? 'text-[hsl(var(--color-text-secondary))]' : 'font-semibold text-[hsl(var(--color-text-primary))]'}`}>
                      {n.title}
                    </p>
                    {n.body && (
                      <p className="text-xs text-[hsl(var(--color-text-muted))] mt-0.5 line-clamp-2">
                        {n.body}
                      </p>
                    )}
                    <p className="text-[10px] text-[hsl(var(--color-text-muted))] mt-1">
                      {timeAgo(n.created_at)}
                    </p>
                  </div>
                  {!n.read_at && (
                    <span className="w-2 h-2 rounded-full bg-[hsl(var(--color-primary))] shrink-0 mt-2" />
                  )}
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
