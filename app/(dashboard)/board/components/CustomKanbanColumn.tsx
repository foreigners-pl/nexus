'use client'

import { useState, useEffect } from 'react'
import { BoardStatus, Card } from '@/types/database'
import { updateBoardStatus, deleteBoardStatus, reorderBoardStatuses } from '@/app/actions/board/statuses'
import { CustomKanbanCard } from './CustomKanbanCard'
import { CardModal } from './CardModal'
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { useDroppable } from '@dnd-kit/core'

interface CustomKanbanColumnProps {
  status: BoardStatus
  cards: any[]
  boardId: string
  isSharedBoard: boolean
  userAccessLevel?: 'owner' | 'editor' | 'viewer' | null
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
  dragHandleProps?: any
  onAddCard?: () => void
  onEditCard?: (card: any) => void
}

export function CustomKanbanColumn({ 
  status,
  cards,
  boardId,
  isSharedBoard,
  userAccessLevel,
  onUpdate,
  onDelete,
  onReorder,
  allStatuses,
  statusIndex,
  totalStatuses,
  onCardUpdate,
  onCardAdd,
  onCardDelete,
  onCardRefresh,
  dragHandleProps
}: CustomKanbanColumnProps) {
  // Modal state now handled at board level

  // Check if this is a "Done" status (protected from deletion)
  const isDoneStatus = status.name.toLowerCase().includes('done')
  // Props for modal triggers
  const { onAddCard, onEditCard } = arguments[0]
  const isViewOnly = userAccessLevel === 'viewer'
  const [isEditingName, setIsEditingName] = useState(false)
  const [editName, setEditName] = useState(status.name)
  const [showColorPicker, setShowColorPicker] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  // Make the column a drop target for cards
  const { setNodeRef: setDroppableRef } = useDroppable({
    id: `status-${status.id}`,
  })

  useEffect(() => {
    setEditName(status.name)
  }, [status.name])

  const handleNameSave = async () => {
    if (!editName.trim() || editName === status.name) {
      setIsEditingName(false)
      return
    }

    setSubmitting(true)
    
    // Optimistic update
    onUpdate(status.id, { name: editName })
    
    const result = await updateBoardStatus(status.id, { name: editName })
    if (result?.error) {
      // Rollback on error
      setEditName(status.name)
      onUpdate(status.id, { name: status.name })
      alert(result.error)
    }
    
    setSubmitting(false)
    setIsEditingName(false)
  }

  const handleColorChange = async (color: string) => {
    setSubmitting(true)
    
    // Optimistic update
    onUpdate(status.id, { color })
    
    const result = await updateBoardStatus(status.id, { color })
    if (result?.error) {
      // Rollback on error
      onUpdate(status.id, { color: status.color })
      alert(result.error)
    }
    
    setSubmitting(false)
    setShowColorPicker(false)
  }

  const handleDelete = async () => {
    // Prevent deletion of Done status
    if (isDoneStatus) {
      alert('The "Done" status cannot be deleted. Every board must have a Done status for task completion tracking.')
      return
    }
    
    if (!confirm('Delete this status? Tasks in this status must be moved first.')) return

    setSubmitting(true)
    
    const result = await deleteBoardStatus(status.id)
    if (!result?.error) {
      // Successful delete - parent will handle removal
      onDelete(status.id)
    } else {
      alert(result.error)
    }
    
    setSubmitting(false)
  }

  // Card update handler - refetch only this specific card
  // Card update handler - refetch only this specific card
  const handleCardUpdate = async (cardId: string) => {
    // Refresh just this card instead of the entire board
    await onCardRefresh(cardId)
  }

  // Optimistic card addition
  const handleCardAdded = (newCard?: Card) => {
    if (newCard) {
      onCardAdd(newCard)
    }
  }

  // Sort cards by position
  const statusCards = [...cards].sort((a, b) => (a.position || 0) - (b.position || 0))

  // Convert hex color to rgba with transparency
  const hexToRgba = (hex: string, alpha: number) => {
    const r = parseInt(hex.slice(1, 3), 16)
    const g = parseInt(hex.slice(3, 5), 16)
    const b = parseInt(hex.slice(5, 7), 16)
    return `rgba(${r}, ${g}, ${b}, ${alpha})`
  }

  const statusColor = status.color || '#94a3b8'
  const glassyBackground = hexToRgba(statusColor, 0.08) // 8% opacity for subtle effect

  return (
    <>
      <div className="flex-shrink-0 w-64 h-full" ref={setDroppableRef}>
        <div 
          className="rounded-2xl p-3 border h-full flex flex-col transition-all backdrop-blur-xl border-[hsl(var(--color-border))] shadow-[0_8px_32px_rgb(0_0_0/0.15)]"
          style={{ 
            backgroundColor: glassyBackground 
          }}
        >
          {/* Column Header with Inline Editing */}
          <div className="flex items-center justify-between mb-3 flex-shrink-0">
            <div className="flex items-center gap-2 flex-1">
              {/* Color Indicator - Click to change color (not for viewers) */}
              <div className="relative">
                {isViewOnly ? (
                  <div
                    className="w-4 h-4 rounded-full border-2 border-white shadow-sm"
                    style={{ backgroundColor: status.color || '#94a3b8' }}
                  />
                ) : (
                  <button
                    onClick={() => setShowColorPicker(!showColorPicker)}
                    className="w-4 h-4 rounded-full border-2 border-white shadow-sm cursor-pointer hover:scale-110 transition-transform"
                    style={{ backgroundColor: status.color || '#94a3b8' }}
                    title="Click to change color"
                    disabled={submitting}
                  />
                )}
                {showColorPicker && (
                  <div className="absolute top-8 left-0 z-50 p-2 bg-[hsl(var(--color-surface))] border border-[hsl(var(--color-border))] rounded-lg shadow-lg">
                    <input
                      type="color"
                      value={status.color || '#94a3b8'}
                      onChange={(e) => handleColorChange(e.target.value)}
                      disabled={submitting}
                      className="w-32 h-8 cursor-pointer"
                    />
                  </div>
                )}
              </div>

              {/* Status Name - Click to edit (not for viewers) */}
              {isEditingName && !isViewOnly ? (
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  onBlur={handleNameSave}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleNameSave()
                    if (e.key === 'Escape') {
                      setEditName(status.name)
                      setIsEditingName(false)
                    }
                  }}
                  disabled={submitting}
                  autoFocus
                  className="flex-1 px-2 py-1 font-semibold bg-[hsl(var(--color-background))] border border-[hsl(var(--color-border))] rounded text-[hsl(var(--color-text-primary))] focus:outline-none focus:ring-2 focus:ring-[hsl(var(--color-primary))]"
                />
              ) : (
                <h3 
                  onClick={() => !isViewOnly && setIsEditingName(true)}
                  className={`font-semibold text-xs text-[hsl(var(--color-text-primary))] ${!isViewOnly ? 'cursor-pointer hover:text-[hsl(var(--color-primary))]' : ''} transition-colors`}
                  title={isViewOnly ? status.name : "Click to edit"}
                >
                  {status.name}
                </h3>
              )}

              <span className="text-xs text-[hsl(var(--color-text-secondary))]">
                ({statusCards.length})
              </span>
            </div>

            {/* Drag Handle and Delete Button - hidden for viewers */}
            {!isViewOnly && (
              <div className="flex items-center gap-1 ml-2">
                {/* Drag Handle - 6 dots in 2 columns */}
                {dragHandleProps && (
                  <div 
                    {...dragHandleProps}
                    className="p-1 cursor-grab active:cursor-grabbing hover:bg-[hsl(var(--color-background))] rounded transition-colors"
                    title="Drag to reorder"
                  >
                    <svg className="w-4 h-4 text-[hsl(var(--color-text-secondary))]" viewBox="0 0 16 16" fill="currentColor">
                      <circle cx="4" cy="3" r="1.5"/>
                      <circle cx="4" cy="8" r="1.5"/>
                      <circle cx="4" cy="13" r="1.5"/>
                      <circle cx="12" cy="3" r="1.5"/>
                      <circle cx="12" cy="8" r="1.5"/>
                      <circle cx="12" cy="13" r="1.5"/>
                    </svg>
                  </div>
                )}
                {/* Hide delete button for Done status */}
                {!isDoneStatus && (
                  <button
                    onClick={handleDelete}
                    disabled={submitting}
                    className="p-1 hover:bg-red-500/10 text-red-500 rounded transition-colors disabled:opacity-50"
                    title="Delete status"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Add Task Button - hidden for viewers */}
          {!isViewOnly && (
            <button 
              onClick={() => onAddCard && onAddCard()}
              className="w-full text-center px-3 py-2 text-xs text-[hsl(var(--color-text-secondary))] hover:bg-[hsl(var(--color-surface-hover))] rounded-lg transition-colors border border-dashed border-[hsl(var(--color-border))] mb-3"
            >
              + Add Task
            </button>
          )}

          {/* Cards Container */}
          <SortableContext items={statusCards.map(c => c.id)} strategy={verticalListSortingStrategy}>
            <div className="space-y-3 flex-1 overflow-y-auto pr-1 scrollbar-thin">
              {statusCards.map(card => (
                <CustomKanbanCard
                  key={card.id}
                  card={card}
                  isSharedBoard={isSharedBoard}
                  onUpdate={() => handleCardUpdate(card.id)}
                  onEdit={() => onEditCard && onEditCard(card)}
                  onDelete={onCardDelete}
                  userAccessLevel={userAccessLevel}
                />
              ))}
            </div>
          </SortableContext>
        </div>
      </div>

      {/* Modals are now rendered at board level for proper popup positioning */}
    </>
  )
}
