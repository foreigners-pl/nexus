'use client'

import { useState, useEffect } from 'react'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { createCard, updateCard } from '@/app/actions/card/core'
import { addCardAssignee, removeCardAssignee } from '@/app/actions/card/assignees'
import { getBoardUsers } from '@/app/actions/board/sharing'
import { Card as CardType, User, CardAssignee } from '@/types/database'
import { createClient } from '@/lib/supabase/client'

interface CardWithAssignees extends CardType {
  card_assignees?: (CardAssignee & { users?: User })[]
}

interface CardModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: (card?: CardType) => void
  boardId: string
  statusId: string
  card?: CardWithAssignees | null
  isSharedBoard?: boolean // Whether the board has other users
}

export function CardModal({ isOpen, onClose, onSuccess, boardId, statusId, card, isSharedBoard = false }: CardModalProps) {
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [dueDate, setDueDate] = useState('')
  const [assignees, setAssignees] = useState<(CardAssignee & { users?: User })[]>([])
  const [availableUsers, setAvailableUsers] = useState<User[]>([])
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]) // Changed to array for multi-select
  const [showAssigneeDropdown, setShowAssigneeDropdown] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [assigneeLoading, setAssigneeLoading] = useState(false)
  const [assigneesModified, setAssigneesModified] = useState(false) // Track if assignees changed
  const [error, setError] = useState<string | null>(null)
  const supabase = createClient()

  const isEdit = !!card

  useEffect(() => {
    if (card) {
      setTitle(card.title)
      setDescription(card.description || '')
      setDueDate(card.due_date ? card.due_date.split('T')[0] : '')
      setAssignees(card.card_assignees || [])
    } else {
      setTitle('')
      setDescription('')
      setDueDate('')
      setAssignees([])
    }
    setError(null)
    setAssigneesModified(false) // Reset on card change
  }, [card, isOpen])

  useEffect(() => {
    if (isOpen) {
      // Always load users for assignee functionality
      loadUsers()
      if (isEdit && card) {
        loadCardAssignees()
      }
    }
  }, [isOpen, isEdit])

  const loadUsers = async () => {
    const result = await getBoardUsers(boardId)
    if (result?.data) {
      setAvailableUsers(result.data as User[])
    }
  }

  const loadCardAssignees = async () => {
    if (!card) return
    
    const { data, error } = await supabase
      .from('card_assignees')
      .select(`
        id,
        user_id,
        assigned_at,
        users:user_id (
          id,
          email,
          display_name
        )
      `)
      .eq('card_id', card.id)

    if (error) {
      console.error('Error loading card assignees:', error)
      setError(`Failed to load assignees: ${error.message}`)
    } else if (data) {
      setAssignees(data as any)
    }
  }

  const handleAddAssignee = async () => {
    if (!selectedUsers || selectedUsers.length === 0) return

    // If editing existing card, add to database
    if (card) {
      setAssigneeLoading(true)
      
      // Add all selected users
      for (const userId of selectedUsers) {
        await addCardAssignee(card.id, userId)
      }
      
      await loadCardAssignees()
      setSelectedUsers([])
      setShowAssigneeDropdown(false)
      setAssigneeLoading(false)
      setAssigneesModified(true) // Mark as modified
    } else {
      // If creating new card, just add to local state (will be saved after card creation)
      const usersToAdd = availableUsers.filter(u => selectedUsers.includes(u.id))
      const newAssignees = usersToAdd.map(user => ({
        id: `temp-${Date.now()}-${user.id}`, // Temporary ID
        card_id: '', // Will be set after creation
        user_id: user.id,
        assigned_at: new Date().toISOString(),
        users: user
      }))
      setAssignees(prev => [...prev, ...newAssignees])
      setSelectedUsers([])
      setShowAssigneeDropdown(false)
    }
  }

  const toggleUserSelection = (userId: string) => {
    setSelectedUsers(prev => {
      if (prev.includes(userId)) {
        return prev.filter(id => id !== userId)
      } else {
        return [...prev, userId]
      }
    })
  }

  const handleRemoveAssignee = async (assigneeId: string) => {
    // If editing existing card, remove from database
    if (card && !assigneeId.startsWith('temp-')) {
      setAssigneeLoading(true)
      const result = await removeCardAssignee(assigneeId)

      if (result?.error) {
        setError(result.error)
      } else {
        await loadCardAssignees()
        setAssigneesModified(true) // Mark as modified
      }
      setAssigneeLoading(false)
    } else {
      // If creating new card, just remove from local state
      setAssignees(prev => prev.filter(a => a.id !== assigneeId))
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    setError(null)

    console.log('🎯 CARD SUBMIT - isEdit:', isEdit, 'boardId:', boardId, 'statusId:', statusId)

    if (isEdit) {
      console.log('📝 Updating card:', card.id)
      const result = await updateCard(card.id, { title, description, due_date: dueDate })
      if (result?.error) {
        console.error('❌ Update failed:', result.error)
        setError(result.error)
        setSubmitting(false)
      } else {
        console.log('✅ Card updated successfully')
        setTitle('')
        setDescription('')
        setDueDate('')
        setAssignees([])
        setSubmitting(false)
        onSuccess()
        onClose()
      }
    } else {
      // For new tasks, create the card first
      console.log('➕ Creating new card:', { title, boardId, statusId })
      const result = await createCard(boardId, statusId, title, description, dueDate)
      
      console.log('📦 Create result:', result)
      
      if (result?.error) {
        console.error('❌ CREATE FAILED:', result.error)
        setError(result.error)
        setSubmitting(false)
      } else if (result?.data) {
        console.log('✅ Card created successfully:', result.data.id)
        // If there are assignees to add, add them now
        if (isSharedBoard && assignees.length > 0) {
          for (const assignee of assignees) {
            await addCardAssignee(result.data.id, assignee.user_id)
          }
        }
        
        setTitle('')
        setDescription('')
        setDueDate('')
        setAssignees([])
        setSubmitting(false)
        // Pass the new card data to parent for optimistic update
        onSuccess(result.data)
        onClose()
      }
    }
  }

  const handleClose = () => {
    if (!submitting) {
      // If assignees were modified (added/removed) but form wasn't submitted, trigger refresh
      if (isEdit && assigneesModified) {
        onSuccess() // This will trigger the board refresh
      }
      
      setTitle('')
      setDescription('')
      setDueDate('')
      setAssignees([])
      setSelectedUsers([])
      setError(null)
      setAssigneesModified(false)
      onClose()
    }
  }

  const getUnassignedUsers = () => {
    return availableUsers.filter(
      user => !assignees.some(a => a.user_id === user.id)
    )
  }

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title={isEdit ? 'Edit Task' : 'Add Task'} maxWidth="lg">
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="p-3 bg-red-500/10 border border-red-500 rounded text-red-500 text-sm">
            {error}
          </div>
        )}

        <div>
          <label className="block text-sm font-medium text-[hsl(var(--color-text-secondary))] mb-2">
            Title *
          </label>
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Enter task title..."
            required
            disabled={submitting}
            autoFocus
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-[hsl(var(--color-text-secondary))] mb-2">
            Description (optional)
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Add more details..."
            disabled={submitting}
            rows={4}
            className="w-full px-3 py-2 bg-[hsl(var(--color-surface))] border border-[hsl(var(--color-border))] rounded-lg text-[hsl(var(--color-text-primary))] placeholder:text-[hsl(var(--color-text-secondary))] focus:outline-none focus:ring-2 focus:ring-[hsl(var(--color-primary))] disabled:opacity-50"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-[hsl(var(--color-text-secondary))] mb-2">
            Due Date (optional)
          </label>
          <Input
            type="date"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
            disabled={submitting}
          />
        </div>

        {/* Assignees Section - Always visible for shared boards */}
        <div>
          <label className="block text-sm font-medium text-[hsl(var(--color-text-secondary))] mb-2">
            Assignees
          </label>
          {assignees.length === 0 ? (
            <p className="text-[hsl(var(--color-text-secondary))] text-sm mb-2">No assignees</p>
          ) : (
            <div className="space-y-2 mb-2">
              {assignees.map((assignee) => (
                  <div 
                    key={assignee.id} 
                    className="flex items-center justify-between p-2 rounded-lg bg-[hsl(var(--color-surface))] border border-[hsl(var(--color-border))]"
                  >
                    <span className="text-[hsl(var(--color-text-primary))] text-sm">
                      {assignee.users?.display_name || assignee.users?.email || 'Unknown User'}
                    </span>
                    <Button 
                      type="button"
                      variant="ghost" 
                      size="sm" 
                      onClick={() => handleRemoveAssignee(assignee.id)}
                      disabled={assigneeLoading || submitting}
                      className="text-red-500 hover:text-red-600"
                    >
                      Remove
                    </Button>
                  </div>
                ))}
              </div>
            )}

            {!showAssigneeDropdown ? (
              <Button 
                type="button"
                size="sm" 
                variant="outline" 
                onClick={() => setShowAssigneeDropdown(true)} 
                className="w-full"
                disabled={getUnassignedUsers().length === 0 || submitting}
              >
                {getUnassignedUsers().length === 0 ? 'All users assigned' : '+ Add Assignees'}
              </Button>
            ) : (
              <div className="space-y-3">
                {/* Multi-select checkbox list */}
                <div className="max-h-48 overflow-y-auto space-y-2 border border-[hsl(var(--color-border))] rounded-lg p-3 bg-[hsl(var(--color-surface))]">
                  {getUnassignedUsers().map(user => (
                    <label
                      key={user.id}
                      className="flex items-center gap-2 cursor-pointer hover:bg-[hsl(var(--color-background))] p-2 rounded transition-colors"
                    >
                      <input
                        type="checkbox"
                        checked={selectedUsers.includes(user.id)}
                        onChange={() => toggleUserSelection(user.id)}
                        disabled={assigneeLoading || submitting}
                        className="w-4 h-4 rounded border-[hsl(var(--color-border))] text-[hsl(var(--color-primary))] focus:ring-2 focus:ring-[hsl(var(--color-primary))]"
                      />
                      <span className="text-sm text-[hsl(var(--color-text-primary))]">
                        {user.display_name || user.email}
                      </span>
                    </label>
                  ))}
                </div>
                
                {/* Action buttons */}
                <div className="flex gap-2">
                  <Button
                    type="button"
                    size="sm"
                    onClick={handleAddAssignee}
                    disabled={selectedUsers.length === 0 || assigneeLoading || submitting}
                    className="flex-1"
                  >
                    {assigneeLoading ? 'Adding...' : `Add ${selectedUsers.length > 0 ? `(${selectedUsers.length})` : ''}`}
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      setShowAssigneeDropdown(false)
                      setSelectedUsers([])
                    }}
                    disabled={assigneeLoading || submitting}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            )}
          </div>

        <div className="flex justify-end gap-3 pt-4">
          <Button
            type="button"
            variant="ghost"
            onClick={handleClose}
            disabled={submitting}
          >
            Cancel
          </Button>
          <Button type="submit" disabled={submitting || !title.trim()}>
            {submitting ? (isEdit ? 'Saving...' : 'Adding...') : (isEdit ? 'Save' : 'Add Task')}
          </Button>
        </div>
      </form>
    </Modal>
  )
}
