'use client'

import { useState } from 'react'
import { Card as CardType, User, CardAssignee } from '@/types/database'
import { deleteCard } from '@/app/actions/card/core'
import { Card } from '@/components/ui/Card'
import { useDraggable } from '@dnd-kit/core'
import { CSS } from '@dnd-kit/utilities'

interface CardWithAssignees extends CardType {
  card_assignees?: (CardAssignee & { users?: User })[]
}

interface CustomKanbanCardProps {
  card: CardWithAssignees
  isSharedBoard: boolean
  onUpdate: () => void
  onEdit: (card: CardWithAssignees) => void
}

export function CustomKanbanCard({ card, isSharedBoard, onUpdate, onEdit }: CustomKanbanCardProps) {
  const [isDeleting, setIsDeleting] = useState(false)
  
  // Setup draggable
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: card.id,
    data: {
      type: 'card',
      card: card
    }
  })

  const style = {
    transform: CSS.Translate.toString(transform),
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 1000 : 'auto',
  }
  
  // Use assignees from the card prop (already fetched)
  const assignees = card.card_assignees || []

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this task?')) return
    
    setIsDeleting(true)
    const result = await deleteCard(card.id)
    
    if (result?.error) {
      alert(result.error)
      setIsDeleting(false)
    } else {
      onUpdate()
    }
  }

  const handleEdit = () => {
    onEdit({ ...card, card_assignees: assignees })
  }

  const formatDueDate = (dateString: string | null | undefined) => {
    if (!dateString) return null
    const date = new Date(dateString)
    const now = new Date()
    const isOverdue = date < now
    const isToday = date.toDateString() === now.toDateString()
    
    return {
      text: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      isOverdue,
      isToday
    }
  }

  const dueDate = formatDueDate(card.due_date)

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
          <button
            onClick={(e) => {
              e.stopPropagation()
              handleDelete()
            }}
            disabled={isDeleting}
            className="opacity-0 group-hover:opacity-100 text-red-500 hover:text-red-600 transition-opacity p-1 flex-shrink-0"
            title="Delete task"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {card.description && (
          <p className="text-xs text-[hsl(var(--color-text-secondary))] line-clamp-2">
            {card.description}
          </p>
        )}

        <div className="flex items-center justify-between gap-2 pt-1">
          <div className="flex items-center gap-2 flex-1">
            {/* Date - Show due date if set, otherwise created date */}
            {dueDate ? (
              <div className={`text-xs px-2 py-0.5 rounded ${
                dueDate.isOverdue 
                  ? 'bg-red-500/10 text-red-500' 
                  : dueDate.isToday
                    ? 'bg-amber-500/10 text-amber-500'
                    : 'bg-blue-500/10 text-blue-500'
              }`} title="Due date">
                📅 {dueDate.text}
              </div>
            ) : (
              <div className="text-xs text-[hsl(var(--color-text-secondary))]" title="Created">
                {new Date(card.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
              </div>
            )}
          </div>

          {/* Assignees - Show on all boards if there are assignees */}
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
        </div>
        </div>
      </Card>
    </div>
  )
}