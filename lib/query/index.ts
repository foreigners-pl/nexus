export { QueryProvider } from './QueryProvider'
export { PrefetchManager } from './PrefetchManager'
export { queryClient } from './queryClient'
export { queryKeys } from './queryKeys'
export { 
  usePrefetchOnMount, 
  usePrefetchMessages,
  useConversationsCache,
  useMessagesCache,
  useDashboardCache,
  useWeeklyCache,
  useBoardsCache,
  useCasesBoardCache,
  useWikiFoldersCache,
  useClientsCache,
  // Deep prefetch hooks
  useDeepPrefetchChat,
  useDeepPrefetchBoard,
  useDeepPrefetchClients,
  // Individual item caches
  useClientCache,
  useBoardCardsCache,
  // Case/workflow/my-work caches + intent prefetch
  useCasePageCache,
  usePrefetchCasePage,
  usePrefetchClientPage,
  useWorkflowCache,
  useCaseHeaderCache,
  usePrefetchWorkflow,
  usePrefetchEntry,
  useDeepPrefetchCases,
  // fetch-through-cache helpers (join in-flight prefetches)
  fetchCasePageQuery,
  fetchClientPageQuery,
  fetchWorkflowQuery,
  fetchEntryQuery,
  fetchCaseHeaderQuery,
  fetchBillingQuery,
  fetchAttachmentsQuery
} from './usePrefetch'
