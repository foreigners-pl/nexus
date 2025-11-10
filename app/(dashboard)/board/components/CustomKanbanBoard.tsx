'use client'

import { useState } from 'react'
import { BoardStatus } from '@/types/database'
import { CustomKanbanColumn } from './CustomKanbanColumn'
import { CustomKanbanCard } from './CustomKanbanCard'
import { CardModal } from './CardModal'
import { createBoardStatus } from '@/app/actions/board/statuses'
import { Button } from '@/components/ui/Button'
import { 
  DndContext, 
  DragEndEvent, 
  DragOverlay, 
  DragStartEvent, 
  PointerSensor, 
  useSensor, 
  useSensors, 
  closestCenter,
  DragOverEvent
} from '@dnd-kit/core'
import { SortableContext, horizontalListSortingStrategy, useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { updateCard as updateCardAction } from '@/app/actions/card/core'
import { reorderBoardStatuses } from '@/app/actions/board/statuses'

interface CustomKanbanBoardProps {
  statuses: BoardStatus[]
  cards: any[]
  boardId: string
  isSharedBoard: boolean
  onStatusUpdate: (statusId: string, updates: Partial<BoardStatus>) => void
  onStatusDelete: (statusId: string) => void
  onStatusReorder: (fromIndex: number, toIndex: number) => void
  onStatusAdd: (newStatus: BoardStatus) => void
  onCardUpdate: (cardId: string, updates: Partial<any>) => void
  onCardAdd: (newCard: any) => void
  onCardDelete: (cardId: string) => void
  onCardRefresh: (cardId: string) => Promise<void>
}

export function CustomKanbanBoard({ 
  statuses,
  cards,
  boardId,
  isSharedBoard,
  onStatusUpdate,
  onStatusDelete,
  onStatusReorder,
  onStatusAdd,
  onCardUpdate,
  onCardAdd,
  onCardDelete,
  onCardRefresh
}: CustomKanbanBoardProps) {
  const [isAddingStatus, setIsAddingStatus] = useState(false)
  const [newStatusName, setNewStatusName] = useState('')
  const [newStatusColor, setNewStatusColor] = useState('#3b82f6')
  const [submitting, setSubmitting] = useState(false)
  const [activeCard, setActiveCard] = useState<any>(null)
  const [activeStatus, setActiveStatus] = useState<BoardStatus | null>(null)
  const [isDraggingStatus, setIsDraggingStatus] = useState(false)
  // Modal state for adding/editing cards
  const [modalStatusId, setModalStatusId] = useState<string | null>(null)
  const [modalCard, setModalCard] = useState<any | null>(null)
  const [isCardModalOpen, setIsCardModalOpen] = useState(false)

  // Configure drag sensors
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8, // 8px movement required to start drag
      },
    })
  )

  // Sort statuses by position
  const sortedStatuses = [...statuses].sort((a, b) => a.position - b.position)

  const handleDragStart = (event: DragStartEvent) => {
    const { active } = event
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    console.log('🎯 DRAG START - Active ID:', active.id)
    
    // Log all status positions BEFORE drag
    console.log('📊 STATUS POSITIONS BEFORE DRAG:')
    sortedStatuses.forEach((s, idx) => {
      console.log(`  [${idx}] ${s.name} (id: ${s.id}, position: ${s.position})`)
    })

    const status = sortedStatuses.find(s => `status-${s.id}` === active.id)
    if (status) {
      const statusIndex = sortedStatuses.findIndex(s => s.id === status.id)
      console.log(`🔴 DRAGGING STATUS: "${status.name}" at INDEX ${statusIndex}`)
      setActiveStatus(status)
      setIsDraggingStatus(true)
    }

    const card = cards.find(c => c.id === active.id)
    if (card) {
      console.log('🃏 DRAGGING CARD:', card.title, 'ID:', card.id)
      setActiveCard(card)
    }
  }

  const handleDragOver = (event: DragOverEvent) => {
    // This handles card dragging over different statuses
    // Status reordering is handled in handleDragEnd
  }

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event
    
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    console.log('🏁 DRAG END - Active:', active.id, 'Over:', over?.id)
    
    setActiveCard(null)
    setActiveStatus(null)
    setIsDraggingStatus(false)

    if (!over) {
      console.log('❌ No drop target - drag cancelled')
      return
    }

    // Handle status column reordering
    if (active.id.toString().startsWith('status-') && over.id.toString().startsWith('status-')) {
      console.log('🔄 STATUS REORDER DETECTED!')
      const activeId = active.id.toString().replace('status-', '')
      const overId = over.id.toString().replace('status-', '')
      
      if (activeId === overId) {
        console.log('❌ Same position - no reorder needed')
        return
      }

      const oldIndex = sortedStatuses.findIndex(s => s.id === activeId)
      const newIndex = sortedStatuses.findIndex(s => s.id === overId)

      console.log(`� DRAGGED STATUS INDEX: ${oldIndex} → ${newIndex}`)
      console.log(`   Moving "${sortedStatuses[oldIndex]?.name}" to position of "${sortedStatuses[newIndex]?.name}"`)

      if (oldIndex === -1 || newIndex === -1) {
        console.log('❌ Invalid indices')
        return
      }

      // Optimistic update
      console.log('⚡ Calling onStatusReorder...')
      onStatusReorder(oldIndex, newIndex)

      // Update in database
      const newOrder = [...sortedStatuses]
      const [movedStatus] = newOrder.splice(oldIndex, 1)
      newOrder.splice(newIndex, 0, movedStatus)
      const statusIds = newOrder.map(s => s.id)
      
      console.log('💾 Saving new order to database:', newOrder.map(s => s.name))
      const result = await reorderBoardStatuses(boardId, statusIds)
      if (result?.error) {
        console.error('❌ Database save FAILED:', result.error)
        // Rollback on error
        onStatusReorder(newIndex, oldIndex)
        alert(result.error)
      } else {
        console.log('✅ Database save SUCCESS')
        // Log final positions
        console.log('📊 STATUS POSITIONS AFTER REORDER:')
        newOrder.forEach((s, idx) => {
          console.log(`  [${idx}] ${s.name}`)
        })
      }
      return
    }

    // Handle card dragging to different status
    // Cards are dropped on status-{statusId} now (same as sortable items)
    console.log('🃏 Checking for CARD MOVE...')
    const cardId = active.id as string
    let newStatusId = over.id as string

    // Extract status ID - it will be in format status-{uuid}
    if (newStatusId.startsWith('status-')) {
      newStatusId = newStatusId.replace('status-', '')
      console.log(`   Card dropped on status column: ${newStatusId}`)
    } else {
      // Shouldn't happen, but handle direct ID
      console.log(`   Card dropped with direct ID: ${newStatusId}`)
    }

    // Find the card being moved
    const card = cards.find(c => c.id === cardId)
    if (!card) {
      console.log('❌ Card not found:', cardId)
      return
    }

    console.log(`🃏 CARD MOVE detected: "${card.title}" → status ${newStatusId}`)

    // If dropped on same status, do nothing
    if (card.status_id === newStatusId) {
      console.log('❌ Same status - no move needed')
      return
    }

    // Optimistic update
    onCardUpdate(cardId, { status_id: newStatusId })

    // Update in database
    const result = await updateCardAction(cardId, { status_id: newStatusId })
    if (result?.error) {
      console.error('❌ Card move FAILED:', result.error)
      // Rollback on error
      onCardUpdate(cardId, { status_id: card.status_id })
      alert(result.error)
    } else {
      console.log('✅ Card move SUCCESS')
    }
  }

  const handleAddStatus = async () => {
    if (!newStatusName.trim()) return

    setSubmitting(true)
    const result = await createBoardStatus(boardId, newStatusName, newStatusColor)

    if (result?.error) {
      alert(result.error)
    } else if (result?.data) {
      // Notify parent with the new status
      onStatusAdd(result.data)
      setNewStatusName('')
      setNewStatusColor('#3b82f6')
      setIsAddingStatus(false)
    }
    
    setSubmitting(false)
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
    >
      <SortableContext 
        items={sortedStatuses.map(s => `status-${s.id}`)} 
        strategy={horizontalListSortingStrategy}
      >
        <div className="flex gap-4 h-full">
          {sortedStatuses.map((status, index) => (
            <SortableStatusColumn
              key={status.id}
              status={status}
              cards={cards.filter(c => c.status_id === status.id)}
              boardId={boardId}
              isSharedBoard={isSharedBoard}
              onUpdate={onStatusUpdate}
              onDelete={onStatusDelete}
              onReorder={onStatusReorder}
              allStatuses={sortedStatuses}
              statusIndex={index}
              totalStatuses={sortedStatuses.length}
              onCardUpdate={onCardUpdate}
              onCardAdd={onCardAdd}
              onCardDelete={onCardDelete}
              onCardRefresh={onCardRefresh}
              isDragging={isDraggingStatus && activeStatus?.id === status.id}
              // Modal triggers
              onAddCard={() => {
                setModalStatusId(status.id)
                setModalCard(null)
                setIsCardModalOpen(true)
              }}
              onEditCard={(card: any) => {
                setModalStatusId(status.id)
                setModalCard(card)
                setIsCardModalOpen(true)
              }}
            />
          ))}
      {/* Card Modal rendered at board level for proper popup positioning */}
      {isCardModalOpen && (
        <CardModal
          isOpen={isCardModalOpen}
          onClose={() => setIsCardModalOpen(false)}
          onSuccess={(card) => {
            if (modalCard && card) {
              // Edit success
              onCardUpdate(modalCard.id, card)
            } else if (card) {
              // Add success
              onCardAdd(card)
            }
            setIsCardModalOpen(false)
            setModalCard(null)
            setModalStatusId(null)
          }}
          boardId={boardId}
          statusId={modalStatusId || ''}
          card={modalCard}
          isSharedBoard={isSharedBoard}
        />
      )}

        {/* Add Status Column */}
        <div className="flex-shrink-0 w-80">
          {isAddingStatus ? (
          <div className="bg-[hsl(var(--color-surface))] rounded-lg p-4 border border-dashed border-[hsl(var(--color-border))]">
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={newStatusColor}
                  onChange={(e) => setNewStatusColor(e.target.value)}
                  disabled={submitting}
                  className="w-8 h-8 rounded cursor-pointer"
                />
                <input
                  type="text"
                  value={newStatusName}
                  onChange={(e) => setNewStatusName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleAddStatus()
                    if (e.key === 'Escape') {
                      setIsAddingStatus(false)
                      setNewStatusName('')
                    }
                  }}
                  placeholder="Status name..."
                  disabled={submitting}
                  autoFocus
                  className="flex-1 px-3 py-2 bg-[hsl(var(--color-background))] border border-[hsl(var(--color-border))] rounded text-[hsl(var(--color-text-primary))] focus:outline-none focus:ring-2 focus:ring-[hsl(var(--color-primary))]"
                />
              </div>
              <div className="flex gap-2">
                <Button onClick={handleAddStatus} disabled={submitting || !newStatusName.trim()} className="flex-1">
                  Add
                </Button>
                <Button
                  onClick={() => {
                    setIsAddingStatus(false)
                    setNewStatusName('')
                  }}
                  variant="ghost"
                  disabled={submitting}
                >
                  Cancel
                </Button>
              </div>
            </div>
          </div>
        ) : (
          <button
            onClick={() => setIsAddingStatus(true)}
            className="w-full h-full min-h-[200px] border-2 border-dashed border-[hsl(var(--color-border))] rounded-lg hover:border-[hsl(var(--color-primary))] hover:bg-[hsl(var(--color-surface))] transition-colors flex items-center justify-center text-[hsl(var(--color-text-secondary))] hover:text-[hsl(var(--color-primary))]"
          >
            <div className="text-center">
              <svg className="w-8 h-8 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              <p className="font-medium">Add Status</p>
            </div>
          </button>
        )}
        </div>
      </div>
      </SortableContext>

      {/* Drag Overlay - shows what you're dragging */}
        <DragOverlay>
          {activeStatus ? (
            <div className="w-56 opacity-90 rotate-3 cursor-grabbing z-[9999]">
              <CustomKanbanColumn
                status={activeStatus}
                cards={cards.filter(c => c.status_id === activeStatus.id)}
                boardId={boardId}
                isSharedBoard={isSharedBoard}
                onUpdate={() => {}}
                onDelete={() => {}}
                onReorder={() => {}}
                allStatuses={sortedStatuses}
                statusIndex={0}
                totalStatuses={sortedStatuses.length}
                onCardUpdate={() => {}}
                onCardAdd={() => {}}
                onCardDelete={() => {}}
                onCardRefresh={async () => {}}
              />
            </div>
          ) : activeCard ? (
            <div className="opacity-90 rotate-2 z-[9999]">
              {/* Render the actual card as drag ghost */}
              <div style={{ width: '220px', pointerEvents: 'none' }}>
                {/* Pass isDraggingGhost to CustomKanbanCard for styling if needed */}
                <CustomKanbanCard
                  card={activeCard}
                  isSharedBoard={isSharedBoard}
                  onUpdate={() => {}}
                  onEdit={() => {}}
                  isDraggingGhost={true}
                />
              </div>
            </div>
          ) : null}
        </DragOverlay>
    </DndContext>
  )
}

