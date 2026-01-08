'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/Button'
import { findConflictingClients } from '@/app/actions/clients'
import { MergeClientsModal } from './MergeClientsModal'
import { AlertTriangle } from 'lucide-react'
import type { Client, ContactNumber } from '@/types/database'

interface ConflictingClient {
  client: Client & { contact_numbers?: ContactNumber[] }
  phoneNumbers: ContactNumber[]
  conflictReasons: string[]
}

interface ClientHeaderProps {
  client: Client
  phoneNumbers: ContactNumber[]
  onDelete: () => void
  onMergeComplete: () => void
}

export function ClientHeader({ client, phoneNumbers, onDelete, onMergeComplete }: ClientHeaderProps) {
  const router = useRouter()
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

  return (
    <>
      <div className="flex justify-between items-start">
        <div className="flex items-center gap-4">
          {/* Glass Icon */}
          <div className="relative">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[hsl(var(--color-primary))] to-[hsl(var(--color-primary)/0.7)] flex items-center justify-center shadow-[0_8px_32px_rgb(0_0_0/0.3)]">
              <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
            </div>
            {/* Glow effect */}
            <div className="absolute inset-0 rounded-2xl bg-[hsl(var(--color-primary))] blur-xl opacity-30 -z-10"></div>
          </div>
          
          <div>
            <div className="flex items-center gap-3 mb-1">
              <Button 
                variant="ghost" 
                size="sm"
                onClick={() => router.push('/clients')}
                className="text-[hsl(var(--color-text-secondary))] hover:text-[hsl(var(--color-text-primary))]"
              >
                ← Back to Clients
              </Button>
            </div>
            <h1 className="text-2xl font-semibold text-[hsl(var(--color-text-primary))]">
              {client.first_name || client.last_name || client.contact_email || 'Unnamed Client'}
              {client.first_name && client.last_name && ` ${client.last_name}`}
            </h1>
            <div className="flex items-center gap-3 mt-1">
              {client.client_code && (
                <span className="text-sm text-[hsl(var(--color-text-secondary))] font-mono bg-[hsl(var(--color-surface-hover))] px-2 py-0.5 rounded">
                  {client.client_code}
                </span>
              )}
              <span className="text-sm text-[hsl(var(--color-text-muted))]">
                Client since {new Date(client.created_at).toLocaleDateString()}
              </span>
            </div>
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          {conflicts.length > 0 && (
            <button
              onClick={() => {
                setSelectedConflict(conflicts[0])
                setShowMergeModal(true)
              }}
              className="flex items-center gap-2 px-3 py-1.5 text-sm text-amber-400 hover:text-amber-300 bg-amber-500/10 hover:bg-amber-500/20 rounded-lg transition-colors"
              title={conflicts.map(c => `${c.client.client_code}: ${c.conflictReasons.join(', ')}`).join('\n')}
            >
              <AlertTriangle className="w-4 h-4" />
              <span>
                {conflicts.length === 1 
                  ? `Duplicate: ${conflicts[0].client.client_code}` 
                  : `${conflicts.length} Duplicates Found`
                }
              </span>
            </button>
          )}
          
          <Button 
            variant="ghost" 
            onClick={onDelete}
            className="text-red-400 hover:text-red-300 hover:bg-red-500/10"
          >
            Delete Client
          </Button>
        </div>
      </div>

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
