'use client'

import { useEffect, useState, useCallback } from 'react'
import { createBrowserClient } from '@supabase/ssr'
import { RealtimeChannel } from '@supabase/supabase-js'

interface PresenceState {
  [userId: string]: {
    online: boolean
    lastSeen: string
  }
}

/**
 * Hook to track online/offline status of users using Supabase Presence
 * 
 * Usage:
 * const { onlineUsers, isOnline } = usePresence(currentUserId)
 * const userIsOnline = isOnline('some-user-id')
 */
export function usePresence(currentUserId: string | null) {
  const [onlineUsers, setOnlineUsers] = useState<Set<string>>(new Set())
  const [channel, setChannel] = useState<RealtimeChannel | null>(null)

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  useEffect(() => {
    if (!currentUserId) return

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
      
      setOnlineUsers(online)
    })

    // Handle user joining
    presenceChannel.on('presence', { event: 'join' }, ({ key, newPresences }) => {
      setOnlineUsers(prev => {
        const next = new Set(prev)
        next.add(key)
        return next
      })
    })

    // Handle user leaving
    presenceChannel.on('presence', { event: 'leave' }, ({ key, leftPresences }) => {
      setOnlineUsers(prev => {
        const next = new Set(prev)
        next.delete(key)
        return next
      })
    })

    // Subscribe and track own presence
    presenceChannel.subscribe(async (status) => {
      if (status === 'SUBSCRIBED') {
        await presenceChannel.track({
          user_id: currentUserId,
          online_at: new Date().toISOString(),
        })
      }
    })

    setChannel(presenceChannel)

    // Cleanup on unmount
    return () => {
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
