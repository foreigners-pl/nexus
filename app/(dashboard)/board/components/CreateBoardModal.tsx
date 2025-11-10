'use client'

import { useState } from 'react'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { createBoard } from '@/app/actions/board/core'

interface CreateBoardModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
}

export function CreateBoardModal({ isOpen, onClose, onSuccess }: CreateBoardModalProps) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    setError(null)

    const result = await createBoard(name, description)

    if (result?.error) {
      setError(result.error)
      setSubmitting(false)
    } else {
      setName('')
      setDescription('')
      setSubmitting(false)
      onSuccess()
      onClose()
    }
  }

  const handleClose = () => {
    if (!submitting) {
      setName('')
      setDescription('')
      setError(null)
      onClose()
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Create New Board">
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="p-3 bg-red-500/10 border border-red-500 rounded text-red-500 text-sm">
            {error}
          </div>
        )}

        <div>
          <label className="block text-sm font-medium text-[hsl(var(--color-text-secondary))] mb-2">
            Board Name *
          </label>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g., Marketing Tasks, Personal Projects..."
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
            placeholder="What is this board for?"
            disabled={submitting}
            rows={3}
            className="w-full px-3 py-2 bg-[hsl(var(--color-surface))] border border-[hsl(var(--color-border))] rounded-lg text-[hsl(var(--color-text-primary))] placeholder:text-[hsl(var(--color-text-secondary))] focus:outline-none focus:ring-2 focus:ring-[hsl(var(--color-primary))] disabled:opacity-50"
          />
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
          <Button type="submit" disabled={submitting || !name.trim()}>
            {submitting ? 'Creating...' : 'Create Board'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}
