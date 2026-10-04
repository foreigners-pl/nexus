'use client'

import { useQueryClient } from '@tanstack/react-query'
import { useEffect, useCallback, useRef } from 'react'
import { queryKeys } from './queryKeys'
import { isDesktopViewport } from '@/lib/viewport'

// Bulk prefetching helps desktop but floods a phone's connection right when
// the user is opening a page — skip it on mobile viewports and slow/saver links.
function shouldBulkPrefetch() {
  if (typeof navigator !== 'undefined') {
    const conn = (navigator as any).connection
    if (conn?.saveData || conn?.effectiveType === 'slow-2g' || conn?.effectiveType === '2g' || conn?.effectiveType === '3g') {
      return false
    }
  }
  return isDesktopViewport()
}

// Import server actions
import { getConversations, getMessages } from '@/app/actions/chat'
import { getAllDashboardData, getWeeklyCases, getWeeklyCards, getWeeklyPayments } from '@/app/actions/dashboard'
import { getUserBoards, getCasesBoardData } from '@/app/actions/board/core'
import { getWikiFolders } from '@/app/actions/wiki'
import { ensureBalanceInstallment } from '@/app/actions/installments'

// Read paths go browser→Supabase directly — no Vercel function hop.
import {
  fetchCasePageData,
  fetchClientPageData,
  fetchCaseWorkflow,
  fetchCaseEntry,
  fetchCaseHeaderData,
  fetchBillingData,
  fetchAttachments,
  fetchComments,
} from '@/lib/data'

// Client prefetch type
interface ClientWithPhones {
  id: string
  [key: string]: any
}

// Helper to get start of current week
function getStartOfWeek(date: Date): Date {
  const d = new Date(date)
  const day = d.getDay()
  const diff = d.getDate() - day + (day === 0 ? -6 : 1)
  d.setDate(diff)
  d.setHours(0, 0, 0, 0)
  return d
}

function formatLocalDate(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
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

    // Start prefetching quickly but not blocking initial render
    // Use requestIdleCallback if available, otherwise short timeout
    const startPrefetch = () => {
      if (!shouldBulkPrefetch()) return
      prefetchAllTabs(queryClient)
    }

    if (typeof requestIdleCallback !== 'undefined') {
      // Browser is idle - perfect time to prefetch
      requestIdleCallback(startPrefetch, { timeout: 1000 })
    } else {
      // Fallback: 500ms delay
      const timer = setTimeout(startPrefetch, 500)
      return () => clearTimeout(timer)
    }
  }, [queryClient])
}

/**
 * Prefetch data for all tabs (runs after home page is loaded)
 */
