'use client'

import { useState, useEffect } from 'react'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { getBoardAccessList, removeBoardAccess, shareBoardWithUser } from '@/app/actions/board/sharing'
import { getAllUsers } from '@/app/actions/card/assignees'
import type { User } from '@/types/database'

interface ShareBoardModalProps {
  isOpen: boolean
  onClose: () => void
  boardId: string
  boardName: string
  boardOwnerId: string
  onUpdate: () => void
}

export function ShareBoardModal({ isOpen, onClose, boardId, boardName, boardOwnerId, onUpdate }: ShareBoardModalProps) {
  const [accessList, setAccessList] = useState<any[]>([])
  const [availableUsers, setAvailableUsers] = useState<User[]>([])
  const [selectedUser, setSelectedUser] = useState('')
  const [accessLevel, setAccessLevel] = useState<'editor' | 'viewer'>('editor')
  const [showAddUser, setShowAddUser] = useState(false)
  const [loading, setLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)

  // Get current user on mount
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
  }, [isOpen, boardId])

  async function loadAccessList() {
    setLoading(true)
    setError(null)
    const result = await getBoardAccessList(boardId)
    
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

    console.log('[ShareBoardModal] Starting share process...')
    setSubmitting(true)
    setError(null)
    const result = await shareBoardWithUser(boardId, selectedUser, accessLevel)
    console.log('[ShareBoardModal] Share result:', result)

    if (result?.error) {
      console.error('[ShareBoardModal] Error occurred:', result.error)
      setError(result.error)
    } else {
      console.log('[ShareBoardModal] Share successful!')
      setSelectedUser('')
      setAccessLevel('editor')
      setShowAddUser(false)
      loadAccessList()
      onUpdate()
    }
    setSubmitting(false)
  }

  const handleRemoveAccess = async (userId: string) => {
    if (!confirm('Remove this user\'s access to the board?')) return

    setSubmitting(true)
    setError(null)
    const result = await removeBoardAccess(boardId, userId)

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
    <Modal isOpen={isOpen} onClose={onClose} title={`Share "${boardName}"`} maxWidth="lg">
      <div className="space-y-4">
        {error && (
          <div className="p-3 bg-red-500/10 border border-red-500 rounded text-red-500 text-sm">
            {error}
          </div>
        )}

        {/* Access List */}
        <div className="space-y-2">
          <h3 className="font-medium text-[hsl(var(--color-text-primary))]">Users with Access</h3>
          {loading ? (
            <p className="text-sm text-[hsl(var(--color-text-secondary))] text-center py-8">
              Loading...
            </p>
          ) : accessList.length === 0 ? (
            <p className="text-sm text-[hsl(var(--color-text-secondary))] text-center py-8">
              Only you have access to this board.
            </p>
          ) : (
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {accessList.map((access) => {
                const user = availableUsers.find(u => u.id === access.user_id)
                const isOwner = access.access_level === 'owner'
                const canRemove = currentUserId === boardOwnerId && !isOwner
                
                return (
                  <div
                    key={access.id}
                    className="flex items-center justify-between p-3 bg-[hsl(var(--color-surface))] rounded-lg border border-[hsl(var(--color-border))]"
                  >
                    <div className="flex-1">
                      <p className="text-sm font-medium text-[hsl(var(--color-text-primary))]">
                        {user?.display_name || user?.email || `User ID: ${access.user_id}`}
                      </p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className={`text-xs px-2 py-0.5 rounded ${
                          isOwner 
                            ? 'bg-yellow-500/10 text-yellow-600 dark:text-yellow-400'
                            : 'bg-[hsl(var(--color-primary))]/10 text-[hsl(var(--color-primary))]'
                        }`}>
                          {access.access_level}
                        </span>
                        <span className="text-xs text-[hsl(var(--color-text-secondary))]">
                          {isOwner ? 'Board creator' : `Granted ${new Date(access.granted_at).toLocaleDateString()}`}
                        </span>
                      </div>
                    </div>
                    {canRemove && (
                      <Button
                        onClick={() => handleRemoveAccess(access.user_id)}
                        variant="ghost"
                        size="sm"
                        className="text-red-500 hover:text-red-600"
                        disabled={submitting}
                      >
                        Remove
                      </Button>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Add User Section - Show ONLY for board owners (after migration 38) */}
        {currentUserId && currentUserId === boardOwnerId && (
          <div className="pt-4 border-t border-[hsl(var(--color-border))]">
            <h3 className="font-medium text-[hsl(var(--color-text-primary))] mb-2">Add User</h3>
          
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
                <label className="block text-sm font-medium text-[hsl(var(--color-text-secondary))] mb-2">
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
                <label className="block text-sm font-medium text-[hsl(var(--color-text-secondary))] mb-2">
                  Access Level
                </label>
                <div className="flex gap-2">
                  <button
                    onClick={() => setAccessLevel('editor')}
                    className={`flex-1 px-3 py-2 rounded-lg border transition-colors ${
                      accessLevel === 'editor'
                        ? 'bg-[hsl(var(--color-primary))] text-white border-[hsl(var(--color-primary))]'
                        : 'bg-[hsl(var(--color-surface))] border-[hsl(var(--color-border))] text-[hsl(var(--color-text-primary))] hover:border-[hsl(var(--color-primary))]'
                    }`}
                  >
                    <div className="text-sm font-medium">Editor</div>
                    <div className="text-xs opacity-80">Can edit tasks and statuses</div>
                  </button>
                  <button
                    onClick={() => setAccessLevel('viewer')}
                    className={`flex-1 px-3 py-2 rounded-lg border transition-colors ${
                      accessLevel === 'viewer'
                        ? 'bg-[hsl(var(--color-primary))] text-white border-[hsl(var(--color-primary))]'
                        : 'bg-[hsl(var(--color-surface))] border-[hsl(var(--color-border))] text-[hsl(var(--color-text-primary))] hover:border-[hsl(var(--color-primary))]'
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
                    setAccessLevel('editor')
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

        <div className="flex justify-end pt-4 border-t border-[hsl(var(--color-border))]">
          <Button onClick={onClose} variant="ghost">
            Close
          </Button>
        </div>
      </div>
    </Modal>
  )
}
