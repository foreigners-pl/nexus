'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import {
  Bell,
  ListChecks,
  CalendarClock,
  StickyNote,
  MessageSquare,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import {
  getMyNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  type AppNotification,
} from '@/app/actions/notifications'
import { savePushSubscription } from '@/app/actions/push'

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

export function NotificationBell() {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [notifications, setNotifications] = useState<AppNotification[]>([])
  const [unread, setUnread] = useState(0)
  const [userId, setUserId] = useState<string | null>(null)
  const [pushState, setPushState] = useState<'unknown' | 'unsupported' | 'denied' | 'off' | 'on'>('unknown')
  const [pushBusy, setPushBusy] = useState(false)
  const [pushError, setPushError] = useState<string | null>(null)

  const load = useCallback(async () => {
    const { notifications, unreadCount } = await getMyNotifications()
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

  // Realtime: new notifications arrive while the app is open
  useEffect(() => {
    if (!userId) return
    const supabase = createClient()
    const channel = supabase
      .channel('notifications-bell')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'user_alerts', filter: `user_id=eq.${userId}` },
        () => load()
      )
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [userId, load])

  // Detect existing push subscription state
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
    setOpen(false)
    if (!n.read_at) {
      setNotifications(prev => prev.map(x => x.id === n.id ? { ...x, read_at: new Date().toISOString() } : x))
      setUnread(u => Math.max(0, u - 1))
      markNotificationRead(n.id)
    }
    if (n.link) router.push(n.link)
  }

  const markAll = async () => {
    const now = new Date().toISOString()
    setNotifications(prev => prev.map(x => ({ ...x, read_at: x.read_at ?? now })))
    setUnread(0)
    await markAllNotificationsRead()
  }

  return (
    <div className="relative">
      <button
        onClick={() => { setOpen(o => !o); if (!open) load() }}
        className="relative w-10 h-10 rounded-xl flex items-center justify-center text-[hsl(var(--color-text-secondary))] active:bg-[hsl(var(--color-surface-active))]"
        aria-label="Notifications"
      >
        <Bell className="w-5 h-5" />
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center">
            {unread > 99 ? '99+' : unread}
          </span>
        )}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-12 z-50 w-[min(22rem,calc(100vw-2rem))] bg-[hsl(var(--color-surface))] border border-[hsl(var(--color-border))] rounded-2xl shadow-2xl shadow-black/50 overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-[hsl(var(--color-border))]">
              <p className="text-sm font-semibold text-[hsl(var(--color-text-primary))]">Notifications</p>
              {unread > 0 && (
                <button onClick={markAll} className="text-xs font-medium text-[hsl(var(--color-primary))]">
                  Mark all read
                </button>
              )}
            </div>

            {pushState !== 'on' && pushState !== 'unknown' && (
              <div className="px-4 py-2.5 border-b border-[hsl(var(--color-border))]">
                {pushState === 'denied' ? (
                  <p className="text-xs text-[hsl(var(--color-text-muted))]">
                    Notifications are blocked in browser settings
                  </p>
                ) : pushState === 'unsupported' ? (
                  <p className="text-xs text-[hsl(var(--color-text-muted))]">
                    Push is not supported in this browser
                  </p>
                ) : (
                  <>
                    <button
                      onClick={enablePush}
                      disabled={pushBusy}
                      className="w-full h-9 rounded-lg bg-[hsl(var(--color-primary))] text-white text-xs font-semibold active:bg-[hsl(var(--color-primary-hover))] disabled:opacity-50"
                    >
                      {pushBusy ? 'Enabling…' : 'Enable push notifications'}
                    </button>
                    {pushError && (
                      <p className="text-xs text-red-400 mt-1.5">{pushError}</p>
                    )}
                  </>
                )}
              </div>
            )}

            {notifications.length === 0 ? (
              <p className="text-sm text-[hsl(var(--color-text-muted))] px-4 py-8 text-center">
                Nothing yet
              </p>
            ) : (
              <ul className="max-h-[60vh] overflow-y-auto divide-y divide-[hsl(var(--color-border))]">
                {notifications.map(n => {
                  const meta = KIND_META[n.kind] || KIND_META.note
                  const Icon = meta.icon
                  return (
                    <li key={n.id}>
                      <button
                        onClick={() => openNotification(n)}
                        className="w-full flex gap-3 px-4 py-3 text-left active:bg-[hsl(var(--color-surface-hover))]"
                      >
                        <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${meta.cls}`}>
                          <Icon className="w-4 h-4" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className={`text-sm truncate ${n.read_at ? 'text-[hsl(var(--color-text-secondary))]' : 'font-semibold text-[hsl(var(--color-text-primary))]'}`}>
                            {n.title}
                          </p>
                          {n.body && (
                            <p className="text-xs text-[hsl(var(--color-text-muted))] truncate mt-0.5">
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
        </>
      )}
    </div>
  )
}
