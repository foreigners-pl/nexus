'use client'

import { Status, Case, Client } from '@/types/database'
import { KanbanColumn } from './KanbanColumn'
import { 
  DndContext, 
  DragEndEvent,
  DragOverEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor, 
  useSensor, 
  useSensors,
  closestCorners,
  rectIntersection,
  pointerWithin,
  getFirstCollision,
  CollisionDetection,
  UniqueIdentifier
} from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy, arrayMove } from '@dnd-kit/sortable'
import { useState, useRef, useCallback } from 'react'
import { updateCaseStatus, moveCase } from '@/app/actions/cases'
import { KanbanCard } from './KanbanCard'

interface CaseWithRelations extends Case {
  clients?: Client
  status?: Status
}

interface KanbanBoardProps {
  statuses: Status[]
  cases: CaseWithRelations[]
  onUpdate: () => void
  onCaseStatusUpdate?: (caseId: string, newStatusId: string) => void
  onCaseUpdate?: (caseId: string, updates: Partial<Case>) => void
  userAccessLevel?: 'owner' | 'editor' | 'viewer' | null
}

export function KanbanBoard({ statuses, cases, onUpdate, onCaseStatusUpdate, onCaseUpdate, userAccessLevel }: KanbanBoardProps) {
  const [activeCase, setActiveCase] = useState<CaseWithRelations | null>(null)

  const lastOverId = useRef<UniqueIdentifier | null>(null)
  const recentlyMovedToNewContainer = useRef(false)

  // Custom collision detection for multi-container
  const collisionDetectionStrategy: CollisionDetection = useCallback(
    (args) => {
      const pointerIntersections = pointerWithin(args)
      const intersections =
        pointerIntersections.length > 0
          ? pointerIntersections
          : rectIntersection(args)

      let overId = getFirstCollision(intersections, 'id')

      if (overId != null) {
        // If it's a status column ID
        const status = statuses.find(s => s.id === overId)
        if (status) {
          const casesInStatus = cases.filter(c => c.status_id === overId)

          // If column has items, find the closest case
          if (casesInStatus.length > 0) {
            overId = closestCorners({
              ...args,
              droppableContainers: args.droppableContainers.filter(
                (container) => 
                  container.id !== overId &&
                  casesInStatus.some(c => c.id === container.id)
              ),
            })[0]?.id
          }
        }

        lastOverId.current = overId
        return [{ id: overId }]
      }

      if (recentlyMovedToNewContainer.current) {
        lastOverId.current = args.active.id
      }

      return lastOverId.current ? [{ id: lastOverId.current }] : []
    },
    [cases, statuses]
  )

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  )

  const getCasesForStatus = (statusId: string) => {
    return cases.filter(c => c.status?.id === statusId)
  }

  const handleDragStart = (event: DragStartEvent) => {
    const { active } = event
    const caseItem = cases.find(c => c.id === active.id)
    if (caseItem) {
      setActiveCase(caseItem)
    }
  }

  const handleDragOver = (event: DragOverEvent) => {
    const { active, over } = event
    if (!over || !onCaseUpdate) return

    const activeId = active.id as string
    const overId = over.id as string

    if (activeId === overId) return

    const activeCase = cases.find(c => c.id === activeId)
    if (!activeCase) return

    const overCase = cases.find(c => c.id === overId)
    let overStatusId: string | null = null

    if (overCase) {
      overStatusId = overCase.status_id || null
    } else {
      // It's a status column
      overStatusId = overId
    }

    if (!overStatusId) return

    const activeStatusId = activeCase.status_id

    // Same status - reorder within column using arrayMove
    if (activeStatusId === overStatusId && overCase) {
      const casesInStatus = cases
        .filter(c => c.status_id === activeStatusId)
        .sort((a, b) => (a.position || 0) - (b.position || 0))
      
      const oldIndex = casesInStatus.findIndex(c => c.id === activeId)
      const newIndex = casesInStatus.findIndex(c => c.id === overId)

      if (oldIndex !== -1 && newIndex !== -1 && oldIndex !== newIndex) {
        // Reorder the cases in this status
        const reordered = arrayMove(casesInStatus, oldIndex, newIndex)
        
        // Update positions for all cases in this status
        reordered.forEach((caseItem, idx) => {
          onCaseUpdate(caseItem.id, { position: idx })
        })
      }
    }
    // Cross-container move
    else if (activeStatusId !== overStatusId && onCaseStatusUpdate) {
      recentlyMovedToNewContainer.current = true
      
      // Move case to new status at the end
      const casesInTargetStatus = cases.filter(c => c.status_id === overStatusId)
      const newPosition = casesInTargetStatus.length
      
      onCaseStatusUpdate(activeId, overStatusId)
      onCaseUpdate(activeId, { position: newPosition })
      
      setTimeout(() => {
        recentlyMovedToNewContainer.current = false
      }, 500)
    }
  }

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active } = event
    setActiveCase(null)

    const caseId = active.id as string
    const caseItem = cases.find(c => c.id === caseId)
    if (!caseItem) return

    // Save final positions for all cases in the target status
    const casesInStatus = cases
      .filter(c => c.status_id === caseItem.status_id)
      .sort((a, b) => (a.position || 0) - (b.position || 0))
    
    // Update database with final positions
    for (let i = 0; i < casesInStatus.length; i++) {
      await moveCase(casesInStatus[i].id, caseItem.status_id!, i)
    }
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={collisionDetectionStrategy}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
    >
      <div className="flex gap-4 h-full">
        {statuses.map(status => (
          <SortableContext
            key={status.id}
            id={status.id}
            items={getCasesForStatus(status.id).map(c => c.id)}
            strategy={verticalListSortingStrategy}
          >
            <KanbanColumn
              key={status.id}
              status={status}
              cases={getCasesForStatus(status.id)}
              onUpdate={onUpdate}
            />
          </SortableContext>
        ))}
      </div>
      
      <DragOverlay>
        {activeCase ? (
          <div className="w-56">
            <KanbanCard caseItem={activeCase} isDragging />
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  )
}
