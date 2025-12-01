'use client'

import { useEffect, useState } from 'react'
import { DndContext, DragEndEvent, closestCenter, PointerSensor, useSensor, useSensors, DragStartEvent, DragOverEvent } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Modal } from '@/components/ui/Modal'
import { ShareWikiModal } from './components/ShareWikiModal'
import { ShareDocumentModal } from './components/ShareDocumentModal'
import { DocumentViewer } from './components/DocumentViewer'
import {
  getWikiFolders,
  createWikiFolder,
  updateWikiFolderPosition,
  updateWikiFolderName,
  deleteWikiFolder,
  getWikiDocuments,
  createWikiDocument,
  updateWikiDocument,
  deleteWikiDocument,
  updateWikiDocumentPosition,
  moveDocumentToFolder,
  getUserFolderAccess
} from '@/app/actions/wiki'
import type { WikiFolder, WikiDocument } from '@/types/database'

export default function WikiPage() {
  const [activeTab, setActiveTab] = useState<'private' | 'shared'>('private')
  const [folders, setFolders] = useState<WikiFolder[]>([])
  const [selectedFolder, setSelectedFolder] = useState<WikiFolder | null>(null)
  const [documents, setDocuments] = useState<WikiDocument[]>([])
  const [allDocuments, setAllDocuments] = useState<Record<string, WikiDocument[]>>({})
  const [selectedDocument, setSelectedDocument] = useState<WikiDocument | null>(null)
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set())
  const [dragOverFolderId, setDragOverFolderId] = useState<string | null>(null)
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false)
  const [loading, setLoading] = useState(true)
  
  // Modals
  const [showNewFolderModal, setShowNewFolderModal] = useState(false)
  const [showNewDocModal, setShowNewDocModal] = useState(false)
  const [showDeleteFolderModal, setShowDeleteFolderModal] = useState(false)
  const [showDeleteDocModal, setShowDeleteDocModal] = useState(false)
  const [showShareWikiModal, setShowShareWikiModal] = useState(false)
  const [showShareDocModal, setShowShareDocModal] = useState(false)
  const [showRenameFolderModal, setShowRenameFolderModal] = useState(false)
  const [showRenameDocModal, setShowRenameDocModal] = useState(false)
  const [showMoveDocModal, setShowMoveDocModal] = useState(false)
  
  // Form state
  const [newFolderName, setNewFolderName] = useState('')
  const [newDocTitle, setNewDocTitle] = useState('')
  const [newDocType, setNewDocType] = useState<'rich-text' | 'table' | 'whiteboard'>('rich-text')
  const [folderToDelete, setFolderToDelete] = useState<WikiFolder | null>(null)
  const [docToDelete, setDocToDelete] = useState<WikiDocument | null>(null)
  const [folderToShare, setFolderToShare] = useState<WikiFolder | null>(null)
  const [docToShare, setDocToShare] = useState<WikiDocument | null>(null)
  const [folderToRename, setFolderToRename] = useState<WikiFolder | null>(null)
  const [renameFolderText, setRenameFolderText] = useState('')
  const [docToRename, setDocToRename] = useState<WikiDocument | null>(null)
  const [renameDocText, setRenameDocText] = useState('')
  const [docToMove, setDocToMove] = useState<WikiDocument | null>(null)
  const [moveToFolderId, setMoveToFolderId] = useState<string>('')
  const [submitting, setSubmitting] = useState(false)
  const [userAccess, setUserAccess] = useState<'owner' | 'editor' | 'viewer' | null>(null)

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  )

  useEffect(() => {
    loadFolders()
  }, [activeTab])

  useEffect(() => {
    if (selectedFolder) {
      loadDocuments(selectedFolder.id)
      loadUserAccess(selectedFolder.id)
    } else {
      setDocuments([])
      setUserAccess(null)
    }
  }, [selectedFolder])

  async function loadFolders() {
    setLoading(true)
    try {
      const isShared = activeTab === 'shared'
      const data = await getWikiFolders(isShared)
      setFolders(data)
      
      // Preload all documents for instant display
      const documentsMap: Record<string, WikiDocument[]> = {}
      await Promise.all(
        data.map(async (folder) => {
          try {
            const docs = await getWikiDocuments(folder.id)
            documentsMap[folder.id] = docs
          } catch (error) {
            console.error(`Failed to preload documents for folder ${folder.id}:`, error)
            documentsMap[folder.id] = []
          }
        })
      )
      setAllDocuments(documentsMap)
    } catch (error) {
      console.error('Failed to load folders:', error)
    } finally {
      setLoading(false)
    }
  }

  async function loadDocuments(folderId: string) {
    try {
      const data = await getWikiDocuments(folderId)
      setDocuments(data)
      setAllDocuments(prev => ({ ...prev, [folderId]: data }))
    } catch (error) {
      console.error('Failed to load documents:', error)
    }
  }

  async function loadUserAccess(folderId: string) {
    const access = await getUserFolderAccess(folderId)
    setUserAccess(access)
  }

  const handleCreateFolder = async () => {
    if (!newFolderName.trim()) return
    setSubmitting(true)
    const result = await createWikiFolder(newFolderName, activeTab === 'shared')
    if (!result?.error) {
      setNewFolderName('')
      setShowNewFolderModal(false)
      loadFolders()
    }
    setSubmitting(false)
  }

  const handleCreateDocument = async () => {
    if (!selectedFolder || !newDocTitle.trim()) return
    setSubmitting(true)
    const result = await createWikiDocument(selectedFolder.id, newDocTitle, newDocType)
    if (!result?.error) {
      setNewDocTitle('')
      setNewDocType('rich-text')
      setShowNewDocModal(false)
      loadDocuments(selectedFolder.id)
    }
    setSubmitting(false)
  }

  const handleDeleteFolder = async () => {
    if (!folderToDelete) return
    setSubmitting(true)
    const result = await deleteWikiFolder(folderToDelete.id)
    if (!result?.error) {
      setShowDeleteFolderModal(false)
      setFolderToDelete(null)
      if (selectedFolder?.id === folderToDelete.id) {
        setSelectedFolder(null)
        setSelectedDocument(null)
      }
      loadFolders()
    }
    setSubmitting(false)
  }

  const handleDeleteDocument = async () => {
    if (!docToDelete) return
    setSubmitting(true)
    const result = await deleteWikiDocument(docToDelete.id)
    if (!result?.error) {
      setShowDeleteDocModal(false)
      setDocToDelete(null)
      if (selectedDocument?.id === docToDelete.id) {
        setSelectedDocument(null)
      }
      if (selectedFolder) {
        loadDocuments(selectedFolder.id)
      }
    }
    setSubmitting(false)
  }

  const handleRenameDocument = async () => {
    if (!docToRename || !renameDocText.trim()) return
    setSubmitting(true)
    const result = await updateWikiDocument(docToRename.id, { title: renameDocText })
    if (!result?.error) {
      setShowRenameDocModal(false)
      setDocToRename(null)
      setRenameDocText('')
      if (selectedDocument?.id === docToRename.id) {
        setSelectedDocument({ ...selectedDocument, title: renameDocText })
      }
      if (selectedFolder) {
        loadDocuments(selectedFolder.id)
      }
    }
    setSubmitting(false)
  }

  const handleMoveDocument = async () => {
    if (!docToMove || !moveToFolderId) return
    setSubmitting(true)
    const result = await moveDocumentToFolder(docToMove.id, moveToFolderId)
    if (!result?.error) {
      setShowMoveDocModal(false)
      setDocToMove(null)
      setMoveToFolderId('')
      if (selectedDocument?.id === docToMove.id) {
        setSelectedDocument(null)
      }
      // Reload documents for both folders
      if (selectedFolder) {
        loadDocuments(selectedFolder.id)
      }
      loadDocuments(moveToFolderId)
    }
    setSubmitting(false)
  }

  const handleRenameFolder = async () => {
    if (!folderToRename || !renameFolderText.trim()) return
    setSubmitting(true)
    const result = await updateWikiFolderName(folderToRename.id, renameFolderText)
    if (!result?.error) {
      setShowRenameFolderModal(false)
      setFolderToRename(null)
      setRenameFolderText('')
      loadFolders()
    }
    setSubmitting(false)
  }

  const handleFolderDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return

    const oldIndex = folders.findIndex(f => f.id === active.id)
    const newIndex = folders.findIndex(f => f.id === over.id)

    if (oldIndex === -1 || newIndex === -1) return

    const newFolders = [...folders]
    const [movedFolder] = newFolders.splice(oldIndex, 1)
    newFolders.splice(newIndex, 0, movedFolder)

    setFolders(newFolders)

    // Update positions in database
    for (let i = 0; i < newFolders.length; i++) {
      await updateWikiFolderPosition(newFolders[i].id, i)
    }
  }

  const handleDocumentDragEnd = async (event: DragEndEvent, sourceFolderId: string) => {
    const { active, over } = event
    setDragOverFolderId(null)
    if (!over) return

    const activeId = active.id as string
    const overId = over.id as string

    // Check if dropping on a folder (to move document)
    if (folders.some(f => f.id === overId)) {
      const targetFolderId = overId
      if (targetFolderId !== sourceFolderId) {
        // Move document to different folder
        const result = await moveDocumentToFolder(activeId, targetFolderId)
        if (!result?.error) {
          // Reload both source and target folders
          loadDocuments(sourceFolderId)
          loadDocuments(targetFolderId)
          if (selectedDocument?.id === activeId) {
            setSelectedDocument(null)
          }
        }
      }
      return
    }

    // Reordering within same folder
    if (activeId === overId) return

    const folderDocs = allDocuments[sourceFolderId] || []
    const oldIndex = folderDocs.findIndex(d => d.id === activeId)
    const newIndex = folderDocs.findIndex(d => d.id === overId)

    if (oldIndex === -1 || newIndex === -1) return

    const newDocuments = [...folderDocs]
    const [movedDoc] = newDocuments.splice(oldIndex, 1)
    newDocuments.splice(newIndex, 0, movedDoc)

    // Update local state
    setAllDocuments(prev => ({ ...prev, [sourceFolderId]: newDocuments }))
    if (selectedFolder?.id === sourceFolderId) {
      setDocuments(newDocuments)
    }

    // Update positions in database
    for (let i = 0; i < newDocuments.length; i++) {
      await updateWikiDocumentPosition(newDocuments[i].id, i)
    }
  }

  const handleDocumentDragOver = (event: DragOverEvent) => {
    const { over } = event
    if (over && folders.some(f => f.id === over.id)) {
      setDragOverFolderId(over.id as string)
    } else {
      setDragOverFolderId(null)
    }
  }

  const toggleFolder = (folderId: string) => {
    const newExpanded = new Set(expandedFolders)
    if (newExpanded.has(folderId)) {
      newExpanded.delete(folderId)
    } else {
      newExpanded.add(folderId)
    }
    setExpandedFolders(newExpanded)
  }

  const canEdit = userAccess === 'owner' || userAccess === 'editor'
  const canDelete = userAccess === 'owner'

  return (
    <div className="fixed top-0 left-64 right-0 bottom-0 flex">
      {/* Sidebar */}
      <div className={`${
        isSidebarCollapsed ? 'w-16' : 'w-80'
      } bg-[hsl(var(--color-surface))] border-r border-[hsl(var(--color-border))] flex flex-col transition-all duration-300 flex-shrink-0 h-full`}>
        {isSidebarCollapsed ? (
          <div className="flex items-center justify-center p-4 border-b border-[hsl(var(--color-border))]">
            <button
              onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
              className="p-2 hover:bg-[hsl(var(--color-surface-hover))] rounded-lg transition-colors"
              title="Expand sidebar"
            >
              <svg
                className="w-5 h-5 text-[hsl(var(--color-text-secondary))]"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 5l7 7-7 7M5 5l7 7-7 7" />
              </svg>
            </button>
          </div>
        ) : (
          <>
            {/* Tabs */}
            <div className="flex items-center border-b border-[hsl(var(--color-border))]">
              <button
                onClick={() => setActiveTab('private')}
                className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
                  activeTab === 'private'
                    ? 'text-[hsl(var(--color-text-primary))] border-b-2 border-[hsl(var(--color-primary))]'
                    : 'text-[hsl(var(--color-text-secondary))] hover:text-[hsl(var(--color-text-primary))]'
                }`}
              >
                Private
              </button>
              <button
                onClick={() => setActiveTab('shared')}
                className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
                  activeTab === 'shared'
                    ? 'text-[hsl(var(--color-text-primary))] border-b-2 border-[hsl(var(--color-primary))]'
                    : 'text-[hsl(var(--color-text-secondary))] hover:text-[hsl(var(--color-text-primary))]'
                }`}
              >
                Shared
              </button>
              <button
                onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
                className="p-3 hover:bg-[hsl(var(--color-surface-hover))] transition-colors border-l border-[hsl(var(--color-border))]"
                title="Collapse sidebar"
              >
                <svg
                  className="w-5 h-5 text-[hsl(var(--color-text-secondary))]"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
                </svg>
              </button>
            </div>

        {/* Folder list */}
        <div className="flex-1 overflow-y-auto p-4">
          {loading ? (
            <div className="text-center py-8 text-[hsl(var(--color-text-secondary))]">
              Loading...
            </div>
          ) : folders.length === 0 ? (
            <div className="text-center py-8 text-[hsl(var(--color-text-secondary))]">
              No {activeTab} wikis yet
            </div>
          ) : (
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleFolderDragEnd}
            >
              <SortableContext items={folders.map(f => f.id)} strategy={verticalListSortingStrategy}>
                {folders.map(folder => {
                  const folderDocs = allDocuments[folder.id] || []
                  return (
                    <SortableFolderItem
                      key={folder.id}
                      folder={folder}
                      isExpanded={expandedFolders.has(folder.id)}
                      isSelected={selectedFolder?.id === folder.id}
                      documents={folderDocs}
                      selectedDocId={selectedDocument?.id}
                      isDragTarget={dragOverFolderId === folder.id}
                      onToggle={() => toggleFolder(folder.id)}
                      onSelectFolder={() => {
                        setSelectedFolder(folder)
                        setExpandedFolders(prev => new Set(prev).add(folder.id))
                      }}
                      onSelectDoc={(doc) => setSelectedDocument(doc)}
                      onDocumentDragEnd={(event) => handleDocumentDragEnd(event, folder.id)}
                      onDocumentDragOver={handleDocumentDragOver}
                      onNewDocument={() => {
                        setSelectedFolder(folder)
                        setShowNewDocModal(true)
                      }}
                      onDocumentRename={(doc) => {
                        setDocToRename(doc)
                        setRenameDocText(doc.title)
                        setShowRenameDocModal(true)
                      }}
                      onDocumentMove={(doc) => {
                        setDocToMove(doc)
                        setMoveToFolderId('')
                        setShowMoveDocModal(true)
                      }}
                      onDocumentDelete={(doc) => {
                        setDocToDelete(doc)
                        setShowDeleteDocModal(true)
                      }}
                      onShare={() => {
                        setFolderToShare(folder)
                        setShowShareWikiModal(true)
                      }}
                      onRename={() => {
                        setFolderToRename(folder)
                        setRenameFolderText(folder.name)
                        setShowRenameFolderModal(true)
                      }}
                      onDelete={() => {
                        setFolderToDelete(folder)
                        setShowDeleteFolderModal(true)
                      }}
                    />
                  )
                })}
              </SortableContext>
            <div className="mt-2">
              <button
                onClick={() => setShowNewFolderModal(true)}
                className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-left text-sm transition-colors hover:bg-[hsl(var(--color-surface-hover))] text-[hsl(var(--color-text-secondary))]"
              >
                <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                <span>New Wiki</span>
              </button>
            </div>
          </DndContext>
          )}
        </div>
          </>
        )}
      </div>

      {/* Main content */}
      <div className="flex-1 flex flex-col h-full min-w-0">
        {selectedDocument ? (
          <div className="flex-1 overflow-hidden p-8 min-w-0">
            <DocumentViewer
              document={selectedDocument}
              canEdit={canEdit}
              onUpdate={() => {
                if (selectedFolder) {
                  loadDocuments(selectedFolder.id)
                }
              }}
            />
          </div>
        ) : selectedFolder ? (
          <div className="flex-1 flex flex-col items-center justify-center p-8">
            <svg className="w-20 h-20 text-[hsl(var(--color-text-secondary))] mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <h3 className="text-lg font-medium text-[hsl(var(--color-text-primary))] mb-2">
              {documents.length === 0 ? 'No documents yet' : 'Select a document'}
            </h3>
            <p className="text-sm text-[hsl(var(--color-text-secondary))] mb-4">
              {documents.length === 0
                ? 'Create your first document to get started'
                : 'Choose a document from the sidebar or create a new one'}
            </p>
            {canEdit && (
              <Button onClick={() => setShowNewDocModal(true)}>
                + New Document
              </Button>
            )}
          </div>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center p-8">
            <svg className="w-20 h-20 text-[hsl(var(--color-text-secondary))] mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
            </svg>
            <h3 className="text-lg font-medium text-[hsl(var(--color-text-primary))] mb-2">
              {folders.length === 0 ? 'No wikis yet' : 'Select a wiki'}
            </h3>
            <p className="text-sm text-[hsl(var(--color-text-secondary))] mb-4">
              {folders.length === 0
                ? 'Create your first wiki to get started'
                : 'Choose a wiki from the sidebar to view its documents'}
            </p>
            {folders.length === 0 && (
              <Button onClick={() => setShowNewFolderModal(true)}>
                + New Wiki
              </Button>
            )}
          </div>
        )}
      </div>

      {/* Modals */}
      <Modal isOpen={showNewFolderModal} onClose={() => setShowNewFolderModal(false)} title="Create New Wiki">
        <div className="space-y-4">
          <Input
            value={newFolderName}
            onChange={(e) => setNewFolderName(e.target.value)}
            placeholder="Wiki name..."
            onKeyDown={(e) => e.key === 'Enter' && handleCreateFolder()}
            autoFocus
          />
          <div className="flex justify-end gap-3 pt-4">
            <Button variant="ghost" onClick={() => setShowNewFolderModal(false)} disabled={submitting}>
              Cancel
            </Button>
            <Button onClick={handleCreateFolder} disabled={!newFolderName.trim() || submitting}>
              {submitting ? 'Creating...' : 'Create'}
            </Button>
          </div>
        </div>
      </Modal>

      <Modal isOpen={showNewDocModal} onClose={() => setShowNewDocModal(false)} title="Create New Document">
        <div className="space-y-4">
          <Input
            value={newDocTitle}
            onChange={(e) => setNewDocTitle(e.target.value)}
            placeholder="Document title..."
            onKeyDown={(e) => e.key === 'Enter' && handleCreateDocument()}
            autoFocus
          />
          <div>
            <label className="block text-sm font-medium text-[hsl(var(--color-text-secondary))] mb-2">
              Document Type
            </label>
            <div className="grid grid-cols-3 gap-2">
              <button
                onClick={() => setNewDocType('rich-text')}
                className={`p-3 rounded-lg border transition-colors ${
                  newDocType === 'rich-text'
                    ? 'bg-[hsl(var(--color-primary))] border-[hsl(var(--color-primary))] text-white'
                    : 'border-[hsl(var(--color-border))] hover:border-[hsl(var(--color-primary))]'
                }`}
              >
                <svg className="w-6 h-6 mx-auto mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <span className="text-xs">Rich Text</span>
              </button>
              <button
                onClick={() => setNewDocType('table')}
                className={`p-3 rounded-lg border transition-colors ${
                  newDocType === 'table'
                    ? 'bg-[hsl(var(--color-primary))] border-[hsl(var(--color-primary))] text-white'
                    : 'border-[hsl(var(--color-border))] hover:border-[hsl(var(--color-primary))]'
                }`}
              >
                <svg className="w-6 h-6 mx-auto mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M3 14h18m-9-4v8m-7 0h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
                <span className="text-xs">Table</span>
              </button>
              <button
                onClick={() => setNewDocType('whiteboard')}
                className={`p-3 rounded-lg border transition-colors ${
                  newDocType === 'whiteboard'
                    ? 'bg-[hsl(var(--color-primary))] border-[hsl(var(--color-primary))] text-white'
                    : 'border-[hsl(var(--color-border))] hover:border-[hsl(var(--color-primary))]'
                }`}
              >
                <svg className="w-6 h-6 mx-auto mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 5a1 1 0 011-1h4a1 1 0 011 1v7a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM14 5a1 1 0 011-1h4a1 1 0 011 1v7a1 1 0 01-1 1h-4a1 1 0 01-1-1V5zM4 16a1 1 0 011-1h4a1 1 0 011 1v3a1 1 0 01-1 1H5a1 1 0 01-1-1v-3zM14 16a1 1 0 011-1h4a1 1 0 011 1v3a1 1 0 01-1 1h-4a1 1 0 01-1-1v-3z" />
                </svg>
                <span className="text-xs">Whiteboard</span>
              </button>
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-4">
            <Button variant="ghost" onClick={() => setShowNewDocModal(false)} disabled={submitting}>
              Cancel
            </Button>
            <Button onClick={handleCreateDocument} disabled={!newDocTitle.trim() || submitting}>
              {submitting ? 'Creating...' : 'Create'}
            </Button>
          </div>
        </div>
      </Modal>

      <Modal isOpen={showDeleteFolderModal} onClose={() => setShowDeleteFolderModal(false)} title="Delete Wiki">
        <div className="space-y-4">
          <p className="text-[hsl(var(--color-text-secondary))]">
            Are you sure you want to delete "{folderToDelete?.name}"? This will delete all documents in this wiki. This action cannot be undone.
          </p>
          <div className="flex justify-end gap-3 pt-4">
            <Button variant="ghost" onClick={() => setShowDeleteFolderModal(false)} disabled={submitting}>
              Cancel
            </Button>
            <Button onClick={handleDeleteFolder} className="bg-red-600 hover:bg-red-700" disabled={submitting}>
              {submitting ? 'Deleting...' : 'Delete'}
            </Button>
          </div>
        </div>
      </Modal>

      <Modal isOpen={showDeleteDocModal} onClose={() => setShowDeleteDocModal(false)} title="Delete Document">
        <div className="space-y-4">
          <p className="text-[hsl(var(--color-text-secondary))]">
            Are you sure you want to delete "{docToDelete?.title}"? This action cannot be undone.
          </p>
          <div className="flex justify-end gap-3 pt-4">
            <Button variant="ghost" onClick={() => setShowDeleteDocModal(false)} disabled={submitting}>
              Cancel
            </Button>
            <Button onClick={handleDeleteDocument} className="bg-red-600 hover:bg-red-700" disabled={submitting}>
              {submitting ? 'Deleting...' : 'Delete'}
            </Button>
          </div>
        </div>
      </Modal>

      <Modal isOpen={showRenameDocModal} onClose={() => setShowRenameDocModal(false)} title="Rename Document">
        <div className="space-y-4">
          <Input
            value={renameDocText}
            onChange={(e) => setRenameDocText(e.target.value)}
            placeholder="Document name..."
            onKeyDown={(e) => e.key === 'Enter' && handleRenameDocument()}
            autoFocus
          />
          <div className="flex justify-end gap-3 pt-4">
            <Button variant="ghost" onClick={() => setShowRenameDocModal(false)} disabled={submitting}>
              Cancel
            </Button>
            <Button onClick={handleRenameDocument} disabled={!renameDocText.trim() || submitting}>
              {submitting ? 'Renaming...' : 'Rename'}
            </Button>
          </div>
        </div>
      </Modal>

      <Modal isOpen={showMoveDocModal} onClose={() => setShowMoveDocModal(false)} title="Move Document">
        <div className="space-y-4">
          <p className="text-sm text-[hsl(var(--color-text-secondary))]">
            Move "{docToMove?.title}" to another wiki folder
          </p>
          <select
            value={moveToFolderId}
            onChange={(e) => setMoveToFolderId(e.target.value)}
            className="w-full px-3 py-2 bg-[hsl(var(--color-surface))] border border-[hsl(var(--color-border))] rounded-lg text-[hsl(var(--color-text-primary))] focus:outline-none focus:ring-2 focus:ring-[hsl(var(--color-primary))]"
          >
            <option value="">Select a wiki...</option>
            {folders
              .filter(f => f.id !== docToMove?.folder_id)
              .map(folder => (
                <option key={folder.id} value={folder.id}>
                  {folder.name}
                </option>
              ))}
          </select>
          <div className="flex justify-end gap-3 pt-4">
            <Button variant="ghost" onClick={() => setShowMoveDocModal(false)} disabled={submitting}>
              Cancel
            </Button>
            <Button onClick={handleMoveDocument} disabled={!moveToFolderId || submitting}>
              {submitting ? 'Moving...' : 'Move'}
            </Button>
          </div>
        </div>
      </Modal>

      <Modal isOpen={showRenameFolderModal} onClose={() => setShowRenameFolderModal(false)} title="Rename Wiki">
        <div className="space-y-4">
          <Input
            value={renameFolderText}
            onChange={(e) => setRenameFolderText(e.target.value)}
            placeholder="Wiki name..."
            onKeyDown={(e) => e.key === 'Enter' && handleRenameFolder()}
            autoFocus
          />
          <div className="flex justify-end gap-3 pt-4">
            <Button variant="ghost" onClick={() => setShowRenameFolderModal(false)} disabled={submitting}>
              Cancel
            </Button>
            <Button onClick={handleRenameFolder} disabled={!renameFolderText.trim() || submitting}>
              {submitting ? 'Renaming...' : 'Rename'}
            </Button>
          </div>
        </div>
      </Modal>

      {folderToShare && (
        <ShareWikiModal
          isOpen={showShareWikiModal}
          onClose={() => {
            setShowShareWikiModal(false)
            setFolderToShare(null)
          }}
          folderId={folderToShare.id}
          folderName={folderToShare.name}
          folderOwnerId={folderToShare.owner_id || ''}
          onUpdate={loadFolders}
        />
      )}

      {docToShare && selectedFolder && (
        <ShareDocumentModal
          isOpen={showShareDocModal}
          onClose={() => {
            setShowShareDocModal(false)
            setDocToShare(null)
          }}
          documentId={docToShare.id}
          documentTitle={docToShare.title}
          documentOwnerId={docToShare.owner_id || ''}
          onUpdate={() => {
            if (selectedFolder) {
              loadDocuments(selectedFolder.id)
            }
          }}
        />
      )}
    </div>
  )
}

