'use client'

import { useState, useRef, DragEvent } from 'react'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui'
import { Eye, Download, Trash2 } from 'lucide-react'
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
  const [selected, setSelected] = useState<CaseAttachment | null>(null)
  const [deleteModalOpen, setDeleteModalOpen] = useState(false)
  const [attachmentToDelete, setAttachmentToDelete] = useState<CaseAttachment | null>(null)
  const [deleting, setDeleting] = useState(false)
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

      {/* Attachment detail popup */}
      <Modal isOpen={!!selected} onClose={() => setSelected(null)} title="Attachment">
        {selected && (
          <div className="space-y-5">
            <div className="flex items-center gap-3">
              <span className="text-4xl leading-none shrink-0">{getFileIcon(selected.file_type, selected.file_name)}</span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-[hsl(var(--color-text-primary))] break-all">
                  {selected.file_name}
                </p>
                <p className="text-xs text-[hsl(var(--color-text-muted))] mt-1">
                  {[
                    selected.uploader?.display_name || selected.uploader?.email?.split('@')[0] || 'Unknown',
                    new Date(selected.created_at).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' }),
                    formatFileSize(selected.file_size),
                  ].filter(Boolean).join(' · ')}
                </p>
              </div>
            </div>

            <div className="space-y-2">
              <Button
                onClick={() => { handleView(selected) }}
                className="w-full gap-2"
              >
                <Eye className="w-4 h-4" />
                Open
              </Button>
              <Button
                variant="secondary"
                onClick={() => { handleDownload(selected) }}
                className="w-full gap-2"
              >
                <Download className="w-4 h-4" />
                Download
              </Button>
              <Button
                variant="ghost"
                onClick={() => { setSelected(null); handleDelete(selected) }}
                className="w-full gap-2 text-red-400 hover:bg-red-500/10"
              >
                <Trash2 className="w-4 h-4" />
                Delete
              </Button>
            </div>
          </div>
        )}
      </Modal>

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
              variant="danger"
            >
              {deleting ? 'Deleting...' : 'Delete'}
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
          <div className="grid grid-cols-2 gap-3">
            {attachments.map((attachment) => {
              const uploader = attachment.uploader?.display_name || attachment.uploader?.email?.split('@')[0]
              return (
                <button
                  key={attachment.id}
                  onClick={() => setSelected(attachment)}
                  className="border border-[hsl(var(--color-border))] rounded-xl bg-[hsl(var(--color-surface-secondary))] p-3 overflow-hidden text-left cursor-pointer hover:bg-[hsl(var(--color-surface-hover))] hover:border-[hsl(var(--color-text-muted))]/40 active:bg-[hsl(var(--color-surface-active))]"
                >
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-[hsl(var(--color-text-primary))] leading-snug line-clamp-3 break-all" title={attachment.file_name}>
                      {attachment.file_name}
                    </p>
                    <p className="text-[11px] text-[hsl(var(--color-text-muted))] mt-1.5 truncate">
                      {[uploader, new Date(attachment.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }), formatFileSize(attachment.file_size)].filter(Boolean).join(' · ')}
                    </p>
                  </div>
                </button>
              )
            })}
          </div>
        )}
      </div>
    </>
  )
}

