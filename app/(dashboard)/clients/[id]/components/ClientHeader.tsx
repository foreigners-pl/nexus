'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { findConflictingClients } from '@/app/actions/clients'
import { MergeClientsModal } from './MergeClientsModal'
import { AlertTriangle, ChevronLeft } from 'lucide-react'
import { usePaneBack } from '@/lib/panes'
import type { Client, ContactNumber } from '@/types/database'

interface ConflictingClient {
  client: Client & { contact_numbers?: ContactNumber[] }
  phoneNumbers: ContactNumber[]
  conflictReasons: string[]
}

interface ClientHeaderProps {
  client: Client
  phoneNumbers: ContactNumber[]
  onMergeComplete: () => void
}

export function ClientHeader({ client, phoneNumbers, onMergeComplete }: ClientHeaderProps) {
  const paneBack = usePaneBack()
  const [conflicts, setConflicts] = useState<ConflictingClient[]>([])
  const [selectedConflict, setSelectedConflict] = useState<ConflictingClient | null>(null)
  const [showMergeModal, setShowMergeModal] = useState(false)

  useEffect(() => {
    checkForConflicts()
  }, [client.id])

  async function checkForConflicts() {
    const result = await findConflictingClients(client.id)
    if (result.conflicts) {
      setConflicts(result.conflicts)
    }
  }

  const clientName = [client.first_name, client.last_name].filter(Boolean).join(' ') || client.contact_email || 'Unnamed Client'
  const phones = phoneNumbers.map(p => `${p.country_code || ''} ${p.number}`.trim()).filter(Boolean).join(' · ')

  return (
    <>
      <header className="sticky -top-4 md:-top-6 z-40 -mx-4 md:-mx-6 -mt-4 md:-mt-6 mb-6 bg-[hsl(var(--color-surface))]/90 backdrop-blur border-b border-[hsl(var(--color-border))]">
        <div className="px-4 md:px-6 h-14 flex items-center gap-3">
          <Link
            href="/clients"
            onClick={paneBack ? (e) => { e.preventDefault(); paneBack() } : undefined}
            className="w-9 h-9 -ml-1 rounded-full flex items-center justify-center text-[hsl(var(--color-text-secondary))] active:bg-[hsl(var(--color-surface-hover))] shrink-0"
            aria-label="Back to clients"
          >
            <ChevronLeft className="w-6 h-6" />
          </Link>
          <div className="relative shrink-0">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[hsl(var(--color-primary))] to-[hsl(var(--color-primary)/0.7)] flex items-center justify-center shadow-[0_4px_16px_rgb(0_0_0/0.25)]">
              <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
            </div>
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="text-base font-semibold text-[hsl(var(--color-text-primary))] truncate leading-tight">
              {clientName}
            </h1>
            {phones && (
              <p className="text-xs text-[hsl(var(--color-text-secondary))] truncate leading-tight">
                {phones}
              </p>
            )}
          </div>

          {conflicts.length > 0 && (
            <button
              onClick={() => {
                setSelectedConflict(conflicts[0])
                setShowMergeModal(true)
              }}
              className="flex items-center gap-2 px-2.5 py-1.5 text-xs text-amber-400 hover:text-amber-300 bg-amber-500/10 hover:bg-amber-500/20 rounded-xl transition-colors shrink-0"
              title={conflicts.map(c => `${c.client.client_code}: ${c.conflictReasons.join(', ')}`).join('\n')}
            >
              <AlertTriangle className="w-4 h-4" />
              <span className="hidden sm:inline">
                {conflicts.length === 1
                  ? `Duplicate: ${conflicts[0].client.client_code}`
                  : `${conflicts.length} Duplicates Found`
                }
              </span>
            </button>
          )}
        </div>
      </header>

      {showMergeModal && selectedConflict && (
        <MergeClientsModal
          isOpen={showMergeModal}
          onClose={() => {
            setShowMergeModal(false)
            setSelectedConflict(null)
          }}
          clientA={{
            ...client,
            contact_numbers: phoneNumbers
          }}
          clientB={{
            ...selectedConflict.client,
            contact_numbers: selectedConflict.phoneNumbers
          }}
          conflictReasons={selectedConflict.conflictReasons}
          onMergeComplete={() => {
            setShowMergeModal(false)
            setSelectedConflict(null)
            checkForConflicts()
            onMergeComplete()
          }}
        />
      )}
    </>
  )
}
