'use client'

import { useState, useEffect, ReactNode, createContext, useContext } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { getUserBoards } from '@/app/actions/board/core'
import { useBoardsCache, useDeepPrefetchBoard } from '@/lib/query'
import { BoardList } from './components/BoardList'
import { CreateBoardModal } from './components/CreateBoardModal'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'
import type { Board, BoardAccess } from '@/types/database'

interface BoardWithAccess extends Board {
  board_access?: BoardAccess[]
}

// Create context for board refresh
interface BoardRefreshContextType {
  refreshAll: () => void
  refreshBoard: (boardId: string) => void
}

const BoardRefreshContext = createContext<BoardRefreshContextType | null>(null)

export function useBoardRefresh() {
  return useContext(BoardRefreshContext)
}

export default function BoardLayout({ children }: { children: ReactNode }) {
  const params = useParams()
  const router = useRouter()
  const currentBoardId = params?.boardId as string | undefined
  const { getCached: getCachedBoards, setCached: setCachedBoards } = useBoardsCache()
  const deepPrefetchBoard = useDeepPrefetchBoard()

  const [boards, setBoards] = useState<BoardWithAccess[]>([])
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [boardsLoading, setBoardsLoading] = useState(true)
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false)
  const [isNavCollapsed, setIsNavCollapsed] = useState(false)
  const [refreshKey, setRefreshKey] = useState(0)
  // Mobile view: 'picker' shows board list, 'board' shows selected board
  const [mobileView, setMobileView] = useState<'picker' | 'board'>(currentBoardId ? 'board' : 'picker')

  // Load navbar collapsed state and listen for changes
  useEffect(() => {
    const saved = localStorage.getItem('navbar-collapsed')
    if (saved !== null) {
      setIsNavCollapsed(saved === 'true')
    }

    const handleToggle = (e: CustomEvent<{ collapsed: boolean }>) => {
      setIsNavCollapsed(e.detail.collapsed)
    }

    window.addEventListener('navbar-toggle', handleToggle as EventListener)
    return () => window.removeEventListener('navbar-toggle', handleToggle as EventListener)
  }, [])

  // Update mobile view when board is selected via URL
  useEffect(() => {
    if (currentBoardId) {
      setMobileView('board')
    }
  }, [currentBoardId])

  // Get current user ID once on mount
  useEffect(() => {
    async function getCurrentUser() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        setCurrentUserId(user.id)
      }
    }
    getCurrentUser()
  }, [])

  // Fetch boards once on mount and when refreshKey changes
  useEffect(() => {
    // Try cache first on initial load
    if (refreshKey === 0) {
      const cached = getCachedBoards()
      if (cached?.data && cached.data.length > 0) {
        setBoards(cached.data as BoardWithAccess[])
        setBoardsLoading(false)
        // Deep prefetch: Load cards for ALL boards in background
        deepPrefetchBoard()
        // Still refresh in background
        getUserBoards().then(result => {
          if (result?.data) {
            setBoards(result.data as BoardWithAccess[])
            setCachedBoards(result)
          }
        })
        return
      }
    }
    fetchBoards()
  }, [refreshKey])

  async function fetchBoards() {
    setBoardsLoading(true)
    const result = await getUserBoards()
    if (result?.data) {
      setBoards(result.data as BoardWithAccess[])
      setCachedBoards(result)
      // Deep prefetch after initial load
      setTimeout(() => deepPrefetchBoard(), 100)
    }
    setBoardsLoading(false)
  }

  // Function to trigger board list refresh (e.g., after deletion)
  const handleBoardsRefresh = () => {
    setRefreshKey(prev => prev + 1)
  }

  // Function to refresh a single board's data
  const handleSingleBoardRefresh = async (boardId: string) => {
    // Find and update just this board
    const result = await getUserBoards()
    if (result?.data) {
      const allBoards = result.data as BoardWithAccess[]
      setCachedBoards(result)
      const updatedBoard = allBoards.find(b => b.id === boardId)
      if (updatedBoard) {
        setBoards(prevBoards => 
          prevBoards.map(b => b.id === boardId ? updatedBoard : b)
        )
      }
    }
  }

  const refreshContext: BoardRefreshContextType = {
    refreshAll: handleBoardsRefresh,
    refreshBoard: handleSingleBoardRefresh
  }

  // Separate boards by ownership
  const myBoards = boards.filter(b => b.owner_id === currentUserId)
  const sharedBoards = boards.filter(b => b.owner_id !== currentUserId)
  const currentBoard = boards.find(b => b.id === currentBoardId)

  return (
    <BoardRefreshContext.Provider value={refreshContext}>
      <div className={cn(
        "fixed top-0 right-0 bottom-0 flex transition-all duration-300",
        "left-0 md:left-16", // No margin on mobile
        !isNavCollapsed && "md:left-56" // Expanded navbar only on md+
      )}>
        {/* Mobile Board Picker */}
        <div className="md:hidden flex flex-col h-full w-full bg-[hsl(var(--color-bg))]">
          {mobileView === 'picker' ? (
            <>
              {/* Mobile Header */}
              <div className="flex items-center gap-3 p-4 border-b border-[hsl(var(--color-border))] bg-[hsl(var(--color-surface))]">
                <h1 className="font-semibold text-lg flex-1">Boards</h1>
                <button
                  onClick={() => setIsCreateModalOpen(true)}
                  className="p-2 hover:bg-[hsl(var(--color-surface-hover))] rounded-lg transition-colors"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                </button>
              </div>

              {/* Mobile Board List */}
              <div className="flex-1 overflow-y-auto p-4 space-y-4 pb-24">
                {boardsLoading ? (
                  <div className="text-center py-8 text-[hsl(var(--color-text-secondary))]">Loading...</div>
                ) : boards.length === 0 ? (
                  <div className="text-center py-8 text-[hsl(var(--color-text-secondary))]">No boards yet</div>
                ) : (
                  <>
                    {/* My Boards Section */}
                    {myBoards.length > 0 && (
                      <div>
                        <h2 className="text-xs font-semibold text-[hsl(var(--color-text-secondary))] uppercase tracking-wide mb-2">My Boards</h2>
                        <div className="space-y-2">
                          {myBoards.map(board => (
                            <button
                              key={board.id}
                              onClick={() => {
                                router.push(`/board/${board.id}`)
                                setMobileView('board')
                              }}
                              className={cn(
                                "w-full flex items-center gap-3 p-4 rounded-xl border transition-colors",
                                currentBoardId === board.id 
                                  ? "bg-[hsl(var(--color-accent))]/10 border-[hsl(var(--color-accent))]/30" 
                                  : "bg-[hsl(var(--color-surface))] border-[hsl(var(--color-border))] hover:bg-[hsl(var(--color-surface-hover))]"
                              )}
                            >
                              <div className="w-3 h-3 rounded-full flex-shrink-0 bg-[hsl(var(--color-accent))]" />
                              <span className="font-medium flex-1 text-left truncate">{board.name}</span>
                              <svg className="w-4 h-4 text-[hsl(var(--color-text-secondary))]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                              </svg>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Shared Boards Section */}
                    {sharedBoards.length > 0 && (
                      <div>
                        <h2 className="text-xs font-semibold text-[hsl(var(--color-text-secondary))] uppercase tracking-wide mb-2">Shared with me</h2>
                        <div className="space-y-2">
                          {sharedBoards.map(board => (
                            <button
                              key={board.id}
                              onClick={() => {
                                router.push(`/board/${board.id}`)
                                setMobileView('board')
                              }}
                              className={cn(
                                "w-full flex items-center gap-3 p-4 rounded-xl border transition-colors",
                                currentBoardId === board.id 
                                  ? "bg-[hsl(var(--color-accent))]/10 border-[hsl(var(--color-accent))]/30" 
                                  : "bg-[hsl(var(--color-surface))] border-[hsl(var(--color-border))] hover:bg-[hsl(var(--color-surface-hover))]"
                              )}
                            >
                              <div className="w-3 h-3 rounded-full flex-shrink-0 bg-[hsl(var(--color-accent))]" />
                              <span className="font-medium flex-1 text-left truncate">{board.name}</span>
                              <svg className="w-4 h-4 text-[hsl(var(--color-text-secondary))]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                              </svg>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            </>
          ) : (
            <>
              {/* Mobile Board Header with Back */}
              <div className="flex items-center gap-3 p-4 border-b border-[hsl(var(--color-border))] bg-[hsl(var(--color-surface))]">
                <button
                  onClick={() => setMobileView('picker')}
                  className="p-2 -ml-2 hover:bg-[hsl(var(--color-surface-hover))] rounded-lg"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                </button>
                {currentBoard && (
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <div className="w-3 h-3 rounded-full flex-shrink-0 bg-[hsl(var(--color-accent))]" />
                    <h1 className="font-semibold text-lg truncate">{currentBoard.name}</h1>
                  </div>
                )}
              </div>

              {/* Mobile Board Content */}
              <div className="flex-1 overflow-hidden pb-20">
                {children}
              </div>
            </>
          )}
        </div>

        {/* Desktop Sidebar with Board List - hidden on mobile */}
        <div className={cn(
          "hidden md:flex backdrop-blur-md bg-[hsl(var(--color-surface))]/50 border-r border-[hsl(var(--color-border))]/60 flex-col transition-all duration-300 flex-shrink-0 h-full",
          isSidebarCollapsed ? 'w-16' : 'w-72'
        )}>
          <BoardList
            boards={boards}
            currentUserId={currentUserId}
            currentBoardId={currentBoardId}
            onCreateBoard={() => setIsCreateModalOpen(true)}
            isCollapsed={isSidebarCollapsed}
            onToggleCollapse={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
            loading={boardsLoading}
          />
        </div>

        {/* Desktop Main Content - hidden on mobile */}
        <div className="hidden md:block flex-1 overflow-hidden h-full bg-[hsl(var(--color-background))]">
          {children}
        </div>

        <CreateBoardModal
          isOpen={isCreateModalOpen}
          onClose={() => setIsCreateModalOpen(false)}
          onSuccess={fetchBoards}
        />
      </div>
    </BoardRefreshContext.Provider>
  )
}
