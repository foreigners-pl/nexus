'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { updateBoard, deleteBoard } from '@/app/actions/board/core'
import { 
  createBoardStatus,
  updateBoardStatus,
  deleteBoardStatus,
  reorderBoardStatuses
} from '@/app/actions/board/statuses'
import { getBoardAccessList, removeBoardAccess } from '@/app/actions/board/sharing'
import { Board, BoardStatus } from '@/types/database'

interface BoardSettingsModalProps {
  isOpen: boolean
  onClose: () => void
  board: Board | null
  statuses?: BoardStatus[]
  onUpdate: () => void
}

type TabType = 'general' | 'statuses' | 'sharing'

export function BoardSettingsModal({ isOpen, onClose, board, statuses = [], onUpdate }: BoardSettingsModalProps) {
  const [activeTab, setActiveTab] = useState<TabType>('general')
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  // Status management states
  const [localStatuses, setLocalStatuses] = useState<BoardStatus[]>([])
  const [newStatusName, setNewStatusName] = useState('')
  const [newStatusColor, setNewStatusColor] = useState('#3b82f6')
  const [editingStatusId, setEditingStatusId] = useState<string | null>(null)
  const [editStatusName, setEditStatusName] = useState('')
  const [editStatusColor, setEditStatusColor] = useState('')

  // Sharing states
  const [accessList, setAccessList] = useState<any[]>([])
  const [loadingAccess, setLoadingAccess] = useState(false)

  useEffect(() => {
    if (board) {
      setName(board.name)
      setDescription(board.description || '')
      setLocalStatuses(statuses)
    }
    setError(null)
    setActiveTab('general')
  }, [board, statuses, isOpen])

  useEffect(() => {
    if (isOpen && board && activeTab === 'sharing') {
      loadAccessList()
    }
  }, [isOpen, board, activeTab])

  async function loadAccessList() {
    if (!board) return
    setLoadingAccess(true)
    const result = await getBoardAccessList(board.id)
    if (result?.data) {
      setAccessList(result.data)
    }
    setLoadingAccess(false)
  }

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!board) return

    setSubmitting(true)
    setError(null)

    const result = await updateBoard(board.id, { name, description })

    if (result?.error) {
      setError(result.error)
      setSubmitting(false)
    } else {
      setSubmitting(false)
      onUpdate()
      onClose()
    }
  }

  const handleDelete = async () => {
    if (!board) return
    if (!confirm(`Are you sure you want to delete "${board.name}"? This cannot be undone.`)) return

    setSubmitting(true)
    const result = await deleteBoard(board.id)

    if (result?.error) {
      setError(result.error)
      setSubmitting(false)
    } else {
      router.push('/board')
      onUpdate()
      onClose()
    }
  }

  const handleAddStatus = async () => {
    if (!board || !newStatusName.trim()) return

    setSubmitting(true)
    setError(null)

    const result = await createBoardStatus(board.id, newStatusName, newStatusColor)

    if (result?.error) {
      setError(result.error)
    } else {
      setNewStatusName('')
      setNewStatusColor('#3b82f6')
      onUpdate()
    }
    setSubmitting(false)
  }

  const handleUpdateStatus = async (statusId: string) => {
    if (!editStatusName.trim()) return

    setSubmitting(true)
    setError(null)

    const result = await updateBoardStatus(statusId, {
      name: editStatusName,
      color: editStatusColor
    })

    if (result?.error) {
      setError(result.error)
    } else {
      setEditingStatusId(null)
      onUpdate()
    }
    setSubmitting(false)
  }

  const handleDeleteStatus = async (statusId: string) => {
    if (!confirm('Are you sure you want to delete this status?')) return

    setSubmitting(true)
    setError(null)

    const result = await deleteBoardStatus(statusId)

    if (result?.error) {
      setError(result.error)
    } else {
      onUpdate()
    }
    setSubmitting(false)
  }

  const handleRemoveAccess = async (userId: string) => {
    if (!board) return
    if (!confirm('Remove this user\'s access to the board?')) return

    setSubmitting(true)
    setError(null)

    const result = await removeBoardAccess(board.id, userId)

    if (result?.error) {
      setError(result.error)
    } else {
      loadAccessList()
      onUpdate()
    }
    setSubmitting(false)
  }

  const handleClose = () => {
    if (!submitting) {
      setError(null)
      onClose()
    }
  }

  if (!board) return null

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Board Settings" maxWidth="lg">
      <div className="space-y-4">
        {error && (
          <div className="p-3 bg-red-500/10 border border-red-500 rounded text-red-500 text-sm">
            {error}
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-1 border-b border-[hsl(var(--color-border))]">
          <button
            onClick={() => setActiveTab('general')}
            className={`px-4 py-2 font-medium transition-colors relative ${
              activeTab === 'general'
                ? 'text-[hsl(var(--color-primary))]'
                : 'text-[hsl(var(--color-text-secondary))] hover:text-[hsl(var(--color-text-primary))]'
            }`}
          >
            General
            {activeTab === 'general' && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[hsl(var(--color-primary))]" />
            )}
          </button>
          <button
            onClick={() => setActiveTab('statuses')}
            className={`px-4 py-2 font-medium transition-colors relative ${
              activeTab === 'statuses'
                ? 'text-[hsl(var(--color-primary))]'
                : 'text-[hsl(var(--color-text-secondary))] hover:text-[hsl(var(--color-text-primary))]'
            }`}
          >
            Statuses
            {activeTab === 'statuses' && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[hsl(var(--color-primary))]" />
            )}
          </button>
          <button
            onClick={() => setActiveTab('sharing')}
            className={`px-4 py-2 font-medium transition-colors relative ${
              activeTab === 'sharing'
                ? 'text-[hsl(var(--color-primary))]'
                : 'text-[hsl(var(--color-text-secondary))] hover:text-[hsl(var(--color-text-primary))]'
            }`}
          >
            Sharing
            {activeTab === 'sharing' && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[hsl(var(--color-primary))]" />
            )}
          </button>
        </div>

        {/* General Tab */}
        {activeTab === 'general' && (
          <form onSubmit={handleUpdate} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-[hsl(var(--color-text-secondary))] mb-2">
                Board Name *
              </label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Enter board name..."
                required
                disabled={submitting}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-[hsl(var(--color-text-secondary))] mb-2">
                Description (optional)
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="What is this board for?"
                disabled={submitting}
                rows={3}
                className="w-full px-3 py-2 bg-[hsl(var(--color-surface))] border border-[hsl(var(--color-border))] rounded-lg text-[hsl(var(--color-text-primary))] placeholder:text-[hsl(var(--color-text-secondary))] focus:outline-none focus:ring-2 focus:ring-[hsl(var(--color-primary))] disabled:opacity-50"
              />
            </div>

            <div className="flex justify-between items-center pt-4 border-t border-[hsl(var(--color-border))]">
              <Button
                type="button"
                variant="ghost"
                onClick={handleDelete}
                disabled={submitting}
                className="text-red-500 hover:text-red-600"
              >
                Delete Board
              </Button>
              
              <div className="flex gap-3">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={handleClose}
                  disabled={submitting}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={submitting || !name.trim()}>
                  {submitting ? 'Saving...' : 'Save Changes'}
                </Button>
              </div>
            </div>
          </form>
        )}

        {/* Statuses Tab */}
        {activeTab === 'statuses' && (
          <div className="space-y-4">
            {/* Add New Status */}
            <div className="p-4 bg-[hsl(var(--color-surface))] rounded-lg border border-[hsl(var(--color-border))]">
              <h3 className="font-medium text-[hsl(var(--color-text-primary))] mb-3">Add New Status</h3>
              <div className="flex gap-3">
                <Input
                  value={newStatusName}
                  onChange={(e) => setNewStatusName(e.target.value)}
                  placeholder="Status name..."
                  disabled={submitting}
                  className="flex-1"
                />
                <input
                  type="color"
                  value={newStatusColor}
                  onChange={(e) => setNewStatusColor(e.target.value)}
                  disabled={submitting}
                  className="w-12 h-10 rounded cursor-pointer"
                />
                <Button
                  onClick={handleAddStatus}
                  disabled={submitting || !newStatusName.trim()}
                >
                  Add
                </Button>
              </div>
            </div>

            {/* Existing Statuses */}
            <div className="space-y-2">
              <h3 className="font-medium text-[hsl(var(--color-text-primary))] mb-2">Current Statuses</h3>
              {localStatuses.length === 0 ? (
                <p className="text-sm text-[hsl(var(--color-text-secondary))] text-center py-8">
                  No statuses yet. Add one above to get started.
                </p>
              ) : (
                localStatuses.map((status) => (
                  <div
                    key={status.id}
                    className="flex items-center gap-3 p-3 bg-[hsl(var(--color-surface))] rounded-lg border border-[hsl(var(--color-border))]"
                  >
                    {editingStatusId === status.id ? (
                      <>
                        <Input
                          value={editStatusName}
                          onChange={(e) => setEditStatusName(e.target.value)}
                          className="flex-1"
                          autoFocus
                        />
                        <input
                          type="color"
                          value={editStatusColor}
                          onChange={(e) => setEditStatusColor(e.target.value)}
                          className="w-12 h-10 rounded cursor-pointer"
                        />
                        <Button
                          onClick={() => handleUpdateStatus(status.id)}
                          disabled={submitting}
                          size="sm"
                        >
                          Save
                        </Button>
                        <Button
                          onClick={() => setEditingStatusId(null)}
                          variant="ghost"
                          size="sm"
                        >
                          Cancel
                        </Button>
                      </>
                    ) : (
                      <>
                        <div
                          className="w-4 h-4 rounded-full flex-shrink-0"
                          style={{ backgroundColor: status.color }}
                        />
                        <span className="flex-1 text-[hsl(var(--color-text-primary))]">
                          {status.name}
                        </span>
                        <Button
                          onClick={() => {
                            setEditingStatusId(status.id)
                            setEditStatusName(status.name)
                            setEditStatusColor(status.color || '#3b82f6')
                          }}
                          variant="ghost"
                          size="sm"
                        >
                          Edit
                        </Button>
                        <Button
                          onClick={() => handleDeleteStatus(status.id)}
                          variant="ghost"
                          size="sm"
                          className="text-red-500 hover:text-red-600"
                          disabled={submitting}
                        >
                          Delete
                        </Button>
                      </>
                    )}
                  </div>
                ))
              )}
            </div>

            <div className="flex justify-end pt-4 border-t border-[hsl(var(--color-border))]">
              <Button onClick={handleClose} variant="ghost">
                Close
              </Button>
            </div>
          </div>
        )}

        {/* Sharing Tab */}
        {activeTab === 'sharing' && (
          <div className="space-y-4">
            {/* Add User Form */}
            <div className="p-4 bg-[hsl(var(--color-surface))] rounded-lg border border-[hsl(var(--color-border))]">
              <h3 className="font-medium text-[hsl(var(--color-text-primary))] mb-3">Share Board</h3>
              <p className="text-sm text-[hsl(var(--color-text-secondary))] mb-3">
                Note: User sharing by email is not yet implemented. You'll need to manually add user IDs.
              </p>
            </div>

            {/* Access List */}
            <div className="space-y-2">
              <h3 className="font-medium text-[hsl(var(--color-text-primary))] mb-2">Users with Access</h3>
              {loadingAccess ? (
                <p className="text-sm text-[hsl(var(--color-text-secondary))] text-center py-8">
                  Loading...
                </p>
              ) : accessList.length === 0 ? (
                <p className="text-sm text-[hsl(var(--color-text-secondary))] text-center py-8">
                  Only you have access to this board.
                </p>
              ) : (
                accessList.map((access) => (
                  <div
                    key={access.id}
                    className="flex items-center justify-between p-3 bg-[hsl(var(--color-surface))] rounded-lg border border-[hsl(var(--color-border))]"
                  >
                    <div>
                      <p className="text-sm text-[hsl(var(--color-text-primary))]">
                        User ID: {access.user_id}
                      </p>
                      <p className="text-xs text-[hsl(var(--color-text-secondary))]">
                        Access: {access.access_level}
                      </p>
                    </div>
                    <Button
                      onClick={() => handleRemoveAccess(access.user_id)}
                      variant="ghost"
                      size="sm"
                      className="text-red-500 hover:text-red-600"
                      disabled={submitting}
                    >
                      Remove
                    </Button>
                  </div>
                ))
              )}
            </div>

            <div className="flex justify-end pt-4 border-t border-[hsl(var(--color-border))]">
              <Button onClick={handleClose} variant="ghost">
                Close
              </Button>
            </div>
          </div>
        )}
      </div>
    </Modal>
  )
}
