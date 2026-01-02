'use client'

import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/Button'
import type { Case, Client } from '@/types/database'

interface CaseHeaderProps {
  caseData: Case
  client: Client | null
  onDelete: () => void
}

export function CaseHeader({ caseData, client, onDelete }: CaseHeaderProps) {
  const router = useRouter()

  const getClientDisplayName = () => {
    if (!client) return 'Unknown Client'
    if (client.first_name && client.last_name) return `${client.first_name} ${client.last_name}`
    if (client.first_name) return client.first_name
    if (client.last_name) return client.last_name
    if (client.contact_email) return client.contact_email
    return 'Unnamed Client'
  }

  return (
    <div className="flex justify-between items-center">
      <div className="flex items-center gap-4">
        {/* Glass Icon */}
        <div className="relative">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[hsl(var(--color-primary))] to-[hsl(var(--color-primary)/0.7)] flex items-center justify-center shadow-[0_8px_32px_rgb(0_0_0/0.3)]">
            <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          {/* Glow effect */}
          <div className="absolute inset-0 rounded-2xl bg-[hsl(var(--color-primary))] blur-xl opacity-30 -z-10"></div>
        </div>
        
        <div>
          {/* Breadcrumb Navigation */}
          <div className="flex items-center gap-2 mb-1">
            <Button 
              variant="ghost" 
              size="sm"
              onClick={() => router.push('/clients')}
              className="text-[hsl(var(--color-text-secondary))] hover:text-[hsl(var(--color-text-primary))] text-xs h-6 px-2"
            >
              ← Clients
            </Button>
            {client && (
              <>
                <span className="text-[hsl(var(--color-text-muted))]">/</span>
                <Button 
                  variant="ghost" 
                  size="sm"
                  onClick={() => router.push(`/clients/${client.client_code || client.id}`)}
                  className="text-[hsl(var(--color-text-secondary))] hover:text-[hsl(var(--color-text-primary))] text-xs h-6 px-2"
                >
                  {getClientDisplayName()}
                </Button>
              </>
            )}
          </div>
          
          <h1 className="text-2xl font-semibold text-[hsl(var(--color-text-primary))]">
            {caseData.case_code || 'Case Details'}
          </h1>
          <div className="flex items-center gap-3 mt-1">
            {client?.client_code && (
              <span className="text-sm text-[hsl(var(--color-text-secondary))] font-mono bg-[hsl(var(--color-surface-hover))] px-2 py-0.5 rounded">
                {client.client_code}
              </span>
            )}
            <span className="text-sm text-[hsl(var(--color-text-muted))]">
              Created {new Date(caseData.created_at).toLocaleDateString()}
            </span>
          </div>
        </div>
      </div>
      
      <Button 
        variant="ghost" 
        onClick={onDelete}
        className="text-red-400 hover:text-red-300 hover:bg-red-500/10"
      >
        Delete Case
      </Button>
    </div>
  )
}