'use client'

import { useState } from 'react'
import { Modal } from '@/components/ui'
import { Button } from '@/components/ui/Button'
import { mergeClients } from '@/app/actions/clients'
import { ArrowRight, Mail, Phone, Calendar } from 'lucide-react'
import type { Client, ContactNumber } from '@/types/database'

interface ClientWithPhones extends Client {
  contact_numbers?: ContactNumber[]
}

interface MergeClientsModalProps {
  isOpen: boolean
  onClose: () => void
  clientA: ClientWithPhones
  clientB: ClientWithPhones
  conflictReasons: string[]
  onMergeComplete: () => void
}

export function MergeClientsModal({
  isOpen,
  onClose,
  clientA,
  clientB,
  conflictReasons,
  onMergeComplete
}: MergeClientsModalProps) {
  const [mainClientId, setMainClientId] = useState<string>(clientA.id)
  const [confirmed, setConfirmed] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const mainClient = mainClientId === clientA.id ? clientA : clientB
  const secondaryClient = mainClientId === clientA.id ? clientB : clientA

  async function handleMerge() {
    if (!confirmed) return
    
    setSubmitting(true)
    setError(null)

    const result = await mergeClients(mainClient.id, secondaryClient.id)

    if (result.error) {
      setError(result.error)
      setSubmitting(false)
      return
    }

    onMergeComplete()
  }

  function getClientName(client: ClientWithPhones) {
    return [client.first_name, client.last_name].filter(Boolean).join(' ') || 'No name'
  }

  function ClientCard({ 
    client, 
    isMain, 
    onSelect 
  }: { 
    client: ClientWithPhones
    isMain: boolean
    onSelect: () => void 
  }) {
    return (
      <div 
        className={`
          flex-1 border rounded-xl p-4 cursor-pointer transition-all min-h-[160px]
          ${isMain 
            ? 'border-blue-500 bg-blue-500/10' 
            : 'border-[hsl(var(--color-border))] hover:border-[hsl(var(--color-border-hover))]'
          }
        `}
        onClick={onSelect}
      >
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs font-mono text-[hsl(var(--color-text-muted))]">
            {client.client_code}
          </span>
          {isMain && (
            <span className="text-xs font-medium text-blue-400 bg-blue-500/20 px-2 py-0.5 rounded">
              Main
            </span>
          )}
        </div>

        <h3 className="font-semibold text-[hsl(var(--color-text-primary))] mb-3">
          {getClientName(client)}
        </h3>

        <div className="space-y-1.5 text-sm">
          {client.contact_email && (
            <div className="flex items-center gap-2 text-[hsl(var(--color-text-secondary))]">
              <Mail className="w-3.5 h-3.5 text-[hsl(var(--color-text-muted))]" />
              <span className="truncate">{client.contact_email}</span>
            </div>
          )}
          {client.contact_numbers && client.contact_numbers.length > 0 && (
            <div className="flex items-center gap-2 text-[hsl(var(--color-text-secondary))]">
              <Phone className="w-3.5 h-3.5 text-[hsl(var(--color-text-muted))]" />
              <span>{client.contact_numbers[0].number}</span>
            </div>
          )}
          <div className="flex items-center gap-2 text-[hsl(var(--color-text-muted))] text-xs pt-1">
            <Calendar className="w-3.5 h-3.5" />
            <span>Created {new Date(client.created_at).toLocaleDateString()}</span>
          </div>
        </div>
      </div>
    )
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Merge Duplicate Clients" maxWidth="lg">
      <div className="space-y-5">
        {/* Conflict reason */}
        <div className="text-sm text-amber-400 bg-amber-500/10 px-3 py-2 rounded-lg">
          <strong>Conflict:</strong> {conflictReasons.join(', ')}
        </div>

        {/* Client comparison */}
        <div>
          <p className="text-sm text-[hsl(var(--color-text-secondary))] mb-3">
            Select which client to keep as the <strong>main</strong> record:
          </p>

          <div className="flex gap-4">
            <ClientCard 
              client={clientA} 
              isMain={mainClientId === clientA.id}
              onSelect={() => setMainClientId(clientA.id)}
            />
            <ClientCard 
              client={clientB} 
              isMain={mainClientId === clientB.id}
              onSelect={() => setMainClientId(clientB.id)}
            />
          </div>
        </div>

        {/* What will happen - compact */}
        <div className="text-sm text-amber-400 bg-amber-500/10 rounded-lg p-3 space-y-1">
          <div className="flex items-center gap-2">
            <ArrowRight className="w-4 h-4 text-amber-500/70" />
            <span>Missing details from <strong>{getClientName(secondaryClient)}</strong> will transfer to <strong>{getClientName(mainClient)}</strong></span>
          </div>
          <div className="flex items-center gap-2">
            <ArrowRight className="w-4 h-4 text-amber-500/70" />
            <span>All cases, notes, and documents will move to the main client</span>
          </div>
          <div className="flex items-center gap-2">
            <ArrowRight className="w-4 h-4 text-amber-500/70" />
            <span><strong>{secondaryClient.client_code}</strong> will be deleted</span>
          </div>
        </div>

        {/* Confirmation */}
        <label className="flex items-center gap-3 cursor-pointer select-none">
          <div 
            className={`
              w-5 h-5 rounded border-2 flex items-center justify-center transition-colors flex-shrink-0
              ${confirmed 
                ? 'bg-blue-500 border-blue-500' 
                : 'border-[hsl(var(--color-border))] hover:border-[hsl(var(--color-border-hover))]'
              }
            `}
            onClick={(e) => {
              e.preventDefault()
              setConfirmed(!confirmed)
            }}
          >
            {confirmed && (
              <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
              </svg>
            )}
          </div>
          <span className="text-sm text-[hsl(var(--color-text-secondary))]">
            I understand this will permanently delete <strong>{secondaryClient.client_code}</strong>
          </span>
        </label>

        {error && (
          <div className="text-sm text-red-400 bg-red-500/10 px-3 py-2 rounded-lg">
            {error}
          </div>
        )}

        {/* Actions */}
        <div className="flex justify-end gap-3 pt-2">
          <Button variant="ghost" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button 
            onClick={handleMerge} 
            disabled={!confirmed || submitting}
          >
            {submitting ? 'Merging...' : 'Merge Clients'}
          </Button>
        </div>
      </div>
    </Modal>
  )
}
