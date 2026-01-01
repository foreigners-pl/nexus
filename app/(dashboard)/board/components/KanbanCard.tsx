'use client'

import Link from 'next/link'
import { Case, Client, Status } from '@/types/database'
import { Card } from '@/components/ui/Card'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

interface CaseWithRelations extends Case {
  clients?: Client
  status?: Status
}

interface KanbanCardProps {
  caseItem: CaseWithRelations
  isDragging?: boolean
}

export function KanbanCard({ caseItem, isDragging = false }: KanbanCardProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging: isDraggingActive } = useSortable({
    id: caseItem.id,
    data: {
      type: 'case',
      caseItem: caseItem
    }
  })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.8 : isDraggingActive ? 0.5 : 1,
    cursor: isDraggingActive ? 'grabbing' : 'grab',
  }

  const getClientDisplayName = () => {
    if (!caseItem.clients) return 'No Client'
    const { first_name, last_name, contact_email } = caseItem.clients
    if (first_name && last_name) return `${first_name} ${last_name}`
    if (first_name) return first_name
    if (last_name) return last_name
    if (contact_email) return contact_email
    return 'Unnamed Client'
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
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
    
    return {
      text: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      isOverdue,
      isToday,
      isFuture: dueDate > today
    }
  }

  const dueDate = formatDueDate(caseItem.due_date)

  return (
    <div 
      ref={setNodeRef} 
      style={style} 
      {...listeners} 
      {...attributes}
    >
      <Link href={`/cases/${caseItem.id}`} onClick={(e) => isDraggingActive && e.preventDefault()}>
        <Card className="p-3 hover:shadow-lg transition-shadow cursor-pointer border border-[hsl(var(--color-border))]">
          <div className="space-y-2">
          {/* Title: Case Code */}
          <div className="font-medium text-sm text-[hsl(var(--color-text-primary))]">
            {caseItem.case_code || 'No Code'}
          </div>

          {/* Assignees */}
          {caseItem.case_assignees && caseItem.case_assignees.length > 0 && (
            <div className="flex items-center gap-1 flex-wrap">
              {caseItem.case_assignees.slice(0, 3).map((assignee) => (
                <div
                  key={assignee.id}
                  className="flex items-center justify-center w-6 h-6 rounded-full bg-[hsl(var(--color-primary))]/10 text-[hsl(var(--color-primary))] text-xs font-medium"
                  title={assignee.users?.display_name || assignee.users?.email || 'Unknown'}
                >
                  {(assignee.users?.display_name || assignee.users?.email || '?').charAt(0).toUpperCase()}
                </div>
              ))}
              {caseItem.case_assignees.length > 3 && (
                <div className="flex items-center justify-center w-6 h-6 rounded-full bg-[hsl(var(--color-border))] text-[hsl(var(--color-text-secondary))] text-xs font-medium">
                  +{caseItem.case_assignees.length - 3}
                </div>
              )}
            </div>
          )}
          
          {/* Dates Row - Created on left, Due on right */}
          <div className="flex items-center justify-between gap-2 text-xs">
            {/* Created Date */}
            <div className="text-[hsl(var(--color-text-secondary))]">
              {formatDate(caseItem.created_at)}
            </div>

            {/* Due Date with color coding */}
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
    </Link>
    </div>
  )
}
