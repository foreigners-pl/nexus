'use client'

import { useState, useRef, DragEvent } from 'react'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui'
import { Input } from '@/components/ui/Input'
import { uploadAttachment, deleteAttachment, getAttachmentUrl } from '@/app/actions/attachments'
import type { CaseAttachment } from '@/types/database'

interface AttachmentsSectionProps {
  caseId: string
  attachments: CaseAttachment[]
  onUpdate: () => void
  onAddClick?: () => void
}

export function AttachmentsSection({ caseId, attachments, onUpdate, onAddClick }: AttachmentsSectionProps) {
  const [uploading, setUploading] = useState(false)
  const [isDragging, setIsDragging] = useState(false)
  const [deleteModalOpen, setDeleteModalOpen] = useState(false)
  const [renameModalOpen, setRenameModalOpen] = useState(false)
  const [attachmentToDelete, setAttachmentToDelete] = useState<CaseAttachment | null>(null)
  const [attachmentToRename, setAttachmentToRename] = useState<CaseAttachment | null>(null)
  const [newFileName, setNewFileName] = useState('')
  const [deleting, setDeleting] = useState(false)
  const [renaming, setRenaming] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileSelect = async (files: FileList | null) => {
    if (!files || files.length === 0) return

    setUploading(true)
    
    // Upload files one by one
    for (let i = 0; i < files.length; i++) {
      const formData = new FormData()
      formData.append('file', files[i])
      
      const result = await uploadAttachment(caseId, formData)
      
      if (result.error) {
        console.error('Upload failed:', result.error)
        alert(`Failed to upload ${files[i].name}: ${result.error}`)
      }
    }

    setUploading(false)
    onUpdate()
    
    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)
    handleFileSelect(e.dataTransfer.files)
  }

  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(true)
  }

  const handleDragLeave = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)
  }

  const handleDelete = async (attachment: CaseAttachment) => {
    setAttachmentToDelete(attachment)
    setDeleteModalOpen(true)
  }

  const handleRename = (attachment: CaseAttachment) => {
    setAttachmentToRename(attachment)
    setNewFileName(attachment.file_name)
    setRenameModalOpen(true)
  }

  const confirmDelete = async () => {
    if (!attachmentToDelete) return
    
    setDeleting(true)
    const result = await deleteAttachment(attachmentToDelete.id, attachmentToDelete.file_path)
    
    if (!result.error) {
      onUpdate()
    }
    
    setDeleting(false)
    setDeleteModalOpen(false)
    setAttachmentToDelete(null)
  }

  const confirmRename = async () => {
    if (!attachmentToRename || !newFileName.trim()) return
    
    setRenaming(true)
    // TODO: Implement rename functionality in server action
    // For now, just close the modal
    setRenaming(false)
    setRenameModalOpen(false)
    setAttachmentToRename(null)
    setNewFileName('')
  }

  const handleView = async (attachment: CaseAttachment) => {
    const url = await getAttachmentUrl(attachment.file_path)
    if (url) {
      window.open(url, '_blank')
    } else {
      alert('Failed to load attachment')
    }
  }

  const handleDownload = async (attachment: CaseAttachment) => {
    const url = await getAttachmentUrl(attachment.file_path)
    if (!url) {
      alert('Failed to load attachment')
      return
    }
    const link = document.createElement('a')
    link.href = url
    link.download = attachment.file_name
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  const formatFileSize = (bytes?: number) => {
    if (!bytes) return ''
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  const getFileIcon = (fileType?: string, fileName?: string) => {
    // Check by MIME type first
    if (fileType) {
      if (fileType.startsWith('image/')) return '🖼️'
      if (fileType.includes('pdf')) return '📕'
      if (fileType.includes('word') || fileType.includes('document')) return '📘'
      if (fileType.includes('sheet') || fileType.includes('excel')) return '📊'
      if (fileType.includes('zip') || fileType.includes('rar') || fileType.includes('compressed')) return '📦'
      if (fileType.includes('video')) return '🎬'
      if (fileType.includes('audio')) return '🎵'
    }
    
    // Fallback to file extension
    if (fileName) {
      const ext = fileName.split('.').pop()?.toLowerCase()
      if (['jpg', 'jpeg', 'png', 'gif', 'svg', 'webp'].includes(ext || '')) return '🖼️'
      if (ext === 'pdf') return '📕'
      if (['doc', 'docx'].includes(ext || '')) return '📘'
      if (['xls', 'xlsx', 'csv'].includes(ext || '')) return '📊'
      if (['zip', 'rar', '7z', 'tar', 'gz'].includes(ext || '')) return '📦'
      if (['mp4', 'mov', 'avi', 'mkv'].includes(ext || '')) return '🎬'
      if (['mp3', 'wav', 'flac', 'm4a'].includes(ext || '')) return '🎵'
    }
    
    return '📄'
  }

  return (
    <>
      <input
        id="attachment-file-input"
        ref={fileInputRef}
        type="file"
        multiple
        onChange={(e) => handleFileSelect(e.target.files)}
        className="hidden"
      />

      <Modal isOpen={deleteModalOpen} onClose={() => setDeleteModalOpen(false)} title="Delete Attachment">
        <div className="space-y-4">
          <p>Are you sure you want to delete <strong>{attachmentToDelete?.file_name}</strong>? This action cannot be undone.</p>
          <div className="flex justify-end gap-3">
            <Button variant="ghost" onClick={() => setDeleteModalOpen(false)} disabled={deleting}>
              Cancel
            </Button>
            <Button 
              onClick={confirmDelete} 
              disabled={deleting}
              className="bg-red-500 hover:bg-red-600 text-white"
            >
              {deleting ? 'Deleting...' : 'Delete'}
            </Button>
          </div>
        </div>
      </Modal>

      <Modal isOpen={renameModalOpen} onClose={() => setRenameModalOpen(false)} title="Rename File">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-[hsl(var(--color-text-secondary))] mb-1">
              New file name
            </label>
            <Input
              value={newFileName}
              onChange={(e) => setNewFileName(e.target.value)}
              placeholder="Enter new file name"
              disabled={renaming}
            />
          </div>
          <div className="flex justify-end gap-3">
            <Button variant="ghost" onClick={() => setRenameModalOpen(false)} disabled={renaming}>
              Cancel
            </Button>
            <Button 
              onClick={confirmRename} 
              disabled={renaming || !newFileName.trim()}
            >
              {renaming ? 'Renaming...' : 'Rename'}
            </Button>
          </div>
        </div>
      </Modal>
      
      <div
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        className={`
          max-h-[480px] overflow-y-auto pr-2 transition-colors rounded
          ${isDragging ? 'bg-[hsl(var(--color-primary))]/5 ring-2 ring-[hsl(var(--color-primary))] ring-inset' : ''}
          ${uploading ? 'opacity-50 pointer-events-none' : ''}
        `}
      >
        {uploading && (
          <div className="flex items-center justify-center py-6">
            <p className="text-sm text-[hsl(var(--color-text-secondary))]">Uploading files...</p>
          </div>
        )}

        {!uploading && attachments.length === 0 && (
          <div className="flex items-center justify-center py-8 text-[hsl(var(--color-text-secondary))]">
            <p className="text-sm">No attachments yet. Drag files here or click "Add Attachment" to upload.</p>
          </div>
        )}

        {!uploading && attachments.length > 0 && (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {attachments.map((attachment) => (
              <div
                key={attachment.id}
                className="relative border border-[hsl(var(--color-border))] rounded p-4 transition-colors group overflow-hidden"
              >
                {/* File Icon - Larger, centered */}
                <div className="flex flex-col items-center justify-center mb-2">
                  <span className="text-6xl mb-2">{getFileIcon(attachment.file_type, attachment.file_name)}</span>
                  <div className="w-full text-center">
                    <p className="text-xs text-[hsl(var(--color-text-primary))] truncate font-medium px-1" title={attachment.file_name}>
                      {attachment.file_name}
                    </p>
                    <p className="text-xs text-[hsl(var(--color-text-secondary))] mt-0.5">
                      {new Date(attachment.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    </p>
                  </div>
                </div>

                {/* Hover Buttons - Show on hover */}
                <div className="absolute inset-0 bg-black/70 rounded opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1.5 p-2">
                  <button
                    onClick={() => handleView(attachment)}
                    className="p-1.5 bg-[hsl(var(--color-surface))] hover:bg-[hsl(var(--color-surface-hover))] text-[hsl(var(--color-text-primary))] rounded transition-colors"
                    title="Open"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
                    </svg>
                  </button>
                  <button
                    onClick={() => handleDownload(attachment)}
                    className="p-1.5 bg-[hsl(var(--color-surface))] hover:bg-[hsl(var(--color-surface-hover))] text-[hsl(var(--color-text-primary))] rounded transition-colors"
                    title="Download"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                    </svg>
                  </button>
                  <button
                    onClick={() => handleRename(attachment)}
                    className="p-1.5 bg-[hsl(var(--color-surface))] hover:bg-[hsl(var(--color-surface-hover))] text-[hsl(var(--color-text-primary))] rounded transition-colors"
                    title="Rename"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                    </svg>
                  </button>
                  <button
                    onClick={() => handleDelete(attachment)}
                    className="p-1.5 bg-red-500 hover:bg-red-600 text-white rounded transition-colors"
                    title="Delete"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  )
}

