'use client'

import { useQueryClient } from '@tanstack/react-query'
import { useEffect, useCallback, useRef } from 'react'
import { queryKeys } from './queryKeys'

// Import server actions
import { getConversations, getMessages } from '@/app/actions/chat'
import { getAllDashboardData } from '@/app/actions/dashboard'

/**
 * Hook that prefetches data for other tabs when a page loads.
 * This makes navigation feel instant because data is already cached.
 */
export function usePrefetchOnMount() {
  const queryClient = useQueryClient()
  const hasPrefetched = useRef(false)

  useEffect(() => {
    // Only prefetch once per mount
    if (hasPrefetched.current) return
    hasPrefetched.current = true

    // Run prefetches in parallel after a small delay to not block initial render
    const timer = setTimeout(() => {
      prefetchAll(queryClient)
    }, 100)

    return () => clearTimeout(timer)
  }, [queryClient])
}

/**
 * Prefetch all commonly accessed data
 */
async function prefetchAll(queryClient: ReturnType<typeof useQueryClient>) {
  // Prefetch in parallel - don't await each one
  Promise.all([
    // Conversations are used by chat and mini chat
    queryClient.prefetchQuery({
      queryKey: queryKeys.conversations,
      queryFn: async () => {
        const result = await getConversations()
        // Also prefetch messages for top 3 conversations
        if (result.conversations.length > 0) {
          const topConversations = result.conversations.slice(0, 3)
          await Promise.all(
            topConversations.map(conv =>
              queryClient.prefetchQuery({
                queryKey: queryKeys.messages(conv.id),
                queryFn: async () => {
                  const msgResult = await getMessages(conv.id, 10)
                  return msgResult
                },
                staleTime: 30 * 1000,
              })
            )
          )
        }
        return result
      },
      staleTime: 30 * 1000,
    }),

    // Dashboard data
    queryClient.prefetchQuery({
      queryKey: queryKeys.dashboard,
      queryFn: async () => {
        const result = await getAllDashboardData()
        return result
      },
      staleTime: 30 * 1000,
    }),
  ]).catch(err => {
    // Silently fail prefetches - they're not critical
    console.debug('Prefetch error:', err)
  })
}

/**
 * Hook to prefetch messages for a specific conversation
 * Use this when hovering over a conversation in the list
 */
export function usePrefetchMessages() {
  const queryClient = useQueryClient()

  const prefetch = useCallback(
    (conversationId: string) => {
      queryClient.prefetchQuery({
        queryKey: queryKeys.messages(conversationId),
        queryFn: async () => {
          const result = await getMessages(conversationId, 10)
          return result
        },
        staleTime: 30 * 1000,
      })
    },
    [queryClient]
  )

  return prefetch
}

/**
 * Get cached conversations if available
 */
export function useConversationsCache() {
  const queryClient = useQueryClient()
  
  const getCached = useCallback(() => {
    return queryClient.getQueryData<Awaited<ReturnType<typeof getConversations>>>(
      queryKeys.conversations
    )
  }, [queryClient])

  const setCached = useCallback(
    (data: Awaited<ReturnType<typeof getConversations>>) => {
      queryClient.setQueryData(queryKeys.conversations, data)
    },
    [queryClient]
  )

  return { getCached, setCached }
}

/**
 * Get cached messages for a conversation if available
 */
export function useMessagesCache(conversationId: string) {
  const queryClient = useQueryClient()
  
  const getCached = useCallback(() => {
    return queryClient.getQueryData<Awaited<ReturnType<typeof getMessages>>>(
      queryKeys.messages(conversationId)
    )
  }, [queryClient, conversationId])

  const setCached = useCallback(
    (data: Awaited<ReturnType<typeof getMessages>>) => {
      queryClient.setQueryData(queryKeys.messages(conversationId), data)
    },
    [queryClient, conversationId]
  )

  return { getCached, setCached }
}

/**
 * Get cached dashboard data if available
 */
export function useDashboardCache() {
  const queryClient = useQueryClient()
  
  const getCached = useCallback(() => {
    return queryClient.getQueryData<Awaited<ReturnType<typeof getAllDashboardData>>>(
      queryKeys.dashboard
    )
  }, [queryClient])

  const setCached = useCallback(
    (data: Awaited<ReturnType<typeof getAllDashboardData>>) => {
      queryClient.setQueryData(queryKeys.dashboard, data)
    },
    [queryClient]
  )

  return { getCached, setCached }
}
