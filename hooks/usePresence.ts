'use client'

import { useEffect, useState, useCallback, useRef, useMemo } from 'react'
import { createBrowserClient } from '@supabase/ssr'
import { RealtimeChannel } from '@supabase/supabase-js'

/**
 * Hook to track online/offline status of users using Supabase Presence
 * 
 * Usage:
 * const { onlineUsers, isOnline } = usePresence(currentUserId)
 * const userIsOnline = isOnline('some-user-id')
 */
export function usePresence(currentUserId: string | null) {
  console.log('[Presence] Hook called with userId:', currentUserId)
  
  const [onlineUsers, setOnlineUsers] = useState<Set<string>>(new Set())
  const channelRef = useRef<RealtimeChannel | null>(null)
  const heartbeatRef = useRef<NodeJS.Timeout | null>(null)

  // Memoize supabase client to prevent re-creation on every render
  const supabase = useMemo(() => createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  ), [])

  useEffect(() => {
    if (!currentUserId) {
      console.log('[Presence] No currentUserId, skipping')
      return
    }

    console.log('[Presence] Setting up presence for user:', currentUserId)

    // Create presence channel
    const presenceChannel = supabase.channel('online-users', {
      config: {
        presence: {
          key: currentUserId,
        },
      },
    })

    // Handle presence sync (initial state + updates)
    presenceChannel.on('presence', { event: 'sync' }, () => {
      const state = presenceChannel.presenceState()
      const online = new Set<string>()
      
      // Each key in state is a unique presence key (user_id)
      Object.keys(state).forEach(userId => {
        online.add(userId)
      })
      
      console.log('[Presence] Sync - online users:', Array.from(online))
      setOnlineUsers(online)
    })

    // Handle user joining
    presenceChannel.on('presence', { event: 'join' }, ({ key }) => {
      console.log('[Presence] User joined:', key)
      setOnlineUsers(prev => {
        const next = new Set(prev)
        next.add(key)
        return next
      })
    })

    // Handle user leaving
    presenceChannel.on('presence', { event: 'leave' }, ({ key }) => {
      console.log('[Presence] User left:', key)
      setOnlineUsers(prev => {
        const next = new Set(prev)
        next.delete(key)
        return next
      })
    })

    // Subscribe and track own presence
    presenceChannel.subscribe(async (status) => {
      console.log('[Presence] Channel status:', status)
      if (status === 'SUBSCRIBED') {
        const trackResult = await presenceChannel.track({
          user_id: currentUserId,
          online_at: new Date().toISOString(),
        })
        console.log('[Presence] Track result:', trackResult)
      }
    })

    channelRef.current = presenceChannel

    // Heartbeat: Re-track presence every 30 seconds to stay alive in background tabs
    // This prevents the browser from marking us as offline when tab is not focused
    heartbeatRef.current = setInterval(async () => {
      if (presenceChannel.state === 'joined') {
        await presenceChannel.track({
          user_id: currentUserId,
          online_at: new Date().toISOString(),
        })
      }
    }, 30000) // Every 30 seconds

    // Also re-track when tab becomes visible again
    const handleVisibilityChange = async () => {
      if (document.visibilityState === 'visible' && presenceChannel.state === 'joined') {
        await presenceChannel.track({
          user_id: currentUserId,
          online_at: new Date().toISOString(),
        })
      }
    }
    document.addEventListener('visibilitychange', handleVisibilityChange)

    // Cleanup on unmount
    return () => {
      if (heartbeatRef.current) {
        clearInterval(heartbeatRef.current)
      }
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      presenceChannel.unsubscribe()
    }
  }, [currentUserId, supabase])

  // Helper function to check if a specific user is online
  const isOnline = useCallback((userId: string) => {
    return onlineUsers.has(userId)
  }, [onlineUsers])

  return {
    onlineUsers,
    isOnline,
    onlineCount: onlineUsers.size
  }
}