// Sortable wrapper for status columns
interface SortableStatusColumnProps {
  status: BoardStatus
  cards: any[]
  boardId: string
  isSharedBoard: boolean
  onUpdate: (statusId: string, updates: Partial<BoardStatus>) => void
  onDelete: (statusId: string) => void
  onReorder: (fromIndex: number, toIndex: number) => void
  allStatuses: BoardStatus[]
  statusIndex: number
  totalStatuses: number
  onCardUpdate: (cardId: string, updates: Partial<any>) => void
  onCardAdd: (newCard: any) => void
  onCardDelete: (cardId: string) => void
  onCardRefresh: (cardId: string) => Promise<void>
  isDragging: boolean
  onAddCard?: () => void
  onEditCard?: (card: any) => void
}

function SortableStatusColumn(props: SortableStatusColumnProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging: isSortableDragging,
  } = useSortable({ 
    id: `status-${props.status.id}`,
    data: {
      type: 'status',
      status: props.status
    }
  })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    // Hide the original when dragging (the DragOverlay shows it)
    opacity: isSortableDragging ? 0.3 : 1,
    // Add smooth animations
    willChange: 'transform',
  }

  // The entire wrapper is BOTH sortable (for status reordering) AND droppable (for card drops)
  // @dnd-kit handles this automatically!
  return (
    <div 
      ref={setNodeRef} 
      style={style} 
      className="transition-opacity duration-200"
    >
      <CustomKanbanColumn 
        {...props} 
        dragHandleProps={{ ...attributes, ...listeners }}
        onAddCard={props.onAddCard}
        onEditCard={props.onEditCard}
      />
    </div>
  )
}
