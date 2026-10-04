'use client'

import Link from 'next/link'
import { Button } from '@/components/ui/Button'
import { ChevronLeft } from 'lucide-react'
import { usePaneBack } from '@/lib/panes'
import type { Case, Client, ContactNumber } from '@/types/database'

interface CaseHeaderProps {
  caseData: Case
  client: Client | null
  clientPhoneNumbers: ContactNumber[]
  serviceName?: string
  onDelete: () => void
}

export function CaseHeader({ caseData, client, clientPhoneNumbers, serviceName, onDelete }: CaseHeaderProps) {
  const clientName = !client
    ? 'Unknown Client'
    : [client.first_name, client.last_name].filter(Boolean).join(' ') || client.contact_email || 'Unnamed Client'

  const backHref = client ? `/clients/${client.client_code || client.id}` : '/clients'
  const paneBack = usePaneBack()

  const phones = clientPhoneNumbers.map(p => `${p.country_code || ''} ${p.number}`.trim()).filter(Boolean).join(' · ')
  const subtitle = [serviceName, phones].filter(Boolean).join(' · ')

  return (
    <header className="sticky -top-4 md:-top-6 z-40 -mx-4 md:-mx-6 -mt-4 md:-mt-6 mb-6 bg-[hsl(var(--color-surface))]/90 backdrop-blur border-b border-[hsl(var(--color-border))]">
      <div className="px-4 md:px-6 h-14 flex items-center gap-3">
        <Link
          href={backHref}
          onClick={paneBack ? (e) => { e.preventDefault(); paneBack() } : undefined}
          className="w-9 h-9 -ml-1 rounded-full flex items-center justify-center text-[hsl(var(--color-text-secondary))] active:bg-[hsl(var(--color-surface-hover))] shrink-0"
          aria-label="Back to client"
        >
          <ChevronLeft className="w-6 h-6" />
        </Link>
        <div className="relative shrink-0">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[hsl(var(--color-primary))] to-[hsl(var(--color-primary)/0.7)] flex items-center justify-center shadow-[0_4px_16px_rgb(0_0_0/0.25)]">
            <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
        </div>
        {client ? (
          <Link
            href={backHref}
            className="min-w-0 flex-1 rounded-lg -mx-1 px-1 hover:bg-[hsl(var(--color-surface-hover))] active:bg-[hsl(var(--color-surface-hover))] transition-colors"
          >
            <h1 className="text-base font-semibold text-[hsl(var(--color-text-primary))] truncate leading-tight">
              {clientName}
            </h1>
            <p className="text-xs text-[hsl(var(--color-text-secondary))] truncate leading-tight">
              {subtitle}
            </p>
          </Link>
        ) : (
          <div className="min-w-0 flex-1">
            <h1 className="text-base font-semibold text-[hsl(var(--color-text-primary))] truncate leading-tight">
              {caseData.case_code || 'Case'}
            </h1>
            <p className="text-xs text-[hsl(var(--color-text-secondary))] truncate leading-tight">
              {subtitle}
            </p>
          </div>
        )}
        <Button
          variant="ghost"
          size="sm"
          onClick={onDelete}
          className="hidden sm:flex text-red-400 hover:text-red-300 hover:bg-red-500/10 shrink-0"
        >
          Delete Case
        </Button>
      </div>
    </header>
  )
}
