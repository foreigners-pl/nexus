'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { Bell } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { getMyNotifications } from '@/app/actions/notifications'
import { usePaneNavigate } from '@/lib/panes'

function useUnreadCount() {
  const [unread, setUnread] = useState(0)
  const [userId, setUserId] = useState<string | null>(null)

  const load = useCallback(async () => {
    const { unreadCount } = await getMyNotifications(50)
    setUnread(unreadCount)
  }, [])

  useEffect(() => {
    load()
    const supabase = createClient()
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUserId(session?.user?.id ?? null)
    })
  }, [load])

  // Realtime: bump the badge when a new alert lands
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

  return unread
}

export function NotificationBell() {
  const router = useRouter()
  const openPane = usePaneNavigate()
  const unread = useUnreadCount()

  return (
    <button
      onClick={() => { if (!openPane('/notifications')) router.push('/notifications') }}
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
  )
}

/** Sidebar row for the desktop navbar — same badge, full-width nav styling. */
export function NotificationsNavLink({ collapsed }: { collapsed?: boolean }) {
  const router = useRouter()
  const pathname = usePathname()
  const openPane = usePaneNavigate()
  const unread = useUnreadCount()
  const isActive = pathname === '/notifications'

  return (
    <button
      onClick={() => { if (!openPane('/notifications')) router.push('/notifications') }}
      title={collapsed ? 'Notifications' : undefined}
      className={`flex items-center rounded-lg w-full cursor-pointer text-sm font-medium transition-all duration-200 ${
        isActive
          ? 'bg-[hsl(var(--color-surface-hover))] text-[hsl(var(--color-text-primary))]'
          : 'text-[hsl(var(--color-text-secondary))] hover:bg-[hsl(var(--color-surface-hover))] hover:text-[hsl(var(--color-text-primary))]'
      } ${collapsed ? 'px-3 py-3 justify-center' : 'px-4 py-3 gap-3'}`}
    >
      <span className="flex-shrink-0 relative">
        <Bell className="w-5 h-5" />
        {collapsed && unread > 0 && (
          <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </span>
      {!collapsed && (
        <>
          <span className="whitespace-nowrap flex-1 text-left">Notifications</span>
          {unread > 0 && (
            <span className="px-1.5 py-0.5 bg-red-500 text-white text-[10px] font-bold rounded-full min-w-[18px] text-center">
              {unread > 99 ? '99+' : unread}
            </span>
          )}
        </>
      )}
    </button>
  )
}
