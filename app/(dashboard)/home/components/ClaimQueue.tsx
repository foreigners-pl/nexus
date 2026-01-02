'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { claimCase } from '@/app/actions/dashboard'
import { cn } from '@/lib/utils'
import type { Case } from '@/types/database'

interface UnassignedCase extends Case {
  clients?: { first_name?: string; last_name?: string; contact_email?: string }
}

interface ClaimQueueProps {
  cases: UnassignedCase[]
  onRefresh: () => void
}

function formatTimeAgo(dateString: string): string {
  const date = new Date(dateString)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)
  const diffDays = Math.floor(diffMs / 86400000)

  if (diffMins < 1) return 'Just now'
  if (diffMins < 60) return `${diffMins}m ago`
  if (diffHours < 24) return `${diffHours}h ago`
  if (diffDays < 7) return `${diffDays}d ago`
  return date.toLocaleDateString()
}

export function ClaimQueue({ cases, onRefresh }: ClaimQueueProps) {
  const router = useRouter()
  const [claimingId, setClaimingId] = useState<string | null>(null)

  const handleClaim = async (caseId: string) => {
    setClaimingId(caseId)
    const result = await claimCase(caseId)
    if (result.error) {
      alert(result.error)
    } else {
      onRefresh()
    }
    setClaimingId(null)
  }

  const handleViewCase = (caseId: string) => {
    router.push(`/cases/${caseId}`)
  }

  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="flex-shrink-0 pb-3">
        <CardTitle className="text-lg flex items-center gap-2">
          <svg className="w-5 h-5 text-[hsl(var(--color-primary))]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
          </svg>
          Claim Queue
          {cases.length > 0 && (
            <span className="px-2 py-0.5 text-xs font-medium bg-[hsl(var(--color-primary))] text-white rounded-full">
              {cases.length}
            </span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="flex-1 min-h-0 overflow-y-auto scrollbar-thin space-y-3 pt-0">
        {cases.length === 0 ? (
          <div className="text-center py-8">
            <svg className="w-12 h-12 mx-auto text-[hsl(var(--color-text-secondary))] opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="text-sm text-[hsl(var(--color-text-secondary))] mt-2">
              No unassigned cases
            </p>
            <p className="text-xs text-[hsl(var(--color-text-secondary))]">
              All cases have been claimed
            </p>
          </div>
        ) : (
          cases.map((caseItem) => {
            const clientName = caseItem.clients 
              ? [caseItem.clients.first_name, caseItem.clients.last_name].filter(Boolean).join(' ')
              : null
            
            return (
              <div
                key={caseItem.id}
                className="p-3 rounded-lg border border-[hsl(var(--color-border))] bg-[hsl(var(--color-surface))] hover:bg-[hsl(var(--color-surface-hover))] transition-colors"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div 
                      className="font-medium text-[hsl(var(--color-text-primary))] cursor-pointer hover:text-[hsl(var(--color-primary))]"
                      onClick={() => handleViewCase(caseItem.id)}
                    >
                      {caseItem.case_code || 'New Case'}
                    </div>
                    {clientName && (
                      <div className="text-sm text-[hsl(var(--color-text-secondary))] truncate">
                        {clientName}
                      </div>
                    )}
                    {caseItem.clients?.contact_email && (
                      <div className="text-xs text-[hsl(var(--color-text-secondary))] truncate">
                        {caseItem.clients.contact_email}
                      </div>
                    )}
                    <div className="text-xs text-[hsl(var(--color-text-secondary))] mt-1">
                      Created {formatTimeAgo(caseItem.created_at)}
                    </div>
                  </div>
                  <Button
                    size="sm"
                    onClick={() => handleClaim(caseItem.id)}
                    disabled={claimingId === caseItem.id}
                    className="flex-shrink-0"
                  >
                    {claimingId === caseItem.id ? (
                      <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                    ) : (
                      'Claim'
                    )}
                  </Button>
                </div>
              </div>
            )
          })
        )}
      </CardContent>
    </Card>
  )
}