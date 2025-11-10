import { Status, Case, Client } from '@/types/database'
import { KanbanColumn } from './KanbanColumn'

interface CaseWithRelations extends Case {
  clients?: Client
  status?: Status
}

interface KanbanBoardProps {
  statuses: Status[]
  cases: CaseWithRelations[]
  onUpdate: () => void
}

export function KanbanBoard({ statuses, cases, onUpdate }: KanbanBoardProps) {
  const getCasesForStatus = (statusId: string) => {
    return cases.filter(c => c.status?.id === statusId)
  }

  return (
    <div className="flex gap-4 h-full">
      {statuses.map(status => (
        <KanbanColumn
          key={status.id}
          status={status}
          cases={getCasesForStatus(status.id)}
          onUpdate={onUpdate}
        />
      ))}
    </div>
  )
}
