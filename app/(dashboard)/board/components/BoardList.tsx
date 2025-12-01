'use client'

import { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { Board, BoardAccess } from '@/types/database'
import { Button } from '@/components/ui/Button'

interface BoardWithAccess extends Board {
  board_access?: BoardAccess[]
}

interface BoardListProps {
  boards: BoardWithAccess[]
  currentUserId: string | null
  currentBoardId?: string
  onCreateBoard: () => void
  isCollapsed: boolean
  onToggleCollapse: () => void
  loading?: boolean
}

type TabType = 'shared' | 'private'

export function BoardList({ boards, currentUserId, currentBoardId, onCreateBoard, isCollapsed, onToggleCollapse, loading = false }: BoardListProps) {
  const [activeTab, setActiveTab] = useState<TabType>('shared')
  const [mounted, setMounted] = useState(false)
  const router = useRouter()

  // Load tab preference from localStorage after mount (client-side only)
  useEffect(() => {
    const savedTab = localStorage.getItem('boardListActiveTab')
    if (savedTab === 'shared' || savedTab === 'private') {
      setActiveTab(savedTab as TabType)
    }
    setMounted(true)
  }, [])
  
  const handleTabClick = (tab: TabType) => {
    setActiveTab(tab)
    localStorage.setItem('boardListActiveTab', tab) // Save preference
  }

  // Categorize boards - memoized to prevent recalculation
  const categorizedBoards = useMemo(() => {
    return boards.reduce((acc, board) => {
      // System boards (like Cases) always go to SHARED
      if (board.is_system) {
        acc.shared.push(board)
        return acc
      }

      if (!currentUserId) return acc

      const accessCount = board.board_access?.length || 0
      const isOwner = board.owner_id === currentUserId

      // Private: Owner and only owner has access (access count = 1)
      // Shared: 
      //   - Owner with others (access count > 1)
      //   - User is not owner (someone shared it with them)
      if (isOwner && accessCount === 1) {
        acc.private.push(board)
      } else if (accessCount > 1 || !isOwner) {
        acc.shared.push(board)
      }

      return acc
    }, { private: [] as BoardWithAccess[], shared: [] as BoardWithAccess[] })
  }, [boards, currentUserId])

  const displayBoards = activeTab === 'shared' ? categorizedBoards.shared : categorizedBoards.private

  const handleBoardClick = (boardId: string) => {
    router.push(`/board/${boardId}`)
  }

  if (isCollapsed) {
    return (
      <div className="flex flex-col items-center py-4">
        <button
          onClick={onToggleCollapse}
          className="p-2 hover:bg-[hsl(var(--color-surface-hover))] rounded-lg transition-colors"
          title="Expand sidebar"
        >
          <svg className="w-5 h-5 text-[hsl(var(--color-text-secondary))]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 5l7 7-7 7M5 5l7 7-7 7" />
          </svg>
        </button>
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col">
      {/* Tabs */}
      <div className="flex items-center border-b border-[hsl(var(--color-border))]">
        <button
          onClick={() => handleTabClick('shared')}
          className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
            activeTab === 'shared'
              ? 'text-[hsl(var(--color-text-primary))] border-b-2 border-[hsl(var(--color-primary))]'
              : 'text-[hsl(var(--color-text-secondary))] hover:text-[hsl(var(--color-text-primary))]'
          }`}
        >
          Shared
        </button>
        <button
          onClick={() => handleTabClick('private')}
          className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
            activeTab === 'private'
              ? 'text-[hsl(var(--color-text-primary))] border-b-2 border-[hsl(var(--color-primary))]'
              : 'text-[hsl(var(--color-text-secondary))] hover:text-[hsl(var(--color-text-primary))]'
          }`}
        >
          Private
        </button>
        <button
          onClick={onToggleCollapse}
          className="p-3 hover:bg-[hsl(var(--color-surface-hover))] transition-colors border-l border-[hsl(var(--color-border))]"
          title="Collapse sidebar"
        >
          <svg className="w-5 h-5 text-[hsl(var(--color-text-secondary))]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
          </svg>
        </button>
      </div>

      {/* Create Board Button (only on Private tab) */}
      {activeTab === 'private' && (
        <div className="px-4 pt-4 flex-shrink-0">
          <Button onClick={onCreateBoard} className="w-full shadow-sm">
            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Create Board
          </Button>
        </div>
      )}

      {/* Board List - Scrollable with max height */}
      <div className="flex-1 overflow-y-auto min-h-0 px-4 pt-4 pb-4 space-y-2 scrollbar-thin">
        {loading ? (
          <div className="text-center py-8">
            <p className="text-[hsl(var(--color-text-secondary))] text-sm">
              Loading boards...
            </p>
          </div>
        ) : displayBoards.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-[hsl(var(--color-text-secondary))] text-sm">
              {activeTab === 'private' 
                ? 'No private boards yet. Create one to get started!' 
                : 'No shared boards yet.'}
            </p>
          </div>
        ) : (
          displayBoards.map(board => (
            <div
              key={board.id}
              className={`p-3 cursor-pointer transition-all rounded-lg ${
                currentBoardId === board.id
                  ? 'bg-[hsl(var(--color-primary))]/10 border-l-4 border-[hsl(var(--color-primary))] shadow-sm'
                  : 'bg-[hsl(var(--color-surface-hover))] hover:bg-[hsl(var(--color-background))] border-l-4 border-transparent'
              }`}
              onClick={() => handleBoardClick(board.id)}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="font-medium text-[hsl(var(--color-text-primary))] truncate text-sm">
                      {board.name}
                    </h3>
                    {board.is_system && (
                      <span className="px-1.5 py-0.5 text-[10px] bg-blue-500/10 text-blue-600 dark:text-blue-400 rounded uppercase font-semibold">
                        System
                      </span>
                    )}
                  </div>
                  {board.description && (
                    <p className="text-xs text-[hsl(var(--color-text-secondary))] mt-1 line-clamp-2">
                      {board.description}
                    </p>
                  )}
                  {activeTab === 'shared' && board.board_access && board.board_access.length > 0 && (
                    <div className="flex items-center gap-1 mt-1.5">
                      <svg className="w-3 h-3 text-[hsl(var(--color-text-secondary))]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                      </svg>
                      <p className="text-xs text-[hsl(var(--color-text-secondary))]">
                        {board.board_access.length} {board.board_access.length === 1 ? 'user' : 'users'}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
