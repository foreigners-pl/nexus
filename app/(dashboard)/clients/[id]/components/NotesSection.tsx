'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle, Modal } from '@/components/ui'
import { Button } from '@/components/ui/Button'
import { addNote, deleteNote, togglePinNote } from '@/app/actions/notes'
import type { ClientNote } from '@/types/database'

interface NotesSectionProps {
  clientId: string
  notes: ClientNote[]
  onUpdate: () => void
}

export function NotesSection({ clientId, notes, onUpdate }: NotesSectionProps) {
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false)
  const [noteToDelete, setNoteToDelete] = useState<string | null>(null)
  const [newNote, setNewNote] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleAddNote = async () => {
    if (!newNote.trim()) return
    
    setSubmitting(true)
    setError(null)
    const result = await addNote(clientId, newNote)
    
    if (result?.error) {
      setError(result.error)
      setSubmitting(false)
      return
    }
    
    setNewNote('')
    setIsModalOpen(false)
    onUpdate()
    setSubmitting(false)
  }

  const handleDeleteNote = async (noteId: string) => {
    setNoteToDelete(noteId)
    setIsDeleteModalOpen(true)
  }

  const confirmDelete = async () => {
    if (!noteToDelete) return
    
    setDeleting(true)
    const result = await deleteNote(noteToDelete, clientId)
    if (!result?.error) {
      onUpdate()
    }
    setDeleting(false)
    setIsDeleteModalOpen(false)
    setNoteToDelete(null)
  }

  const handleTogglePin = async (noteId: string, isPinned: boolean) => {
    const result = await togglePinNote(noteId, clientId, isPinned)
    if (!result?.error) onUpdate()
  }

  return (
    <>
      <Card className="backdrop-blur-xl bg-[hsl(var(--color-surface))]/80 border-[hsl(var(--color-border))] shadow-[0_8px_32px_rgb(0_0_0/0.25)]">
        <CardHeader>
          <div className="flex justify-between items-center">
            <CardTitle>Notes</CardTitle>
            <Button size="sm" onClick={() => setIsModalOpen(true)}>+ Add Note</Button>
          </div>
        </CardHeader>
        <CardContent>
          {notes.length === 0 ? (
            <p className="text-[hsl(var(--color-text-secondary))] text-center py-8">No notes yet</p>
          ) : (
            <div className="space-y-3">
              {notes.map((note) => (
                <div key={note.id} className="p-4 rounded-xl bg-[hsl(var(--color-surface-hover))]/50 border border-[hsl(var(--color-border))] backdrop-blur-sm">
                  <div className="flex justify-between items-start gap-4">
                    <div className="flex-1 min-w-0">
                      {note.is_pinned && (
                        <span className="inline-flex items-center gap-1 text-xs text-[hsl(var(--color-primary))] mb-2">
                          <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                            <path d="M10 2a.75.75 0 01.75.75v1.5a.75.75 0 01-1.5 0v-1.5A.75.75 0 0110 2zM10 15a.75.75 0 01.75.75v1.5a.75.75 0 01-1.5 0v-1.5A.75.75 0 0110 15zM10 7a3 3 0 100 6 3 3 0 000-6zM15.657 5.404a.75.75 0 10-1.06-1.06l-1.061 1.06a.75.75 0 001.06 1.061l1.06-1.06zM6.464 14.596a.75.75 0 10-1.06-1.06l-1.06 1.06a.75.75 0 001.06 1.06l1.06-1.06zM18 10a.75.75 0 01-.75.75h-1.5a.75.75 0 010-1.5h1.5A.75.75 0 0118 10zM5 10a.75.75 0 01-.75.75h-1.5a.75.75 0 010-1.5h1.5A.75.75 0 015 10zM14.596 15.657a.75.75 0 001.06-1.06l-1.06-1.061a.75.75 0 10-1.06 1.06l1.06 1.06zM5.404 6.464a.75.75 0 001.06-1.06l-1.06-1.06a.75.75 0 10-1.061 1.06l1.06 1.06z" />
                          </svg>
                          Pinned
                        </span>
                      )}
                      <p className="text-[hsl(var(--color-text-primary))] whitespace-pre-wrap break-words">{note.note}</p>
                      <p className="text-xs text-[hsl(var(--color-text-muted))] mt-2">
                        {new Date(note.created_at).toLocaleString()}
                      </p>
                    </div>
                    <div className="flex gap-1 flex-shrink-0">
                      <Button size="sm" variant="ghost" onClick={() => handleTogglePin(note.id, note.is_pinned || false)}>
                        {note.is_pinned ? 'Unpin' : 'Pin'}
                      </Button>
                      <Button 
                        size="sm" 
                        variant="ghost" 
                        onClick={() => handleDeleteNote(note.id)}
                        className="text-red-400 hover:text-red-300 hover:bg-red-500/10"
                      >
                        Delete
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Add Note">
        <div className="space-y-4">
          {error && (
            <div className="p-3 rounded bg-red-500/10 border border-red-500/20 text-red-500 text-sm">
              {error}
            </div>
          )}
          <div>
            <label className="block text-sm font-medium text-[hsl(var(--color-text-secondary))] mb-2">Note</label>
            <textarea
              value={newNote}
              onChange={(e) => setNewNote(e.target.value)}
              placeholder="Enter note..."
              className="w-full h-32 px-3 py-2 rounded-lg bg-[hsl(var(--color-input-bg))] border border-[hsl(var(--color-input-border))] text-[hsl(var(--color-text-primary))] placeholder:text-[hsl(var(--color-text-muted))] focus:outline-none focus:ring-2 focus:ring-[hsl(var(--color-input-focus))] resize-none"
            />
          </div>
          <div className="flex justify-end gap-3 pt-4">
            <Button variant="ghost" onClick={() => setIsModalOpen(false)} disabled={submitting}>Cancel</Button>
            <Button onClick={handleAddNote} disabled={submitting || !newNote.trim()}>
              {submitting ? 'Adding...' : 'Add Note'}
            </Button>
          </div>
        </div>
      </Modal>

      <Modal isOpen={isDeleteModalOpen} onClose={() => setIsDeleteModalOpen(false)} title="Delete Note">
        <div className="space-y-4">
          <p className="text-[hsl(var(--color-text-primary))]">Are you sure you want to delete this note? This action cannot be undone.</p>
          <div className="flex justify-end gap-3 pt-4">
            <Button variant="ghost" onClick={() => setIsDeleteModalOpen(false)} disabled={deleting}>
              Cancel
            </Button>
            <Button 
              onClick={confirmDelete} 
              disabled={deleting}
              className="bg-red-500 hover:bg-red-600 text-white"
            >
              {deleting ? 'Deleting...' : 'Delete Note'}
            </Button>
          </div>
        </div>
      </Modal>
    </>
  )
}
