'use client'

import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/Button'
import { Phone } from 'lucide-react'
import type { Case, Client, ContactNumber } from '@/types/database'

interface CaseHeaderProps {
  caseData: Case
  client: Client | null
  clientPhoneNumbers: ContactNumber[]
  onDelete: () => void
}

export function CaseHeader({ caseData, client, clientPhoneNumbers, onDelete }: CaseHeaderProps) {
  const router = useRouter()

  const getClientDisplayName = () => {
    if (!client) return 'Unknown Client'
    if (client.first_name && client.last_name) return `${client.first_name} ${client.last_name}`
    if (client.first_name) return client.first_name
    if (client.last_name) return client.last_name
    if (client.contact_email) return client.contact_email
    return 'Unnamed Client'
  }

  const formatPhoneNumber = (phone: ContactNumber) => {
    const countryCode = phone.country_code || ''
    return `${countryCode}${countryCode ? ' ' : ''}${phone.number}`
  }

  return (
    <>
      {/* Breadcrumb Navigation - above the header */}
      <div className="flex items-center gap-1 sm:gap-2 mb-3 sm:mb-4 flex-wrap">
        <Button 
          variant="ghost" 
          size="sm"
          onClick={() => router.push('/clients')}
          className="text-[hsl(var(--color-text-secondary))] hover:text-[hsl(var(--color-text-primary))] -ml-2 text-xs sm:text-sm"
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
              className="text-[hsl(var(--color-text-secondary))] hover:text-[hsl(var(--color-text-primary))] text-xs sm:text-sm truncate max-w-[150px] sm:max-w-none"
            >
              {getClientDisplayName()}
            </Button>
          </>
        )}
      </div>
      
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-4">
        <div className="flex items-center gap-3 sm:gap-4">
          {/* Glass Icon */}
          <div className="relative flex-shrink-0">
            <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-xl sm:rounded-2xl bg-gradient-to-br from-[hsl(var(--color-primary))] to-[hsl(var(--color-primary)/0.7)] flex items-center justify-center shadow-[0_8px_32px_rgb(0_0_0/0.3)]">
              <svg className="w-6 h-6 sm:w-7 sm:h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            {/* Glow effect */}
            <div className="absolute inset-0 rounded-xl sm:rounded-2xl bg-[hsl(var(--color-primary))] blur-xl opacity-30 -z-10"></div>
          </div>
          
          <div className="min-w-0">
            <h1 className="text-lg sm:text-2xl font-semibold text-[hsl(var(--color-text-primary))]">
              {caseData.case_code || 'Case Details'}
            </h1>
            <div className="flex flex-wrap items-center gap-2 sm:gap-3 mt-1">
              {client?.client_code && (
                <span className="text-xs sm:text-sm text-[hsl(var(--color-text-secondary))] font-mono bg-[hsl(var(--color-surface-hover))] px-2 py-0.5 rounded">
                  {client.client_code}
                </span>
              )}
              <span className="text-xs sm:text-sm text-[hsl(var(--color-text-muted))]">
                Created {new Date(caseData.created_at).toLocaleDateString()}
              </span>
            </div>
            {/* Client Phone Numbers */}
            {clientPhoneNumbers.length > 0 && (
              <div className="flex items-center gap-2 mt-2">
                <Phone className="w-3.5 h-3.5 text-[hsl(var(--color-text-muted))] flex-shrink-0" />
                <div className="flex flex-wrap gap-2">
                  {clientPhoneNumbers.map((phone) => (
                    <a
                      key={phone.id}
                      href={`https://wa.me/${formatPhoneNumber(phone).replace(/[\s\-\(\)]/g, '')}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs sm:text-sm text-[hsl(var(--color-primary))] hover:underline"
                      title="Open in WhatsApp"
                    >
                      {formatPhoneNumber(phone)}
                    </a>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
        
        <Button 
          variant="ghost" 
          size="sm"
          onClick={onDelete}
          className="text-red-400 hover:text-red-300 hover:bg-red-500/10"
        >
          <span className="hidden sm:inline">Delete Case</span>
          <span className="sm:hidden">Delete</span>
        </Button>
      </div>
    </>
  )
}