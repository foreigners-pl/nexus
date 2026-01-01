import { Status, Case, Client } from '@/types/database'
import { KanbanCard } from './KanbanCard'
import { useDroppable } from '@dnd-kit/core'

interface CaseWithRelations extends Case {
  clients?: Client
  status?: Status
}

interface KanbanColumnProps {
  status: Status
  cases: CaseWithRelations[]
  onUpdate: () => void
}

export function KanbanColumn({ status, cases, onUpdate }: KanbanColumnProps) {
  const { setNodeRef, isOver } = useDroppable({
    id: status.id,
  })

  // Sort cases by position
  const sortedCases = [...cases].sort((a, b) => (a.position || 0) - (b.position || 0))

  // Default colors for status based on common status types
  const getStatusColor = () => {
    const name = status.name.toLowerCase()
    if (name.includes('todo') || name.includes('to do') || name.includes('backlog')) return '#94a3b8' // slate
    if (name.includes('progress') || name.includes('active') || name.includes('working')) return '#3b82f6' // blue
    if (name.includes('done') || name.includes('complete') || name.includes('finished')) return '#22c55e' // green
    if (name.includes('review') || name.includes('testing')) return '#f59e0b' // amber
    if (name.includes('blocked') || name.includes('hold')) return '#ef4444' // red
    return '#6366f1' // indigo default
  }

  // Convert hex color to rgba with transparency
  const hexToRgba = (hex: string, alpha: number) => {
    const r = parseInt(hex.slice(1, 3), 16)
    const g = parseInt(hex.slice(3, 5), 16)
    const b = parseInt(hex.slice(5, 7), 16)
    return `rgba(${r}, ${g}, ${b}, ${alpha})`
  }

  const statusColor = getStatusColor()
  const glassyBackground = hexToRgba(statusColor, 0.08)

  return (
    <div className="flex-shrink-0 w-56 h-full">
      <div 
        ref={setNodeRef}
        className={`rounded-lg p-3 border h-full flex flex-col backdrop-blur-sm transition-colors ${
          isOver 
            ? 'border-[hsl(var(--color-primary))] border-2 bg-[hsl(var(--color-primary))]/5' 
            : 'border-[hsl(var(--color-border))]'
        }`}
        style={{ backgroundColor: isOver ? undefined : glassyBackground }}
      >
        {/* Column Header */}
        <div className="flex items-center justify-between mb-3 flex-shrink-0">
          <div className="flex items-center gap-2 flex-1">
            {/* Color indicator for status */}
            <div 
              className="w-4 h-4 rounded-full border-2 border-white shadow-sm"
              style={{ backgroundColor: getStatusColor() }}
            />
            
            <h3 className="font-semibold !text-[14px] text-[hsl(var(--color-text-primary))]">
              {status.name}
            </h3>

            <span className="text-xs text-[hsl(var(--color-text-secondary))]">
              ({sortedCases.length})
            </span>
          </div>
        </div>

        {/* Cards Container - Matching CustomKanbanColumn styling */}
        <div className="space-y-3 flex-1 overflow-y-auto pr-1 scrollbar-thin">
          {sortedCases.map(caseItem => (
            <KanbanCard key={caseItem.id} caseItem={caseItem} />
          ))}
        </div>
      </div>
    </div>
  )
}
