import Link from 'next/link'
import { Case, Client, Status } from '@/types/database'
import { Card } from '@/components/ui/Card'

interface CaseWithRelations extends Case {
  clients?: Client
  status?: Status
}

interface KanbanCardProps {
  caseItem: CaseWithRelations
}

export function KanbanCard({ caseItem }: KanbanCardProps) {
  const getClientDisplayName = () => {
    if (!caseItem.clients) return 'No Client'
    const { first_name, last_name, contact_email } = caseItem.clients
    if (first_name && last_name) return `${first_name} ${last_name}`
    if (first_name) return first_name
    if (last_name) return last_name
    if (contact_email) return contact_email
    return 'Unnamed Client'
  }

  return (
    <Link href={`/cases/${caseItem.id}`}>
      <Card className="p-3 hover:shadow-lg transition-shadow cursor-pointer border border-[hsl(var(--color-border))]">
        <div className="space-y-2">
          <div className="font-mono text-xs text-[hsl(var(--color-primary))]">
            {caseItem.case_code || 'No Code'}
          </div>
          <div className="font-medium text-xs text-[hsl(var(--color-text-primary))]">
            {getClientDisplayName()}
          </div>
          <div className="text-xs text-[hsl(var(--color-text-secondary))]">
            {new Date(caseItem.created_at).toLocaleDateString()}
          </div>
        </div>
      </Card>
    </Link>
  )
}
