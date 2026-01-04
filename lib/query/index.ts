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
  useBoardCardsCache
} from './usePrefetch'
