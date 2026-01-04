// Centralized query keys for consistent cache management
export const queryKeys = {
  // Chat
  conversations: ['conversations'] as const,
  messages: (conversationId: string) => ['messages', conversationId] as const,
  
  // Dashboard
  dashboard: ['dashboard'] as const,
  activities: ['activities'] as const,
  
  // Clients
  clients: ['clients'] as const,
  client: (id: string) => ['clients', id] as const,
  
  // Cases  
  cases: ['cases'] as const,
  case: (id: string) => ['cases', id] as const,
  
  // Board
  boards: ['boards'] as const,
  board: (id: string) => ['boards', id] as const,
  boardCards: (boardId: string) => ['boards', boardId, 'cards'] as const,
  casesBoard: ['boards', 'cases'] as const,
  
  // Wiki
  wikiFolders: (isShared: boolean) => ['wiki', 'folders', isShared] as const,
  wikiDocuments: (folderId: string) => ['wiki', 'documents', folderId] as const,
}
