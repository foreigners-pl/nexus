'use client'

import { useState, useEffect } from 'react'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Select } from '@/components/ui/Select'
import { getWikiDocumentAccessList, removeWikiDocumentAccess, shareWikiDocumentWithUser, updateWikiDocumentAccessLevel } from '@/app/actions/wiki-document-sharing'
import { getAllUsers } from '@/app/actions/card/assignees'
import type { User } from '@/types/database'

interface ShareDocumentModalProps {
  isOpen: boolean
  onClose: () => void
  documentId: string
  documentTitle: string
  documentOwnerId: string
  onUpdate: () => void
}

export function ShareDocumentModal({ 
  isOpen, 
  onClose, 
  documentId, 
  documentTitle, 
  documentOwnerId, 
  onUpdate 
}: ShareDocumentModalProps) {
  const [accessList, setAccessList] = useState<any[]>([])
  const [availableUsers, setAvailableUsers] = useState<User[]>([])
  const [selectedUser, setSelectedUser] = useState('')
  const [accessLevel, setAccessLevel] = useState<'editor' | 'viewer'>('viewer')
  const [showAddUser, setShowAddUser] = useState(false)
  const [loading, setLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)

  useEffect(() => {
    async function getCurrentUser() {
      const { createClient } = await import('@/lib/supabase/client')
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (user) setCurrentUserId(user.id)
    }
    getCurrentUser()
  }, [])

  useEffect(() => {
    if (isOpen) {
      loadAccessList()
      loadUsers()
    }
  }, [isOpen, documentId])

  async function loadAccessList() {
    setLoading(true)
    setError(null)
    const result = await getWikiDocumentAccessList(documentId)
    
    if (result?.error) {
      setError(result.error)
    } else if (result?.data) {
      setAccessList(result.data)
    }
    setLoading(false)
  }

  async function loadUsers() {
    const result = await getAllUsers()
    if (result?.data) {
      setAvailableUsers(result.data as User[])
    }
  }

  const handleAddUser = async () => {
    if (!selectedUser) return

    setSubmitting(true)
    setError(null)
    const result = await shareWikiDocumentWithUser(documentId, selectedUser, accessLevel)

    if (result?.error) {
      setError(result.error)
    } else {
      setSelectedUser('')
      setAccessLevel('viewer')
      setShowAddUser(false)
      loadAccessList()
      onUpdate()
    }
    setSubmitting(false)
  }

  const handleRemoveAccess = async (userId: string) => {
    setSubmitting(true)
    setError(null)
    const result = await removeWikiDocumentAccess(documentId, userId)

    if (result?.error) {
      setError(result.error)
    } else {
      loadAccessList()
      onUpdate()
    }
    setSubmitting(false)
  }

  const handleToggleAccessLevel = async (userId: string, currentLevel: string) => {
    const newLevel = currentLevel === 'editor' ? 'viewer' : 'editor'
    setSubmitting(true)
    setError(null)
    const result = await updateWikiDocumentAccessLevel(documentId, userId, newLevel as 'editor' | 'viewer')

    if (result?.error) {
      setError(result.error)
    } else {
      loadAccessList()
      onUpdate()
    }
    setSubmitting(false)
  }

  const getUnsharedUsers = () => {
    return availableUsers.filter(
      user => !accessList.some(access => access.user_id === user.id)
    )
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`Share "${documentTitle}"`} maxWidth="lg">
      <div className="space-y-4">
        {error && (
          <div className="p-3 bg-red-500/10 border border-red-500 rounded text-red-500 text-sm">
            {error}
          </div>
        )}

        {/* Access List */}
        <div className="space-y-2">
          <h3 className="font-medium text-white">Users with Access</h3>
          {loading ? (
            <p className="text-sm text-neutral-400 text-center py-8">
              Loading...
            </p>
          ) : accessList.length === 0 ? (
            <p className="text-sm text-neutral-400 text-center py-8">
              Only you have access to this document.
            </p>
          ) : (
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {accessList.map((access) => {
                const user = availableUsers.find(u => u.id === access.user_id)
                const isOwner = access.access_level === 'owner'
                const canRemove = currentUserId === documentOwnerId && !isOwner
                
                return (
                  <div
                    key={access.id}
                    className="flex items-center justify-between p-3 bg-neutral-800 rounded-lg border border-neutral-700"
                  >
                    <div className="flex-1">
                      <p className="text-sm font-medium text-white">
                        {user?.display_name || user?.email || `User ID: ${access.user_id}`}
                      </p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className={`text-xs px-2 py-0.5 rounded ${
                          isOwner 
                            ? 'bg-yellow-500/10 text-yellow-400'
                            : 'bg-red-700/20 text-red-400'
                        }`}>
                          {access.access_level}
                        </span>
                        <span className="text-xs text-neutral-400">
                          {isOwner ? 'Document creator' : `Granted ${new Date(access.granted_at).toLocaleDateString()}`}
                        </span>
                      </div>
                    </div>
                    {canRemove ? (
                      <Button
                        onClick={() => handleRemoveAccess(access.user_id)}
                        variant="ghost"
                        size="sm"
                        className="text-red-500 hover:text-red-400"
                        disabled={submitting}
                      >
                        Remove
                      </Button>
                    ) : !isOwner && currentUserId === documentOwnerId ? (
                      <button
                        onClick={() => handleToggleAccessLevel(access.user_id, access.access_level)}
                        className="px-3 py-1 text-xs rounded bg-neutral-700 hover:bg-neutral-600 transition-colors"
                        disabled={submitting}
                      >
                        Toggle to {access.access_level === 'editor' ? 'viewer' : 'editor'}
                      </button>
                    ) : null}
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Add User Section */}
        {currentUserId && (
          <div className="pt-4 border-t border-neutral-700">
            <h3 className="font-medium text-white mb-2">Add User</h3>
          
          {!showAddUser ? (
            <Button 
              onClick={() => setShowAddUser(true)} 
              variant="outline" 
              className="w-full"
              disabled={getUnsharedUsers().length === 0}
            >
              {getUnsharedUsers().length === 0 ? 'All users have access' : '+ Add User'}
            </Button>
          ) : (
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-neutral-400 mb-2">
                  Select User
                </label>
                <Select
                  options={getUnsharedUsers().map(u => ({ 
                    id: u.id, 
                    label: u.display_name || u.email 
                  }))}
                  value={selectedUser}
                  onChange={setSelectedUser}
                  placeholder="Select user..."
                  searchPlaceholder="Search users..."
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-neutral-400 mb-2">
                  Access Level
                </label>
                <div className="flex gap-2">
                  <button
                    onClick={() => setAccessLevel('editor')}
                    className={`flex-1 px-3 py-2 rounded-lg border transition-colors ${
                      accessLevel === 'editor'
                        ? 'bg-red-700 text-white border-red-700'
                        : 'bg-neutral-800 border-neutral-700 text-white hover:border-red-700'
                    }`}
                  >
                    <div className="text-sm font-medium">Editor</div>
                    <div className="text-xs opacity-80">Can edit documents</div>
                  </button>
                  <button
                    onClick={() => setAccessLevel('viewer')}
                    className={`flex-1 px-3 py-2 rounded-lg border transition-colors ${
                      accessLevel === 'viewer'
                        ? 'bg-red-700 text-white border-red-700'
                        : 'bg-neutral-800 border-neutral-700 text-white hover:border-red-700'
                    }`}
                  >
                    <div className="text-sm font-medium">Viewer</div>
                    <div className="text-xs opacity-80">Can only view</div>
                  </button>
                </div>
              </div>

              <div className="flex gap-2">
                <Button
                  onClick={handleAddUser}
                  disabled={!selectedUser || submitting}
                  className="flex-1"
                >
                  {submitting ? 'Adding...' : 'Add User'}
                </Button>
                <Button
                  onClick={() => {
                    setShowAddUser(false)
                    setSelectedUser('')
                    setAccessLevel('viewer')
                  }}
                  variant="ghost"
                  disabled={submitting}
                >
                  Cancel
                </Button>
              </div>
            </div>
          )}
          </div>
        )}

        <div className="flex justify-end pt-4 border-t border-neutral-700">
          <Button onClick={onClose} variant="ghost">
            Close
          </Button>
        </div>
      </div>
    </Modal>
  )
}
