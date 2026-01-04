'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import { getBoardWithData, getCasesBoardData, deleteBoard } from '@/app/actions/board/core'
import { getUserBoardAccessLevel } from '@/app/actions/board/helpers'
import { useCasesBoardCache, useBoardCardsCache } from '@/lib/query'
import { BoardHeader } from '../components/BoardHeader'
import { KanbanBoard } from '../components/KanbanBoard'
import { CustomKanbanBoard } from '../components/CustomKanbanBoard'
import { ShareBoardModal } from '../components/ShareBoardModal'
import { useBoardRefresh } from '../layout'
import type { Case, Status, Client, Board, BoardStatus, BoardAccess } from '@/types/database'

interface CaseWithRelations extends Case {
  clients?: Client
  status?: Status
}

interface BoardWithAccess extends Board {
  board_access?: BoardAccess[]
}

const CASES_BOARD_ID = '00000000-0000-0000-0000-000000000001'

export default function IndividualBoardPage() {
  const params = useParams()
  const router = useRouter()
  const searchParams = useSearchParams()
  const boardId = params.boardId as string
  const cardIdToOpen = searchParams.get('cardId')
  const refreshBoardList = useBoardRefresh()
  const { getCached: getCachedCasesBoard, setCached: setCachedCasesBoard } = useCasesBoardCache()
  const { getCached: getCachedBoardCards, setCached: setCachedBoardCards } = useBoardCardsCache(boardId)

  const [board, setBoard] = useState<BoardWithAccess | null>(null)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [userAccessLevel, setUserAccessLevel] = useState<'owner' | 'editor' | 'viewer' | null>(null)
  const [isCasesBoard, setIsCasesBoard] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isShareModalOpen, setIsShareModalOpen] = useState(false)

  // Cases board data
  const [cases, setCases] = useState<CaseWithRelations[]>([])
  const [statuses, setStatuses] = useState<Status[]>([])
  const [showOnlyMyTasks, setShowOnlyMyTasks] = useState(false)

  // Custom board data
  const [customStatuses, setCustomStatuses] = useState<BoardStatus[]>([])
  const [customCards, setCustomCards] = useState<any[]>([])

  // Fetch board data when boardId changes
  useEffect(() => {
    if (boardId) {
      fetchBoardData()
    }
  }, [boardId])

  // Get current user ID
  useEffect(() => {
    async function getCurrentUser() {
      const { createClient } = await import('@/lib/supabase/client')
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (user) setCurrentUserId(user.id)
    }
    getCurrentUser()
  }, [])

  async function fetchBoardData() {
    setError(null)

    // Fetch user's access level for this board
    const accessLevel = await getUserBoardAccessLevel(boardId)
    setUserAccessLevel(accessLevel)

    // Check if this is the Cases board
    if (boardId === CASES_BOARD_ID) {
      setIsCasesBoard(true)
      
      // Try cache first for instant load
      const cached = getCachedCasesBoard()
      if (cached?.data) {
        setStatuses(cached.data.statuses)
        setCases(cached.data.cases as CaseWithRelations[])
        setLoading(false)
        // Still refresh in background
        getCasesBoardData().then(result => {
          if (result?.data) {
            setStatuses(result.data.statuses)
            setCases(result.data.cases as CaseWithRelations[])
            setCachedCasesBoard(result)
          }
        })
        return
      }
      
      setLoading(true)
      const result = await getCasesBoardData()
      
      if (result?.error) {
        setError(result.error)
      } else if (result?.data) {
        setStatuses(result.data.statuses)
        setCases(result.data.cases as CaseWithRelations[])
        setCachedCasesBoard(result)
      }
    } else {
      // Custom board
      setIsCasesBoard(false)
      
      // Try cache first for instant load
      const cached = getCachedBoardCards()
      if (cached?.data) {
        setBoard(cached.data)
        setCustomStatuses(cached.data.board_statuses || [])
        setCustomCards(cached.data.cards || [])
        setLoading(false)
        // Still refresh in background
        getBoardWithData(boardId).then(result => {
          if (result?.data) {
            setBoard(result.data)
            setCustomStatuses(result.data.board_statuses || [])
            setCustomCards(result.data.cards || [])
            setCachedBoardCards(result)
          }
        })
        return
      }
      
      setLoading(true)
      const result = await getBoardWithData(boardId)
      
      if (result?.error) {
        setError(result.error)
      } else if (result?.data) {
        setBoard(result.data)
        setCustomStatuses(result.data.board_statuses || [])
        setCustomCards(result.data.cards || [])
        setCachedBoardCards(result)
      }
    }

    setLoading(false)
  }

  // Only refetch current board data when absolutely necessary
  const handleFullRefresh = () => {
    fetchBoardData()
  }

  // Optimistic board updates
  const handleBoardUpdate = (updates: { name?: string; description?: string }) => {
    if (!board) return
    setBoard({ ...board, ...updates })
    // Refresh only this board in the sidebar
    refreshBoardList?.refreshBoard(boardId)
  }

  // Optimistic status updates
  const handleStatusUpdate = (statusId: string, updates: Partial<BoardStatus>) => {
    setCustomStatuses(prevStatuses => 
      prevStatuses.map(s => s.id === statusId ? { ...s, ...updates } : s)
    )
  }

  const handleStatusDelete = (statusId: string) => {
    setCustomStatuses(prevStatuses => prevStatuses.filter(s => s.id !== statusId))
  }

  const handleStatusReorder = (fromIndex: number, toIndex: number) => {
    console.log('🔄 handleStatusReorder called - from:', fromIndex, 'to:', toIndex)
    setCustomStatuses(prevStatuses => {
      const sorted = [...prevStatuses].sort((a, b) => a.position - b.position)
      const newStatuses = [...sorted]
      const [movedStatus] = newStatuses.splice(fromIndex, 1)
      newStatuses.splice(toIndex, 0, movedStatus)
      
      // Update positions
      const reordered = newStatuses.map((status, index) => ({ ...status, position: index }))
      console.log('✅ Statuses reordered:', reordered.map(s => s.name))
      return reordered
    })
  }

  const handleStatusAdd = (newStatus: BoardStatus) => {
    setCustomStatuses(prevStatuses => {
      // Find Done status index
      const sortedStatuses = [...prevStatuses].sort((a, b) => a.position - b.position)
      const doneIndex = sortedStatuses.findIndex(s => s.name.toLowerCase().includes('done'))
      
      if (doneIndex !== -1) {
        // Insert new status before Done, and shift Done's position
        const newStatuses = [
          ...sortedStatuses.slice(0, doneIndex),
          newStatus,
          // Update Done's position to be after the new status
          { ...sortedStatuses[doneIndex], position: newStatus.position + 1 },
          ...sortedStatuses.slice(doneIndex + 1).map(s => ({ ...s, position: s.position + 1 }))
        ]
        return newStatuses
      } else {
        // No Done status, just append
        return [...sortedStatuses, newStatus]
      }
    })
  }

  // Optimistic card updates
  const handleCardUpdate = (cardId: string, updates: Partial<any>) => {
    setCustomCards(prevCards =>
      prevCards.map(c => c.id === cardId ? { ...c, ...updates } : c)
    )
  }

  // Refresh a single card (for assignee updates, etc.)
  const handleCardRefresh = async (cardId: string) => {
    console.log('🔄 [Page] handleCardRefresh called for card:', cardId)
    const { getCardWithAssignees } = await import('@/app/actions/card/core')
    const result = await getCardWithAssignees(cardId)
    
    console.log('📦 [Page] getCardWithAssignees result:', result)
    
    if (result?.data) {
      // Update just this card in the state
      console.log('✅ [Page] Updating card in state with assignees:', result.data.card_assignees?.length || 0)
      setCustomCards(prevCards =>
        prevCards.map(c => c.id === cardId ? result.data : c)
      )
    }
  }

  const handleCardAdd = (newCard: any) => {
    setCustomCards(prevCards => [...prevCards, newCard])
  }

  const handleCardDelete = (cardId: string) => {
    setCustomCards(prevCards => prevCards.filter(c => c.id !== cardId))
  }

  // Optimistic case status update
  const handleCaseStatusUpdate = (caseId: string, newStatusId: string) => {
    setCases(prevCases => 
      prevCases.map(c => {
        if (c.id === caseId) {
          // Find the new status
          const newStatus = statuses.find(s => s.id === newStatusId)
          return { ...c, status: newStatus, status_id: newStatusId }
        }
        return c
      })
    )
  }

  // Optimistic case update
  const handleCaseUpdate = (caseId: string, updates: Partial<Case>) => {
    setCases(prevCases =>
      prevCases.map(c => c.id === caseId ? { ...c, ...updates } : c)
    )
  }

  // Filter cases based on "Me" mode
  const filteredCases = showOnlyMyTasks && currentUserId
    ? cases.filter(c => c.assigned_to === currentUserId)
    : cases

  // Handle board deletion
  const handleDeleteBoard = async () => {
    if (!confirm(`Are you sure you want to delete "${board?.name}"? This action cannot be undone.`)) {
      return
    }

    const result = await deleteBoard(boardId)
    if (result?.error) {
      alert(result.error)
    } else {
      // Refresh board list to remove deleted board
      refreshBoardList?.refreshAll()
      // Redirect to boards list after successful deletion
      router.push('/board')
    }
  }

  return (
    <>
      <div className="h-full flex flex-col">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <p className="text-[hsl(var(--color-text-secondary))]">Loading board...</p>
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center h-full space-y-4">
            <p className="text-red-500">{error}</p>
            <button
              onClick={fetchBoardData}
              className="px-4 py-2 bg-[hsl(var(--color-primary))] text-white rounded-lg hover:opacity-90"
            >
              Try Again
            </button>
          </div>
        ) : (
          <>
            {/* Board Header - Fixed at top */}
            <div className="flex-shrink-0 p-6 pb-4 border-b border-[hsl(var(--color-border))]">
              <div className="flex items-center justify-between gap-4">
                <BoardHeader 
                  boardId={isCasesBoard ? undefined : boardId}
                  boardName={isCasesBoard ? 'Cases' : board?.name}
                  boardDescription={isCasesBoard ? 'System board displaying all cases with their current status' : board?.description}
                  isSystem={isCasesBoard}
                  isOwner={!isCasesBoard && currentUserId === board?.owner_id}
                  onUpdate={handleBoardUpdate}
                  onShareClick={!isCasesBoard ? () => setIsShareModalOpen(true) : undefined}
                  onDeleteClick={!isCasesBoard && currentUserId === board?.owner_id ? handleDeleteBoard : undefined}
                />
                {/* "Me" mode toggle for Cases board */}
                {isCasesBoard && (
                  <button
                    onClick={() => setShowOnlyMyTasks(!showOnlyMyTasks)}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
                      showOnlyMyTasks
                        ? 'bg-[hsl(var(--color-primary))] text-white'
                        : 'bg-[hsl(var(--color-surface-hover))] text-[hsl(var(--color-text-secondary))] hover:bg-[hsl(var(--color-surface-hover))]/80'
                    }`}
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                    <span className="text-sm font-medium">Me</span>
                  </button>
                )}
              </div>
            </div>

            {/* Kanban Board - Scrollable area */}
            <div className="flex-1 overflow-x-auto overflow-y-hidden scrollbar-thin p-6 pt-4">
              {isCasesBoard ? (
                <KanbanBoard 
                  cases={filteredCases}
                  statuses={statuses}
                  onUpdate={handleFullRefresh}
                  onCaseStatusUpdate={handleCaseStatusUpdate}
                  onCaseUpdate={handleCaseUpdate}
                  userAccessLevel={userAccessLevel}
                />
              ) : (
                <CustomKanbanBoard 
                  statuses={customStatuses}
                  cards={customCards}
                  boardId={boardId}
                  isSharedBoard={(board?.board_access?.length ?? 0) > 1}
                  userAccessLevel={userAccessLevel}
                  initialOpenCardId={cardIdToOpen}
                  onStatusUpdate={handleStatusUpdate}
                  onStatusDelete={handleStatusDelete}
                  onStatusReorder={handleStatusReorder}
                  onStatusAdd={handleStatusAdd}
                  onCardUpdate={handleCardUpdate}
                  onCardAdd={handleCardAdd}
                  onCardDelete={handleCardDelete}
                  onCardRefresh={handleCardRefresh}
                />
              )}
            </div>
          </>
        )}
      </div>

      {/* Share Modal */}
      {!isCasesBoard && board && board.owner_id && (
        <ShareBoardModal
          isOpen={isShareModalOpen}
          onClose={() => setIsShareModalOpen(false)}
          boardId={boardId}
          boardName={board.name}
          boardOwnerId={board.owner_id}
          onUpdate={() => {
            handleFullRefresh() // Refresh board data (to update access list)
            refreshBoardList?.refreshBoard(boardId) // Refresh this board in sidebar
          }}
        />
      )}
    </>
  )
}
