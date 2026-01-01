'use client'

import { useState } from 'react'
import { Card as CardType, User, CardAssignee } from '@/types/database'
import { deleteCard } from '@/app/actions/card/core'
import { Card } from '@/components/ui/Card'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import type { CSSProperties } from 'react'

interface CardWithAssignees extends CardType {
  card_assignees?: (CardAssignee & { users?: User })[]
}

interface CustomKanbanCardProps {
  card: CardWithAssignees
  isSharedBoard: boolean
  userAccessLevel?: 'owner' | 'editor' | 'viewer' | null
  onUpdate: () => void
  onEdit: (card: CardWithAssignees) => void
  onDelete?: (cardId: string) => void
  isDraggingGhost?: boolean
}

export function CustomKanbanCard({ card, isSharedBoard, userAccessLevel, onUpdate, onEdit, onDelete, isDraggingGhost = false }: CustomKanbanCardProps) {
  const [isDeleting, setIsDeleting] = useState(false)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  
  const isViewOnly = userAccessLevel === 'viewer'
  
  // Setup sortable (allows both dragging within column and between columns)
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: card.id,
    data: {
      type: 'card',
      card: card
    }
  })

  const style: CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDraggingGhost ? 0.8 : isDragging ? 0.5 : 1,
    zIndex: isDraggingGhost ? 9999 : isDragging ? 1000 : 'auto',
    pointerEvents: isDraggingGhost ? 'none' : undefined,
  }
  
  // Use assignees from the card prop (already fetched)
  const assignees = card.card_assignees || []

  const handleDelete = async () => {
    setIsDeleting(true)
    const result = await deleteCard(card.id)
    
    if (result?.error) {
      alert(result.error)
      setIsDeleting(false)
      setShowDeleteModal(false)
    } else {
      // Call onDelete to remove from parent state
      onDelete?.(card.id)
      setShowDeleteModal(false)
    }
  }

  const handleEdit = () => {
    onEdit({ ...card, card_assignees: assignees })
  }

  const formatDueDate = (dateString: string | null | undefined) => {
    if (!dateString) return null
    const date = new Date(dateString)
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const dueDate = new Date(date)
    dueDate.setHours(0, 0, 0, 0)
    
    const isOverdue = dueDate < today
    const isToday = dueDate.getTime() === today.getTime()
    const isFuture = dueDate > today
    
    return {
      text: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      isOverdue,
      isToday,
      isFuture
    }
  }

  const formatCreatedDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  }

  const dueDate = formatDueDate(card.due_date)
  const createdDate = formatCreatedDate(card.created_at)

  return (
    <div ref={setNodeRef} style={style} {...listeners} {...attributes}>
      <Card 
        className="p-3 cursor-grab active:cursor-grabbing hover:shadow-md transition-shadow group"
        onClick={handleEdit}
      >
        <div className="space-y-2">
          <div className="flex items-start justify-between gap-2">
            <h4 className="font-medium text-[hsl(var(--color-text-primary))] text-xs flex-1">
              {card.title}
            </h4>
            {/* Delete button - hidden for viewers */}
            {!isViewOnly && (
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  setShowDeleteModal(true)
                }}
                disabled={isDeleting}
                className="opacity-0 group-hover:opacity-100 text-red-500 hover:text-red-600 transition-opacity p-1 flex-shrink-0"
                title="Delete task"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>

          {/* Assignees Row */}
          {assignees.length > 0 && (
            <div className="flex items-center gap-1">
              {assignees.slice(0, 3).map((assignee) => (
                <div
                  key={assignee.id}
                  className="w-6 h-6 rounded-full bg-[hsl(var(--color-primary))] text-white text-xs flex items-center justify-center font-medium"
                  title={assignee.users?.display_name || assignee.users?.email || 'Unknown'}
                >
                  {(assignee.users?.display_name || assignee.users?.email || '?')[0].toUpperCase()}
                </div>
              ))}
              {assignees.length > 3 && (
                <div
                  className="w-6 h-6 rounded-full bg-[hsl(var(--color-surface))] border border-[hsl(var(--color-border))] text-xs flex items-center justify-center font-medium text-[hsl(var(--color-text-secondary))]"
                  title={`${assignees.length - 3} more`}
                >
                  +{assignees.length - 3}
                </div>
              )}
            </div>
          )}

          {/* Dates Row - Created on left, Due on right */}
          <div className="flex items-center justify-between gap-2 text-xs">
            {/* Created Date - Always show on left */}
            <div className="text-[hsl(var(--color-text-secondary))]">
              {createdDate}
            </div>

            {/* Due Date - Show on right if set */}
            {dueDate && (
              <div className={`px-2 py-0.5 rounded font-medium ${
                dueDate.isOverdue 
                  ? 'bg-red-500/10 text-red-500' 
                  : dueDate.isToday
                    ? 'bg-green-500/10 text-green-500'
                    : 'bg-blue-500/10 text-blue-500'
              }`}>
                {dueDate.text}
              </div>
            )}
          </div>
        </div>
      </Card>

      {/* Delete Confirmation Modal */}
      <Modal 
        isOpen={showDeleteModal} 
        onClose={() => setShowDeleteModal(false)} 
        title="Delete Task"
        maxWidth="sm"
      >
        <div className="space-y-4">
          <p className="text-[hsl(var(--color-text-secondary))]">
            Are you sure you want to delete "<span className="font-medium text-[hsl(var(--color-text-primary))]">{card.title}</span>"? This action cannot be undone.
          </p>
          <div className="flex justify-end gap-3">
            <Button
              variant="ghost"
              onClick={() => setShowDeleteModal(false)}
              disabled={isDeleting}
            >
              Cancel
            </Button>
            <Button
              onClick={handleDelete}
              disabled={isDeleting}
              className="bg-red-500 hover:bg-red-600 text-white"
            >
              {isDeleting ? 'Deleting...' : 'Delete'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}