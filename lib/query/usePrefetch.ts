'use client'

import { useQueryClient } from '@tanstack/react-query'
import { useEffect, useCallback, useRef } from 'react'
import { queryKeys } from './queryKeys'

// Import server actions
import { getConversations, getMessages } from '@/app/actions/chat'
import { getAllDashboardData } from '@/app/actions/dashboard'
import { getUserBoards, getCasesBoardData } from '@/app/actions/board/core'
import { getWikiFolders } from '@/app/actions/wiki'

// Client prefetch type
interface ClientWithPhones {
  id: string
  [key: string]: any
}

/**
 * Hook that prefetches data for other tabs when a page loads.
 * This makes navigation feel instant because data is already cached.
 * 
 * IMPORTANT: This waits for home page to fully load first before prefetching other tabs.
 */
export function usePrefetchOnMount() {
  const queryClient = useQueryClient()
  const hasPrefetched = useRef(false)

  useEffect(() => {
    // Only prefetch once per mount
    if (hasPrefetched.current) return
    hasPrefetched.current = true

    // Wait longer to ensure home page is fully loaded first
    // Home page should have finished all its initial renders by this time
    const timer = setTimeout(() => {
      prefetchAllTabs(queryClient)
    }, 2000) // Wait 2 seconds after mount before prefetching other tabs

    return () => clearTimeout(timer)
  }, [queryClient])
}

/**
 * Prefetch data for all tabs (runs after home page is loaded)
 */
async function prefetchAllTabs(queryClient: ReturnType<typeof useQueryClient>) {
  // Prefetch in sequence with small delays to not overwhelm the network
  // This runs in background after home page is fully loaded
  
  try {
    // 1. Prefetch conversations (most commonly accessed)
    await queryClient.prefetchQuery({
      queryKey: queryKeys.conversations,
      queryFn: async () => {
        const result = await getConversations()
        return result
      },
      staleTime: 30 * 1000,
    })

    // Small delay between prefetches
    await new Promise(resolve => setTimeout(resolve, 100))

    // 2. Prefetch messages for top 3 conversations
    const cachedConvs = queryClient.getQueryData<Awaited<ReturnType<typeof getConversations>>>(
      queryKeys.conversations
    )
    if (cachedConvs?.conversations && cachedConvs.conversations.length > 0) {
      const topConversations = cachedConvs.conversations.slice(0, 3)
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

    await new Promise(resolve => setTimeout(resolve, 100))

    // 3. Prefetch boards list
    await queryClient.prefetchQuery({
      queryKey: queryKeys.boards,
      queryFn: async () => {
        const result = await getUserBoards()
        return result
      },
      staleTime: 30 * 1000,
    })

    await new Promise(resolve => setTimeout(resolve, 100))

    // 4. Prefetch cases board data (default board)
    await queryClient.prefetchQuery({
      queryKey: queryKeys.casesBoard,
      queryFn: async () => {
        const result = await getCasesBoardData()
        return result
      },
      staleTime: 30 * 1000,
    })

    await new Promise(resolve => setTimeout(resolve, 100))

    // 5. Prefetch wiki folders (private)
    await queryClient.prefetchQuery({
      queryKey: queryKeys.wikiFolders(false),
      queryFn: async () => {
        const result = await getWikiFolders(false)
        return result
      },
      staleTime: 30 * 1000,
    })

    await new Promise(resolve => setTimeout(resolve, 100))

    // 6. Prefetch clients (first page)
    await queryClient.prefetchQuery({
      queryKey: queryKeys.clients,
      queryFn: async () => {
        // Import dynamically to avoid circular deps
        const { createClient } = await import('@/lib/supabase/client')
        const supabase = createClient()
        const { data } = await supabase
          .from('clients')
          .select('*, contact_numbers (id, number, is_on_whatsapp)')
          .order('created_at', { ascending: false })
          .range(0, 19) // First 20 clients
        return data || []
      },
      staleTime: 30 * 1000,
    })

  } catch (err) {
    // Silently fail prefetches - they're not critical
    console.debug('Prefetch error:', err)
  }
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

/**
 * Get cached boards list if available
 */
export function useBoardsCache() {
  const queryClient = useQueryClient()
  
  const getCached = useCallback(() => {
    return queryClient.getQueryData<Awaited<ReturnType<typeof getUserBoards>>>(
      queryKeys.boards
    )
  }, [queryClient])

  const setCached = useCallback(
    (data: Awaited<ReturnType<typeof getUserBoards>>) => {
      queryClient.setQueryData(queryKeys.boards, data)
    },
    [queryClient]
  )

  return { getCached, setCached }
}

/**
 * Get cached cases board data if available
 */
export function useCasesBoardCache() {
  const queryClient = useQueryClient()
  
  const getCached = useCallback(() => {
    return queryClient.getQueryData<Awaited<ReturnType<typeof getCasesBoardData>>>(
      queryKeys.casesBoard
    )
  }, [queryClient])

  const setCached = useCallback(
    (data: Awaited<ReturnType<typeof getCasesBoardData>>) => {
      queryClient.setQueryData(queryKeys.casesBoard, data)
    },
    [queryClient]
  )

  return { getCached, setCached }
}

/**
 * Get cached wiki folders if available
 */
export function useWikiFoldersCache(isShared: boolean = false) {
  const queryClient = useQueryClient()
  
  const getCached = useCallback(() => {
    return queryClient.getQueryData<Awaited<ReturnType<typeof getWikiFolders>>>(
      queryKeys.wikiFolders(isShared)
    )
  }, [queryClient, isShared])

  const setCached = useCallback(
    (data: Awaited<ReturnType<typeof getWikiFolders>>) => {
      queryClient.setQueryData(queryKeys.wikiFolders(isShared), data)
    },
    [queryClient, isShared]
  )

  return { getCached, setCached }
}

/**
 * Get cached clients if available
 */
export function useClientsCache() {
  const queryClient = useQueryClient()
  
  const getCached = useCallback(() => {
    return queryClient.getQueryData<ClientWithPhones[]>(queryKeys.clients)
  }, [queryClient])

  const setCached = useCallback(
    (data: ClientWithPhones[]) => {
      queryClient.setQueryData(queryKeys.clients, data)
    },
    [queryClient]
  )

  return { getCached, setCached }
}