async function prefetchAllTabs(queryClient: ReturnType<typeof useQueryClient>) {
  console.log('[Prefetch] Starting prefetch of all tabs...')
  try {
    // Get current week start for timeline prefetch
    const weekStart = getStartOfWeek(new Date())
    const weekStartStr = formatLocalDate(weekStart)

    // Prefetch ALL data in parallel for maximum speed
    await Promise.all([
      // 1. Conversations
      queryClient.prefetchQuery({
        queryKey: queryKeys.conversations,
        queryFn: async () => {
          const result = await getConversations()
          return result
        },
        staleTime: 5 * 60 * 1000, // 1 minute
      }),

      // 2. Dashboard data (includes all home page data except timeline)
      queryClient.prefetchQuery({
        queryKey: queryKeys.dashboard,
        queryFn: async () => {
          const result = await getAllDashboardData()
          return result
        },
        staleTime: 5 * 60 * 1000,
      }),

      // 3. Weekly cases (for timeline "Today" tab)
      queryClient.prefetchQuery({
        queryKey: ['weeklyCases', weekStartStr],
        queryFn: async () => {
          const result = await getWeeklyCases(weekStartStr)
          return result
        },
        staleTime: 5 * 60 * 1000,
      }),

      // 4. Weekly tasks (for timeline)
      queryClient.prefetchQuery({
        queryKey: ['weeklyTasks', weekStartStr],
        queryFn: async () => {
          const result = await getWeeklyCards(weekStartStr)
          return result
        },
        staleTime: 5 * 60 * 1000,
      }),

      // 5. Weekly payments (for timeline)
      queryClient.prefetchQuery({
        queryKey: ['weeklyPayments', weekStartStr],
        queryFn: async () => {
          const result = await getWeeklyPayments(weekStartStr)
          return result
        },
        staleTime: 5 * 60 * 1000,
      }),

      // 6. Boards list
      queryClient.prefetchQuery({
        queryKey: queryKeys.boards,
        queryFn: async () => {
          const result = await getUserBoards()
          return result
        },
        staleTime: 5 * 60 * 1000,
      }),

      // 7. Cases board data (default board)
      queryClient.prefetchQuery({
        queryKey: queryKeys.casesBoard,
        queryFn: async () => {
          const result = await getCasesBoardData()
          return result
        },
        staleTime: 5 * 60 * 1000,
      }),

      // 8. Wiki folders (private)
      queryClient.prefetchQuery({
        queryKey: queryKeys.wikiFolders(false),
        queryFn: async () => {
          const result = await getWikiFolders(false)
          console.log('[Prefetch] Wiki folders (private) loaded:', result?.length)
          return result
        },
        staleTime: 5 * 60 * 1000,
      }),

      // 9. Wiki folders (shared)
      queryClient.prefetchQuery({
        queryKey: queryKeys.wikiFolders(true),
        queryFn: async () => {
          const result = await getWikiFolders(true)
          console.log('[Prefetch] Wiki folders (shared) loaded:', result?.length)
          return result
        },
        staleTime: 5 * 60 * 1000,
      }),

      // 10. Clients (first page)
      queryClient.prefetchQuery({
        queryKey: queryKeys.clients,
        queryFn: async () => {
          const { createClient } = await import('@/lib/supabase/client')
          const supabase = createClient()
          const { data } = await supabase
            .from('clients')
            .select('*, contact_numbers (id, number, country_code, is_on_whatsapp)')
            .order('created_at', { ascending: false })
            .range(0, 19)
          return data || []
        },
        staleTime: 5 * 60 * 1000,
      }),
    ])

    // After conversations load, prefetch messages for top 3
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
            staleTime: 5 * 60 * 1000,
          })
        )
      )
    }

    console.debug('[Prefetch] All tabs prefetched successfully')
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
        staleTime: 5 * 60 * 1000,
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
 * Get cached weekly timeline data
 */
