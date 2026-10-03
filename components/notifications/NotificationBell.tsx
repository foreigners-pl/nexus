'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Bell } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { getMyNotifications } from '@/app/actions/notifications'
import { usePaneNavigate } from '@/lib/panes'

export function NotificationBell() {
  const router = useRouter()
  const openPane = usePaneNavigate()
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
