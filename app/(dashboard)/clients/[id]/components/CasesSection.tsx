'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui'
import { Button } from '@/components/ui/Button'
import { addCase } from '@/app/actions/cases'
import type { Case, Status } from '@/types/database'

interface CaseWithStatus extends Case {
  status?: Status
  case_services?: Array<{
    services?: {
      name: string
    }
  }>
}

interface CasesSectionProps {
  clientId: string
  cases: CaseWithStatus[]
  onCaseAdded: (newCase: CaseWithStatus) => void
}

export function CasesSection({ clientId, cases, onCaseAdded }: CasesSectionProps) {
  const [submitting, setSubmitting] = useState(false)
  const router = useRouter()

  const handleAddCase = async () => {
    setSubmitting(true)
    const formData = new FormData()
    formData.set('clientId', clientId)
    
    const result = await addCase(formData)
    
    if (!result?.error && result?.caseData) {
      // Optimistically add the case to the local state
      const newCase: CaseWithStatus = {
        ...result.caseData,
        status: { name: 'New' } as Status,
        case_services: []
      }
      onCaseAdded(newCase)
    } else {
      console.error('Error creating case:', result?.error)
    }
    setSubmitting(false)
  }

  return (
    <Card className="backdrop-blur-xl bg-[hsl(var(--color-surface))]/80 border-[hsl(var(--color-border))] shadow-[0_8px_32px_rgb(0_0_0/0.25)]">
      <CardHeader>
        <div className="flex justify-between items-center">
          <CardTitle>Cases</CardTitle>
          <Button size="sm" onClick={handleAddCase} disabled={submitting}>
            {submitting ? 'Creating...' : '+ Add Case'}
          </Button>
        </div>
      </CardHeader>
        <CardContent>
          {cases.length === 0 ? (
            <p className="text-[hsl(var(--color-text-secondary))] text-center py-8">No cases yet for this client</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-[hsl(var(--color-border))]">
                    <th className="text-left p-3 text-sm font-medium text-[hsl(var(--color-text-secondary))]">Case Code</th>
                    <th className="text-left p-3 text-sm font-medium text-[hsl(var(--color-text-secondary))]">Status</th>
                    <th className="text-left p-3 text-sm font-medium text-[hsl(var(--color-text-secondary))]">Services</th>
                    <th className="text-left p-3 text-sm font-medium text-[hsl(var(--color-text-secondary))]">Created</th>
                    <th className="text-center p-3 text-sm font-medium text-[hsl(var(--color-text-secondary))]"></th>
                  </tr>
                </thead>
                <tbody>
                  {cases.map((caseItem) => (
                    <tr
                      key={caseItem.id}
                      className="border-b border-[hsl(var(--color-border))] hover:bg-[hsl(var(--color-surface-hover))] transition-colors"
                    >
                      <td className="p-3">
                        <span className="font-mono text-sm text-[hsl(var(--color-text-primary))]">
                          {caseItem.case_code || '-'}
                        </span>
                      </td>
                      <td className="p-3">
                        {caseItem.status ? (
                          <span className="text-xs px-2 py-1 rounded bg-[hsl(var(--color-surface-hover))] text-[hsl(var(--color-text-secondary))] border border-[hsl(var(--color-border))]">
                            {caseItem.status.name}
                          </span>
                        ) : (
                          <span className="text-sm text-[hsl(var(--color-text-secondary))]">-</span>
                        )}
                      </td>
                      <td className="p-3">
                        {caseItem.case_services && caseItem.case_services.length > 0 ? (
                          <div className="text-sm text-[hsl(var(--color-text-primary))]">
                            {caseItem.case_services.map((cs, idx) => cs.services?.name).filter(Boolean).join(', ')}
                          </div>
                        ) : (
                          <span className="text-sm text-[hsl(var(--color-text-secondary))]">No services</span>
                        )}
                      </td>
                      <td className="p-3">
                        <span className="text-sm text-[hsl(var(--color-text-secondary))]">
                          {new Date(caseItem.created_at).toLocaleDateString()}
                        </span>
                      </td>
                      <td className="p-3 text-center">
                        <Button 
                          variant="primary" 
                          size="sm"
                          onClick={() => router.push(`/cases/${caseItem.case_code || caseItem.id}`)}
                        >
                          Open
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
  )
}
