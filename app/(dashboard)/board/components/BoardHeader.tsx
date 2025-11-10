'use client'

import { useState, useRef, useEffect } from 'react'
import { Button } from '@/components/ui/Button'
import { updateBoard } from '@/app/actions/board/core'

interface BoardHeaderProps {
  boardId?: string
  boardName?: string
  boardDescription?: string
  isSystem?: boolean
  isOwner?: boolean
  onUpdate?: (updates: { name?: string; description?: string }) => void
  onShareClick?: () => void
  onDeleteClick?: () => void
}

export function BoardHeader({ 
  boardId,
  boardName = 'Board', 
  boardDescription, 
  isSystem = false,
  isOwner = false,
  onUpdate,
  onShareClick,
  onDeleteClick
}: BoardHeaderProps) {
  const [showMenu, setShowMenu] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  const [isEditingName, setIsEditingName] = useState(false)
  const [isEditingDescription, setIsEditingDescription] = useState(false)
  const [name, setName] = useState(boardName)
  const [description, setDescription] = useState(boardDescription || '')
  const [saving, setSaving] = useState(false)

  // Close menu when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setShowMenu(false)
      }
    }
    
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleNameSave = async () => {
    if (!boardId || isSystem || !name.trim() || name === boardName) {
      setIsEditingName(false)
      return
    }
    
    setSaving(true)
    
    // Optimistic update
    onUpdate?.({ name })
    
    const result = await updateBoard(boardId, { name })
    if (result?.error) {
      // Rollback on error
      setName(boardName)
      onUpdate?.({ name: boardName })
      alert(result.error)
    }
    
    setSaving(false)
    setIsEditingName(false)
  }

  const handleDescriptionSave = async () => {
    if (!boardId || isSystem || description === boardDescription) {
      setIsEditingDescription(false)
      return
    }
    
    setSaving(true)
    
    // Trim to 70 characters
    const trimmedDescription = description.slice(0, 70)
    
    // Optimistic update
    onUpdate?.({ description: trimmedDescription })
    
    const result = await updateBoard(boardId, { description: trimmedDescription })
    if (result?.error) {
      // Rollback on error
      setDescription(boardDescription || '')
      onUpdate?.({ description: boardDescription })
      alert(result.error)
    } else {
      setDescription(trimmedDescription)
    }
    
    setSaving(false)
    setIsEditingDescription(false)
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 flex-wrap">
        {/* Board Name */}
        {isEditingName && !isSystem ? (
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onBlur={handleNameSave}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleNameSave()
                if (e.key === 'Escape') {
                  setName(boardName)
                  setIsEditingName(false)
                }
              }}
              disabled={saving}
              autoFocus
              className="text-3xl font-bold text-[hsl(var(--color-text-primary))] bg-[hsl(var(--color-surface))] border border-[hsl(var(--color-border))] rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-[hsl(var(--color-primary))]"
            />
          </div>
        ) : (
          <h1 
            className={`text-3xl font-bold text-[hsl(var(--color-text-primary))] ${!isSystem ? 'cursor-pointer hover:text-[hsl(var(--color-primary))] transition-colors' : ''}`}
            onClick={() => !isSystem && setIsEditingName(true)}
            title={!isSystem ? 'Click to edit' : undefined}
          >
            {boardName}
          </h1>
        )}
        
        {isSystem && (
          <span className="px-2 py-1 text-xs bg-[hsl(var(--color-surface))] text-[hsl(var(--color-text-secondary))] rounded border border-[hsl(var(--color-border))]">
            System Board
          </span>
        )}

        {/* Action Buttons - Next to title so they don't scroll off */}
        {!isSystem && (
          <div className="flex items-center gap-2">
            {onShareClick && (
              <Button onClick={onShareClick} variant="ghost" size="sm">
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                </svg>
                Share
              </Button>
            )}
            
            {/* More Options Menu - Only show for owners */}
            {isOwner && onDeleteClick && (
              <div className="relative" ref={menuRef}>
                <Button 
                  onClick={() => setShowMenu(!showMenu)} 
                  variant="ghost" 
                  size="sm"
                  title="More options"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
                  </svg>
                </Button>
                
                {showMenu && (
                  <div className="absolute top-full left-0 mt-1 bg-[hsl(var(--color-surface))] border border-[hsl(var(--color-border))] rounded-lg shadow-lg overflow-hidden z-50 min-w-[160px]">
                    <button
                      onClick={() => {
                        setShowMenu(false)
                        onDeleteClick()
                      }}
                      className="w-full px-4 py-2 text-left text-sm text-red-500 hover:bg-red-500/10 transition-colors flex items-center gap-2"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                      Delete Board
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
      
      {/* Board Description */}
      {isEditingDescription && !isSystem ? (
        <div>
          <input
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value.slice(0, 70))}
            onBlur={handleDescriptionSave}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleDescriptionSave()
              if (e.key === 'Escape') {
                setDescription(boardDescription || '')
                setIsEditingDescription(false)
              }
            }}
            disabled={saving}
            autoFocus
            maxLength={70}
            placeholder="Add a short description..."
            className="w-full max-w-md text-sm text-[hsl(var(--color-text-secondary))] bg-[hsl(var(--color-surface))] border border-[hsl(var(--color-border))] rounded px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-[hsl(var(--color-primary))]"
          />
          <p className="text-xs text-[hsl(var(--color-text-secondary))] mt-1">
            {description.length}/70 characters
          </p>
        </div>
      ) : (
        <p 
          className={`text-sm text-[hsl(var(--color-text-secondary))] ${!isSystem ? 'cursor-pointer hover:text-[hsl(var(--color-text-primary))] transition-colors' : ''}`}
          onClick={() => !isSystem && setIsEditingDescription(true)}
          title={!isSystem ? 'Click to edit' : undefined}
        >
          {boardDescription || (!isSystem ? 'Click to add description...' : '')}
        </p>
      )}
    </div>
  )
}
