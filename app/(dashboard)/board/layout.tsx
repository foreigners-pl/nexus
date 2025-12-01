'use client'

import { useState, useEffect, ReactNode, createContext, useContext } from 'react'
import { useParams } from 'next/navigation'
import { getUserBoards } from '@/app/actions/board/core'
import { BoardList } from './components/BoardList'
import { CreateBoardModal } from './components/CreateBoardModal'
import { createClient } from '@/lib/supabase/client'
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
  const currentBoardId = params?.boardId as string | undefined

  const [boards, setBoards] = useState<BoardWithAccess[]>([])
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [boardsLoading, setBoardsLoading] = useState(true)
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false)
  const [refreshKey, setRefreshKey] = useState(0)

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
    fetchBoards()
  }, [refreshKey])

  async function fetchBoards() {
    setBoardsLoading(true)
    const result = await getUserBoards()
    if (result?.data) {
      setBoards(result.data as BoardWithAccess[])
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

  return (
    <BoardRefreshContext.Provider value={refreshContext}>
      <div className="fixed top-0 left-64 right-0 bottom-0 flex">
        {/* Sidebar with Board List - PERSISTS across route changes */}
        <div className={`${isSidebarCollapsed ? 'w-16' : 'w-80'} bg-[hsl(var(--color-surface))] border-r border-[hsl(var(--color-border))] flex flex-col transition-all duration-300 flex-shrink-0 h-full`}>
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

        {/* Main Content - Changes based on route */}
        <div className="flex-1 overflow-hidden h-full">
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