export function useWeeklyCache(weekStartStr: string) {
  const queryClient = useQueryClient()
  
  const getCachedCases = useCallback(() => {
    return queryClient.getQueryData<Awaited<ReturnType<typeof getWeeklyCases>>>(
      ['weeklyCases', weekStartStr]
    )
  }, [queryClient, weekStartStr])

  const getCachedTasks = useCallback(() => {
    return queryClient.getQueryData<Awaited<ReturnType<typeof getWeeklyCards>>>(
      ['weeklyTasks', weekStartStr]
    )
  }, [queryClient, weekStartStr])

  const getCachedPayments = useCallback(() => {
    return queryClient.getQueryData<Awaited<ReturnType<typeof getWeeklyPayments>>>(
      ['weeklyPayments', weekStartStr]
    )
  }, [queryClient, weekStartStr])

  const setCachedCases = useCallback(
    (data: Awaited<ReturnType<typeof getWeeklyCases>>) => {
      queryClient.setQueryData(['weeklyCases', weekStartStr], data)
    },
    [queryClient, weekStartStr]
  )

  const setCachedTasks = useCallback(
    (data: Awaited<ReturnType<typeof getWeeklyCards>>) => {
      queryClient.setQueryData(['weeklyTasks', weekStartStr], data)
    },
    [queryClient, weekStartStr]
  )

  const setCachedPayments = useCallback(
    (data: Awaited<ReturnType<typeof getWeeklyPayments>>) => {
      queryClient.setQueryData(['weeklyPayments', weekStartStr], data)
    },
    [queryClient, weekStartStr]
  )

  return { 
    getCachedCases, getCachedTasks, getCachedPayments,
    setCachedCases, setCachedTasks, setCachedPayments
  }
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

// ============================================
// CASE / WORKFLOW / MY-WORK CACHES + INTENT PREFETCH
// ============================================

type CasePageData = NonNullable<Awaited<ReturnType<typeof fetchCasePageData>>>

/** Cache for the case detail page bundle. Written under id + code so any URL variant hits it. */
export function useCasePageCache(idOrCode: string) {
  const queryClient = useQueryClient()

  const getCached = useCallback(() => {
    return queryClient.getQueryData<CasePageData>(queryKeys.case(idOrCode))
  }, [queryClient, idOrCode])

  const setCached = useCallback(
    (data: CasePageData) => {
      queryClient.setQueryData(queryKeys.case(idOrCode), data)
      if (data.case?.id) queryClient.setQueryData(queryKeys.case(data.case.id), data)
      if (data.case?.case_code) queryClient.setQueryData(queryKeys.case(data.case.case_code), data)
    },
    [queryClient, idOrCode]
  )

  return { getCached, setCached }
}

/** Prefetch a case detail bundle on hover/touch of a case row. */
export function usePrefetchCasePage() {
  const queryClient = useQueryClient()
  return useCallback(
    (idOrCode: string) => {
      queryClient.prefetchQuery({
        queryKey: queryKeys.case(idOrCode),
        queryFn: () => casePageQueryFn(queryClient, idOrCode),
        staleTime: 5 * 60 * 1000,
      })
    },
    [queryClient]
  )
}

async function casePageQueryFn(queryClient: ReturnType<typeof useQueryClient>, idOrCode: string) {
  const data = await fetchCasePageData(idOrCode)
  if ('case' in data && data.case?.id) {
    queryClient.setQueryData(queryKeys.case(data.case.id), data)
    if (data.case.case_code) queryClient.setQueryData(queryKeys.case(data.case.case_code), data)
  }
  return data
}

/**
 * Fetch the case page bundle through the query cache — joins an in-flight
 * hover/touch prefetch instead of firing a duplicate request, and returns
 * fresh cached data instantly on revisits.
 */
// Page-level fetches use a short 30s freshness: a just-completed hover prefetch
// renders instantly with no duplicate request; older data revalidates on mount.
export function fetchCasePageQuery(queryClient: ReturnType<typeof useQueryClient>, idOrCode: string) {
  return queryClient.fetchQuery({
    queryKey: queryKeys.case(idOrCode),
    queryFn: () => casePageQueryFn(queryClient, idOrCode),
    staleTime: 30 * 1000,
  })
}

/** Prefetch a client detail bundle on hover/touch of a client row. */
export function usePrefetchClientPage() {
  const queryClient = useQueryClient()
  return useCallback(
    (idOrCode: string) => {
      queryClient.prefetchQuery({
        queryKey: queryKeys.client(idOrCode),
        queryFn: () => clientPageQueryFn(queryClient, idOrCode),
        staleTime: 5 * 60 * 1000,
      })
    },
    [queryClient]
  )
}

async function clientPageQueryFn(queryClient: ReturnType<typeof useQueryClient>, idOrCode: string) {
  const data = await fetchClientPageData(idOrCode)
  if ('client' in data && data.client?.id) {
    queryClient.setQueryData(queryKeys.client(data.client.id), data)
    if (data.client.client_code) queryClient.setQueryData(queryKeys.client(data.client.client_code), data)
  }
  return data
}

export function fetchClientPageQuery(queryClient: ReturnType<typeof useQueryClient>, idOrCode: string) {
  return queryClient.fetchQuery({
    queryKey: queryKeys.client(idOrCode),
    queryFn: () => clientPageQueryFn(queryClient, idOrCode),
    staleTime: 30 * 1000,
  })
}

export function fetchWorkflowQuery(queryClient: ReturnType<typeof useQueryClient>, caseId: string) {
  return queryClient.fetchQuery({
    queryKey: queryKeys.workflow(caseId),
    queryFn: () => fetchCaseWorkflow(caseId),
    staleTime: 0,
  })
}

export function fetchEntryQuery(queryClient: ReturnType<typeof useQueryClient>, entryId: string) {
  return queryClient.fetchQuery({
    queryKey: queryKeys.entry(entryId),
    queryFn: () => fetchCaseEntry(entryId),
    staleTime: 0,
  })
}

export function fetchCaseHeaderQuery(queryClient: ReturnType<typeof useQueryClient>, idOrCode: string) {
  return queryClient.fetchQuery({
    queryKey: queryKeys.caseHeader(idOrCode),
    queryFn: async () => {
      const data = await fetchCaseHeaderData(idOrCode)
      if ('caseId' in data && data.caseId) {
        queryClient.setQueryData(queryKeys.caseHeader(data.caseId), data)
      }
      return data
    },
    staleTime: 30 * 1000,
  })
}

export function fetchBillingQuery(queryClient: ReturnType<typeof useQueryClient>, idOrCode: string) {
  return queryClient.fetchQuery({
    queryKey: queryKeys.billing(idOrCode),
    queryFn: async () => {
      const data = await fetchBillingData(idOrCode, ensureBalanceInstallment)
      if ('case' in data && data.case?.id) {
        queryClient.setQueryData(queryKeys.billing(data.case.id), data)
      }
      return data
    },
    staleTime: 30 * 1000,
  })
}

export function fetchAttachmentsQuery(queryClient: ReturnType<typeof useQueryClient>, caseId: string) {
  return queryClient.fetchQuery({
    queryKey: queryKeys.attachments(caseId),
    queryFn: () => fetchAttachments(caseId),
    staleTime: 0,
  })
}

export function fetchCommentsQuery(queryClient: ReturnType<typeof useQueryClient>, caseId: string) {
  return queryClient.fetchQuery({
    queryKey: queryKeys.comments(caseId),
    queryFn: () => fetchComments(caseId),
    staleTime: 0,
  })
}

type WorkflowData = Awaited<ReturnType<typeof fetchCaseWorkflow>>

/** Cache for the progress panel's workflow bundle (steps + entries + queries). */
export function useWorkflowCache(caseId: string) {
  const queryClient = useQueryClient()

  const getCached = useCallback(() => {
    return queryClient.getQueryData<WorkflowData>(queryKeys.workflow(caseId))
  }, [queryClient, caseId])

  const setCached = useCallback(
    (data: WorkflowData) => {
      queryClient.setQueryData(queryKeys.workflow(caseId), data)
    },
    [queryClient, caseId]
  )

  return { getCached, setCached }
}

/** Prefetch a case's workflow bundle on hover/touch of a progress-bound row. */
export function usePrefetchWorkflow() {
  const queryClient = useQueryClient()
  return useCallback(
    (caseId: string) => {
      queryClient.prefetchQuery({
        queryKey: queryKeys.workflow(caseId),
        queryFn: () => fetchCaseWorkflow(caseId),
        staleTime: 30 * 1000,
      })
    },
    [queryClient]
  )
}

/** Prefetch an entry detail (note/request/action page) on hover/touch. */
export function usePrefetchEntry() {
  const queryClient = useQueryClient()
  return useCallback(
    (entryId: string) => {
      queryClient.prefetchQuery({
        queryKey: queryKeys.entry(entryId),
        queryFn: () => fetchCaseEntry(entryId),
        staleTime: 5 * 60 * 1000,
      })
    },
    [queryClient]
  )
}

/** Cache for the case sub-page header (title/subtitle) — shared by progress/billing/files. */
export function useCaseHeaderCache(idOrCode: string) {
  const queryClient = useQueryClient()

  const getCached = useCallback(() => {
    return queryClient.getQueryData<any>(queryKeys.caseHeader(idOrCode))
  }, [queryClient, idOrCode])

  const setCached = useCallback(
    (data: any) => {
      queryClient.setQueryData(queryKeys.caseHeader(idOrCode), data)
      if (data?.caseId) queryClient.setQueryData(queryKeys.caseHeader(data.caseId), data)
    },
    [queryClient, idOrCode]
  )

  return { getCached, setCached }
}

// ============================================
// DEEP PREFETCH HOOKS
// These prefetch "the next level" of data when you enter a tab
// ============================================

/**
 * Deep prefetch for Chat tab - prefetch messages for ALL visible conversations
 */
export function useDeepPrefetchChat() {
  const queryClient = useQueryClient()
  const hasPrefetched = useRef(false)

  const prefetchAllMessages = useCallback(async () => {
    if (hasPrefetched.current) return
    hasPrefetched.current = true

    const cached = queryClient.getQueryData<Awaited<ReturnType<typeof getConversations>>>(
      queryKeys.conversations
    )
    
    if (!cached?.conversations) return

    console.log('[DeepPrefetch] Chat: Prefetching messages for', cached.conversations.length, 'conversations')
    
    // Prefetch messages for ALL conversations (not just top 3)
    // Do this in batches to not overwhelm the network
    const batchSize = 5
    for (let i = 0; i < cached.conversations.length; i += batchSize) {
      const batch = cached.conversations.slice(i, i + batchSize)
      await Promise.all(
        batch.map(conv =>
          queryClient.prefetchQuery({
            queryKey: queryKeys.messages(conv.id),
            queryFn: async () => {
              const result = await getMessages(conv.id, 20) // 20 messages per conversation
              return result
            },
            staleTime: 5 * 60 * 1000,
          })
        )
      )
    }
    console.log('[DeepPrefetch] Chat: All messages prefetched')
  }, [queryClient])

  return prefetchAllMessages
}

/**
 * Deep prefetch for Board tab - prefetch cards for ALL boards
 */
export function useDeepPrefetchBoard() {
  const queryClient = useQueryClient()
  const hasPrefetched = useRef(false)

  const prefetchAllBoards = useCallback(async () => {
    if (hasPrefetched.current) return
    hasPrefetched.current = true

    const cached = queryClient.getQueryData<Awaited<ReturnType<typeof getUserBoards>>>(
      queryKeys.boards
    )
    
    if (!cached?.data) return

    console.log('[DeepPrefetch] Board: Prefetching cards for', cached.data.length, 'boards')
    
    // Import getBoardWithData dynamically
    const { getBoardWithData } = await import('@/app/actions/board/core')
    
    // Skip the cases board (already prefetched separately), prefetch all other boards
    const customBoards = cached.data.filter(b => b.id !== '00000000-0000-0000-0000-000000000001')
    
    // Prefetch cards for ALL custom boards
    await Promise.all(
      customBoards.map(board =>
        queryClient.prefetchQuery({
          queryKey: queryKeys.boardCards(board.id),
          queryFn: async () => {
            const result = await getBoardWithData(board.id)
            return result
          },
          staleTime: 5 * 60 * 1000,
        })
      )
    )
    console.log('[DeepPrefetch] Board: All board cards prefetched')
  }, [queryClient])

  return prefetchAllBoards
}

/**
 * Deep prefetch for Clients tab - prefetch full client details for top clients
 */
export function useDeepPrefetchClients() {
  const queryClient = useQueryClient()
  const hasPrefetched = useRef(false)

  const prefetchClientDetails = useCallback(async () => {
    if (hasPrefetched.current) return
    if (!shouldBulkPrefetch()) return
    hasPrefetched.current = true

    const cached = queryClient.getQueryData<ClientWithPhones[]>(queryKeys.clients)
    
    if (!cached || cached.length === 0) return

    console.log('[DeepPrefetch] Clients: Prefetching details for', Math.min(cached.length, 20), 'clients')

    // Prefetch details for top 20 clients — same shape the client page caches
    const topClients = cached.slice(0, 20)
    await Promise.all(
      topClients.map(client =>
        queryClient.prefetchQuery({
          queryKey: queryKeys.client(client.id),
          queryFn: async () => {
            const result = await fetchClientPageData(client.id)
            if ('client' in result && result.client?.client_code) {
              queryClient.setQueryData(queryKeys.client(result.client.client_code), result)
            }
            return result
          },
          staleTime: 5 * 60 * 1000,
        })
      )
    )
    console.log('[DeepPrefetch] Clients: All client details prefetched')
  }, [queryClient])

  return prefetchClientDetails
}

/**
 * Deep prefetch for Cases tab - prefetch detail bundles for the top cases
 */
export function useDeepPrefetchCases() {
  const queryClient = useQueryClient()
  const hasPrefetched = useRef(false)

  const prefetchCaseDetails = useCallback(async (cases: { id: string; case_code?: string | null }[]) => {
    if (hasPrefetched.current || !cases?.length) return
    if (!shouldBulkPrefetch()) return
    hasPrefetched.current = true

    const top = cases.slice(0, 10)
    await Promise.all(
      top.map(c =>
        queryClient.prefetchQuery({
          queryKey: queryKeys.case(c.id),
          queryFn: async () => {
            const result = await fetchCasePageData(c.id)
            if ('case' in result && result.case?.case_code) {
              queryClient.setQueryData(queryKeys.case(result.case.case_code), result)
            }
            return result
          },
          staleTime: 5 * 60 * 1000,
        })
      )
    )
    console.log('[DeepPrefetch] Cases: Top case details prefetched')
  }, [queryClient])

  return prefetchCaseDetails
}

/**
 * Get cached client details if available
 */
export function useClientCache(clientId: string) {
  const queryClient = useQueryClient()
  
  const getCached = useCallback(() => {
    return queryClient.getQueryData<any>(queryKeys.client(clientId))
  }, [queryClient, clientId])

  const setCached = useCallback(
    (data: any) => {
      queryClient.setQueryData(queryKeys.client(clientId), data)
    },
    [queryClient, clientId]
  )

  return { getCached, setCached }
}

/**
 * Get cached board cards if available
 */
export function useBoardCardsCache(boardId: string) {
  const queryClient = useQueryClient()
  
  const getCached = useCallback(() => {
    return queryClient.getQueryData<any>(queryKeys.boardCards(boardId))
  }, [queryClient, boardId])

  const setCached = useCallback(
    (data: any) => {
      queryClient.setQueryData(queryKeys.boardCards(boardId), data)
    },
    [queryClient, boardId]
  )

  return { getCached, setCached }
}