interface SortableFolderItemProps {
  folder: WikiFolder
  isExpanded: boolean
  isSelected: boolean
  documents: WikiDocument[]
  selectedDocId?: string
  isDragTarget?: boolean
  onToggle: () => void
  onSelectFolder: () => void
  onSelectDoc: (doc: WikiDocument) => void
  onDocumentDragEnd: (event: DragEndEvent, folderId: string) => void
  onDocumentDragOver: (event: DragOverEvent) => void
  onNewDocument: () => void
  onDocumentRename: (doc: WikiDocument) => void
  onDocumentMove: (doc: WikiDocument) => void
  onDocumentDelete: (doc: WikiDocument) => void
  onShare: () => void
  onRename: () => void
  onDelete: () => void
}

function SortableFolderItem({
  folder,
  isExpanded,
  isSelected,
  documents,
  selectedDocId,
  isDragTarget = false,
  onToggle,
  onSelectFolder,
  onSelectDoc,
  onDocumentDragEnd,
  onDocumentDragOver,
  onNewDocument,
  onDocumentRename,
  onDocumentMove,
  onDocumentDelete,
  onShare,
  onRename,
  onDelete
}: SortableFolderItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ 
    id: folder.id,
    data: { type: 'folder', folderId: folder.id }
  })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  const [showMenu, setShowMenu] = useState(false)

  // Always call hooks unconditionally - move sensors to top level
  const documentSensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  )

  return (
    <div ref={setNodeRef} style={style} className="mb-1">
      <div
        {...attributes}
        {...listeners}
        className={`group flex items-center gap-2 px-3 py-2 rounded-lg cursor-grab active:cursor-grabbing transition-colors ${
          isSelected
            ? 'bg-[hsl(var(--color-primary))] text-white'
            : isDragTarget
            ? 'bg-blue-500/20 border-2 border-blue-500'
            : 'hover:bg-[hsl(var(--color-surface-hover))]'
        }`}
      >
        <button
          onClick={(e) => {
            e.stopPropagation()
            onToggle()
          }}
          className="flex-shrink-0"
        >
          <svg
            className={`w-4 h-4 transition-transform ${isExpanded ? 'rotate-90' : ''}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
        <span onClick={(e) => { e.stopPropagation(); onSelectFolder(); }} className="flex-1 truncate text-sm">
          {folder.name}
        </span>
        <div className="relative">
          <button
            onClick={(e) => {
              e.stopPropagation()
              setShowMenu(!showMenu)
            }}
            className="p-1 rounded hover:bg-[hsl(var(--color-surface-hover))] opacity-0 group-hover:opacity-100 transition-opacity"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
            </svg>
          </button>
          {showMenu && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setShowMenu(false)} />
              <div className="absolute right-0 mt-1 w-48 bg-[hsl(var(--color-surface))] border border-[hsl(var(--color-border))] rounded-lg shadow-lg z-20">
                <button
                  onClick={() => {
                    onShare()
                    setShowMenu(false)
                  }}
                  className="w-full px-4 py-2 text-left text-sm hover:bg-[hsl(var(--color-surface-hover))] flex items-center gap-2"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                  </svg>
                  Share
                </button>
                <button
                  onClick={() => {
                    onRename()
                    setShowMenu(false)
                  }}
                  className="w-full px-4 py-2 text-left text-sm hover:bg-[hsl(var(--color-surface-hover))] flex items-center gap-2"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                  </svg>
                  Rename
                </button>
                <button
                  onClick={() => {
                    onDelete()
                    setShowMenu(false)
                  }}
                  className="w-full px-4 py-2 text-left text-sm hover:bg-[hsl(var(--color-surface-hover))] text-red-500 flex items-center gap-2"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                  Delete
                </button>
              </div>
            </>
          )}
        </div>
      </div>
      {isExpanded && (
        <div className="ml-8 mt-1 space-y-1">
          {documents.length > 0 && (
            <DndContext
              sensors={documentSensors}
              collisionDetection={closestCenter}
              onDragEnd={(event) => onDocumentDragEnd(event, folder.id)}
              onDragOver={onDocumentDragOver}
            >
              <SortableContext items={[...documents.map(d => d.id), folder.id]} strategy={verticalListSortingStrategy}>
                {documents.map(doc => (
                  <SortableDocumentItem
                    key={doc.id}
                    document={doc}
                    isSelected={selectedDocId === doc.id}
                    onSelect={() => onSelectDoc(doc)}
                    onRename={() => onDocumentRename(doc)}
                    onMove={() => onDocumentMove(doc)}
                    onDelete={() => onDocumentDelete(doc)}
                  />
                ))}
              </SortableContext>
            </DndContext>
          )}
          <button
            onClick={onNewDocument}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-left text-sm transition-colors hover:bg-[hsl(var(--color-surface-hover))] text-[hsl(var(--color-text-secondary))]"
          >
            <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            <span>New Document</span>
          </button>
        </div>
      )}
    </div>
  )
}

interface SortableDocumentItemProps {
  document: WikiDocument
  isSelected: boolean
  onSelect: () => void
  onRename: () => void
  onMove: () => void
  onDelete: () => void
}

function SortableDocumentItem({ document, isSelected, onSelect, onRename, onMove, onDelete }: SortableDocumentItemProps) {
  const [showMenu, setShowMenu] = useState(false)
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ 
    id: document.id,
    data: { type: 'document', documentId: document.id }
  })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  const getDocumentIcon = () => {
    switch (document.document_type) {
      case 'table':
        return (
          <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M3 14h18m-9-4v8m-7 0h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
          </svg>
        )
      case 'whiteboard':
        return (
          <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 5a1 1 0 011-1h4a1 1 0 011 1v7a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM14 5a1 1 0 011-1h4a1 1 0 011 1v7a1 1 0 01-1 1h-4a1 1 0 01-1-1V5zM4 16a1 1 0 011-1h4a1 1 0 011 1v3a1 1 0 01-1 1H5a1 1 0 01-1-1v-3zM14 16a1 1 0 011-1h4a1 1 0 011 1v3a1 1 0 01-1 1h-4a1 1 0 01-1-1v-3z" />
          </svg>
        )
      default: // rich-text
        return (
          <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
        )
    }
  }

  return (
    <div ref={setNodeRef} style={style} className="group relative">
      <div className="flex items-center">
        <button
          {...attributes}
          {...listeners}
          onClick={(e) => {
            e.stopPropagation()
            onSelect()
          }}
          className={`flex-1 flex items-center gap-2 px-3 py-2 rounded-lg text-left text-sm cursor-grab active:cursor-grabbing transition-colors ${
            isSelected
              ? 'bg-[hsl(var(--color-primary))] text-white'
              : 'hover:bg-[hsl(var(--color-surface-hover))]'
          }`}
        >
          {getDocumentIcon()}
          <span className="truncate">{document.title}</span>
        </button>
        <div className="relative flex-shrink-0">
          <button
            onClick={(e) => {
              e.stopPropagation()
              setShowMenu(!showMenu)
            }}
            className="p-1 rounded hover:bg-[hsl(var(--color-surface-hover))] opacity-0 group-hover:opacity-100 transition-opacity"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
            </svg>
          </button>
          {showMenu && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setShowMenu(false)}></div>
              <div className="absolute right-0 top-8 z-20 bg-[hsl(var(--color-surface))] border border-[hsl(var(--color-border))] rounded-lg shadow-lg py-1 min-w-[150px]">
                <button
                  onClick={() => {
                    onRename()
                    setShowMenu(false)
                  }}
                  className="w-full px-4 py-2 text-left text-sm hover:bg-[hsl(var(--color-surface-hover))] flex items-center gap-2"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                  Rename
                </button>
                <button
                  onClick={() => {
                    onMove()
                    setShowMenu(false)
                  }}
                  className="w-full px-4 py-2 text-left text-sm hover:bg-[hsl(var(--color-surface-hover))] flex items-center gap-2"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                  </svg>
                  Move to...
                </button>
                <button
                  onClick={() => {
                    onDelete()
                    setShowMenu(false)
                  }}
                  className="w-full px-4 py-2 text-left text-sm hover:bg-[hsl(var(--color-surface-hover))] text-red-500 flex items-center gap-2"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                  Delete
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}