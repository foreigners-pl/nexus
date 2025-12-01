'use client'

import { WikiDocument } from '@/types/database'
import { RichTextEditor } from './RichTextEditor'
import { TableEditor } from './TableEditor'
import { WhiteboardEditor } from './WhiteboardEditor'

interface DocumentViewerProps {
  document: WikiDocument
  canEdit: boolean
  onUpdate: () => void
}

export function DocumentViewer({ document, canEdit, onUpdate }: DocumentViewerProps) {
  const documentType = document.document_type || 'rich-text'

  switch (documentType) {
    case 'table':
      return <TableEditor document={document} canEdit={canEdit} onUpdate={onUpdate} />
    case 'whiteboard':
      return <WhiteboardEditor document={document} canEdit={canEdit} onUpdate={onUpdate} />
    case 'rich-text':
    default:
      return <RichTextEditor document={document} canEdit={canEdit} onUpdate={onUpdate} />
  }
}
