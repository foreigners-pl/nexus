'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/Button'
import { 
  createBoardStatus, 
  updateBoardStatus, 
  deleteBoardStatus,
  reorderBoardStatuses 
} from '@/app/actions/board/statuses'
import { BoardStatus } from '@/types/database'

interface StatusManagerProps {
  boardId: string
  statuses: BoardStatus[]
  onUpdate: () => void
}

export function StatusManager({ boardId, statuses, onUpdate }: StatusManagerProps) {
  const [editingStatusId, setEditingStatusId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [colorPickerStatusId, setColorPickerStatusId] = useState<string | null>(null)
  const [newStatusName, setNewStatusName] = useState('')
  const [newStatusColor, setNewStatusColor] = useState('#3b82f6')
  const [isAddingStatus, setIsAddingStatus] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Sort statuses by position
  const sortedStatuses = [...statuses].sort((a, b) => a.position - b.position)

  const handleNameEdit = (status: BoardStatus) => {
    setEditingStatusId(status.id)
    setEditName(status.name)
  }

  const handleNameSave = async (statusId: string) => {
    if (!editName.trim()) {
      setEditingStatusId(null)
      return
    }

    setSubmitting(true)
    setError(null)
    const result = await updateBoardStatus(statusId, { name: editName })
    
    if (result?.error) {
      setError(result.error)
    } else {
      setEditingStatusId(null)
      onUpdate()
    }
    setSubmitting(false)
  }

  const handleColorChange = async (statusId: string, color: string) => {
    setSubmitting(true)
    setError(null)
    const result = await updateBoardStatus(statusId, { color })
    
    if (result?.error) {
      setError(result.error)
    } else {
      setColorPickerStatusId(null)
      onUpdate()
    }
    setSubmitting(false)
  }

  const handleMoveLeft = async (index: number) => {
    if (index === 0) return // Already at the start
    
    setSubmitting(true)
    setError(null)
    
    // Swap positions
    const newOrder = [...sortedStatuses]
    const temp = newOrder[index]
    newOrder[index] = newOrder[index - 1]
    newOrder[index - 1] = temp
    
    const statusIds = newOrder.map(s => s.id)
    const result = await reorderBoardStatuses(boardId, statusIds)
    
    if (result?.error) {
      setError(result.error)
    } else {
      onUpdate()
    }
    setSubmitting(false)
  }

  const handleMoveRight = async (index: number) => {
    if (index === sortedStatuses.length - 1) return // Already at the end
    
    setSubmitting(true)
    setError(null)
    
    // Swap positions
    const newOrder = [...sortedStatuses]
    const temp = newOrder[index]
    newOrder[index] = newOrder[index + 1]
    newOrder[index + 1] = temp
    
    const statusIds = newOrder.map(s => s.id)
    const result = await reorderBoardStatuses(boardId, statusIds)
    
    if (result?.error) {
      setError(result.error)
    } else {
      onUpdate()
    }
    setSubmitting(false)
  }

  const handleDelete = async (statusId: string) => {
    if (!confirm('Delete this status? Tasks in this status must be moved first.')) return
    
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

  const handleAddStatus = async () => {
    if (!newStatusName.trim()) return
    
    setSubmitting(true)
    setError(null)
    const result = await createBoardStatus(boardId, newStatusName, newStatusColor)
    
    if (result?.error) {
      setError(result.error)
    } else {
      setNewStatusName('')
      setNewStatusColor('#3b82f6')
      setIsAddingStatus(false)
      onUpdate()
    }
    setSubmitting(false)
  }

  return (
    <div className="space-y-3">
      {error && (
        <div className="p-3 bg-red-500/10 border border-red-500 rounded text-red-500 text-sm">
          {error}
        </div>
      )}

      {/* Status List */}
      <div className="flex flex-wrap gap-2 items-center">
        {sortedStatuses.map((status, index) => (
          <div
            key={status.id}
            className="flex items-center gap-2 px-3 py-2 bg-[hsl(var(--color-surface))] border border-[hsl(var(--color-border))] rounded-lg"
          >
            {/* Color Indicator */}
            <div className="relative">
              <button
                onClick={() => setColorPickerStatusId(colorPickerStatusId === status.id ? null : status.id)}
                className="w-5 h-5 rounded-full border-2 border-white shadow-sm cursor-pointer hover:scale-110 transition-transform"
                style={{ backgroundColor: status.color }}
                title="Click to change color"
                disabled={submitting}
              />
              {colorPickerStatusId === status.id && (
                <div className="absolute top-8 left-0 z-10 p-2 bg-[hsl(var(--color-surface))] border border-[hsl(var(--color-border))] rounded-lg shadow-lg">
                  <input
                    type="color"
                    value={status.color}
                    onChange={(e) => handleColorChange(status.id, e.target.value)}
                    disabled={submitting}
                    className="w-32 h-8 cursor-pointer"
                  />
                </div>
              )}
            </div>

            {/* Status Name */}
            {editingStatusId === status.id ? (
              <input
                type="text"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                onBlur={() => handleNameSave(status.id)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleNameSave(status.id)
                  if (e.key === 'Escape') setEditingStatusId(null)
                }}
                disabled={submitting}
                autoFocus
                className="px-2 py-1 bg-[hsl(var(--color-background))] border border-[hsl(var(--color-border))] rounded text-sm focus:outline-none focus:ring-2 focus:ring-[hsl(var(--color-primary))]"
              />
            ) : (
              <span
                onClick={() => handleNameEdit(status)}
                className="text-sm font-medium text-[hsl(var(--color-text-primary))] cursor-pointer hover:text-[hsl(var(--color-primary))] transition-colors"
                title="Click to edit"
              >
                {status.name}
              </span>
            )}

            {/* Move Buttons */}
            <div className="flex items-center gap-1 ml-2">
              <button
                onClick={() => handleMoveLeft(index)}
                disabled={submitting || index === 0}
                className="p-1 hover:bg-[hsl(var(--color-background))] rounded disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                title="Move left"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <button
                onClick={() => handleMoveRight(index)}
                disabled={submitting || index === sortedStatuses.length - 1}
                className="p-1 hover:bg-[hsl(var(--color-background))] rounded disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                title="Move right"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </div>

            {/* Delete Button */}
            <button
              onClick={() => handleDelete(status.id)}
              disabled={submitting}
              className="p-1 hover:bg-red-500/10 text-red-500 rounded transition-colors disabled:opacity-50"
              title="Delete status"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        ))}

        {/* Add Status Button/Form */}
        {isAddingStatus ? (
          <div className="flex items-center gap-2 px-3 py-2 bg-[hsl(var(--color-surface))] border border-[hsl(var(--color-border))] rounded-lg">
            <input
              type="color"
              value={newStatusColor}
              onChange={(e) => setNewStatusColor(e.target.value)}
              disabled={submitting}
              className="w-5 h-5 rounded-full cursor-pointer"
            />
            <input
              type="text"
              value={newStatusName}
              onChange={(e) => setNewStatusName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleAddStatus()
                if (e.key === 'Escape') {
                  setIsAddingStatus(false)
                  setNewStatusName('')
                }
              }}
              placeholder="Status name..."
              disabled={submitting}
              autoFocus
              className="px-2 py-1 bg-[hsl(var(--color-background))] border border-[hsl(var(--color-border))] rounded text-sm focus:outline-none focus:ring-2 focus:ring-[hsl(var(--color-primary))]"
            />
            <Button onClick={handleAddStatus} disabled={submitting || !newStatusName.trim()} size="sm">
              Add
            </Button>
            <Button 
              onClick={() => {
                setIsAddingStatus(false)
                setNewStatusName('')
              }} 
              variant="ghost" 
              size="sm"
              disabled={submitting}
            >
              Cancel
            </Button>
          </div>
        ) : (
          <Button
            onClick={() => setIsAddingStatus(true)}
            variant="ghost"
            size="sm"
            className="border-2 border-dashed border-[hsl(var(--color-border))] hover:border-[hsl(var(--color-primary))]"
          >
            <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Add Status
          </Button>
        )}
      </div>
    </div>
  )
}
