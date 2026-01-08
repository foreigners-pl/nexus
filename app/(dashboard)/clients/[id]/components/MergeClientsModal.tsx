'use client'

import { useState } from 'react'
import { Modal } from '@/components/ui'
import { Button } from '@/components/ui/Button'
import { mergeClients } from '@/app/actions/clients'
import { AlertTriangle, Check, ArrowRight, User, Mail, Phone } from 'lucide-react'
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
          border-2 rounded-lg p-4 cursor-pointer transition-all
          ${isMain 
            ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20' 
            : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
          }
        `}
        onClick={onSelect}
      >
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
            {client.client_code}
          </span>
          {isMain && (
            <span className="text-xs font-medium text-blue-600 dark:text-blue-400 bg-blue-100 dark:bg-blue-900/50 px-2 py-1 rounded">
              Main Client
            </span>
          )}
        </div>

        <div className="space-y-2">
          <div className="flex items-center gap-2 text-gray-900 dark:text-white">
            <User className="w-4 h-4 text-gray-400" />
            <span className="font-medium">{getClientName(client)}</span>
          </div>

          {client.contact_email && (
            <div className="flex items-center gap-2 text-gray-600 dark:text-gray-300">
              <Mail className="w-4 h-4 text-gray-400" />
              <span className="text-sm">{client.contact_email}</span>
            </div>
          )}

          {client.contact_numbers && client.contact_numbers.length > 0 && (
            <div className="flex items-start gap-2 text-gray-600 dark:text-gray-300">
              <Phone className="w-4 h-4 text-gray-400 mt-0.5" />
              <div className="text-sm">
                {client.contact_numbers.map(p => (
                  <div key={p.id}>{p.number}</div>
                ))}
              </div>
            </div>
          )}

          <div className="text-xs text-gray-500 dark:text-gray-400 pt-2 border-t border-gray-200 dark:border-gray-700">
            Created: {new Date(client.created_at).toLocaleDateString()}
          </div>
        </div>
      </div>
    )
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Merge Duplicate Clients">
      <div className="space-y-6">
        {/* Conflict reasons */}
        <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-3">
          <p className="text-sm text-amber-800 dark:text-amber-200">
            <strong>Conflict detected:</strong> {conflictReasons.join(' • ')}
          </p>
        </div>

        {/* Client comparison */}
        <div>
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
            Select which client should be the <strong>main</strong> record. Data from the other client will be merged in.
          </p>

          <div className="grid grid-cols-2 gap-4">
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

        {/* What will happen */}
        <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
          <h4 className="font-medium text-gray-900 dark:text-white mb-2 flex items-center gap-2">
            <ArrowRight className="w-4 h-4" />
            What will happen:
          </h4>
          <ul className="text-sm text-gray-600 dark:text-gray-300 space-y-1 ml-6 list-disc">
            <li>Missing details will transfer from <strong>{getClientName(secondaryClient)}</strong> to <strong>{getClientName(mainClient)}</strong></li>
            <li>All cases, notes, and documents will be moved to the main client</li>
            <li>A note will be added with the merged client's original details</li>
            <li><strong>{getClientName(secondaryClient)}</strong> ({secondaryClient.client_code}) will be deleted</li>
          </ul>
        </div>

        {/* Confirmation checkbox */}
        <label className="flex items-start gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={confirmed}
            onChange={(e) => setConfirmed(e.target.checked)}
            className="mt-1 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
          />
          <span className="text-sm text-gray-700 dark:text-gray-300">
            I understand that merging will <strong>permanently delete</strong> the secondary client record 
            ({secondaryClient.client_code}) and transfer all its data to the main client.
          </span>
        </label>

        {error && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3">
            <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
          </div>
        )}

        {/* Actions */}
        <div className="flex justify-end gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
          <Button variant="ghost" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button 
            onClick={handleMerge} 
            disabled={!confirmed || submitting}
            className="bg-amber-600 hover:bg-amber-700"
          >
            {submitting ? 'Merging...' : 'Merge Clients'}
          </Button>
        </div>
      </div>
    </Modal>
  )
}
