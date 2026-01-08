'use client'

import { useState, useEffect } from 'react'
import { AlertTriangle } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { findConflictingClients } from '@/app/actions/clients'
import { MergeClientsModal } from './MergeClientsModal'
import type { Client, ContactNumber } from '@/types/database'

interface ConflictingClient {
  client: Client & { contact_numbers?: ContactNumber[] }
  phoneNumbers: ContactNumber[]
  conflictReasons: string[]
}

interface ConflictAlertProps {
  clientId: string
  currentClient: Client
  currentPhoneNumbers: ContactNumber[]
  onMergeComplete: () => void
}

export function ConflictAlert({ 
  clientId, 
  currentClient, 
  currentPhoneNumbers,
  onMergeComplete 
}: ConflictAlertProps) {
  const [conflicts, setConflicts] = useState<ConflictingClient[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedConflict, setSelectedConflict] = useState<ConflictingClient | null>(null)
  const [showMergeModal, setShowMergeModal] = useState(false)

  useEffect(() => {
    checkForConflicts()
  }, [clientId])

  async function checkForConflicts() {
    console.log('[ConflictAlert] Checking conflicts for clientId:', clientId)
    setLoading(true)
    const result = await findConflictingClients(clientId)
    console.log('[ConflictAlert] Result:', result)
    if (result.conflicts) {
      console.log('[ConflictAlert] Found conflicts:', result.conflicts.length)
      setConflicts(result.conflicts)
    }
    setLoading(false)
  }

  if (loading || conflicts.length === 0) {
    console.log('[ConflictAlert] Not showing - loading:', loading, 'conflicts:', conflicts.length)
    return null
  }

  return (
    <>
      <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-4 mb-6">
        <div className="flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-500 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <h3 className="font-medium text-amber-800 dark:text-amber-200">
              Potential Duplicate Client{conflicts.length > 1 ? 's' : ''} Found
            </h3>
            <p className="text-sm text-amber-700 dark:text-amber-300 mt-1">
              This client has conflicting details with {conflicts.length} other client record{conflicts.length > 1 ? 's' : ''}.
            </p>
            
            <div className="mt-3 space-y-2">
              {conflicts.map((conflict) => (
                <div 
                  key={conflict.client.id}
                  className="flex items-center justify-between bg-white dark:bg-gray-800 rounded-md p-3 border border-amber-200 dark:border-amber-800"
                >
                  <div>
                    <p className="font-medium text-gray-900 dark:text-white">
                      {[conflict.client.first_name, conflict.client.last_name].filter(Boolean).join(' ') || 'No name'}
                      <span className="text-gray-500 dark:text-gray-400 text-sm ml-2">
                        ({conflict.client.client_code})
                      </span>
                    </p>
                    <p className="text-sm text-amber-600 dark:text-amber-400">
                      {conflict.conflictReasons.join(' • ')}
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setSelectedConflict(conflict)
                      setShowMergeModal(true)
                    }}
                  >
                    View & Merge
                  </Button>
                </div>
              ))}
            </div>
          </div>
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
            ...currentClient,
            contact_numbers: currentPhoneNumbers
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
