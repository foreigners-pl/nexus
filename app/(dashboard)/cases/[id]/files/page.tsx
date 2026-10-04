'use client'

import { use, useEffect, useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { queryKeys } from '@/lib/query'
import { fetchAttachments, fetchComments } from '@/lib/data'
import { useCaseHeaderCache, fetchCaseHeaderQuery, fetchAttachmentsQuery } from '@/lib/query'
import { SubPageHeader } from '@/components/shared/SubPageHeader'
import { AttachmentsSection } from '../components/AttachmentsSection'
import { CommentsSection } from '../components/CommentsSection'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui'
import { Loader2, FolderOpen, MessageSquareText } from 'lucide-react'
import type { CaseAttachment, Comment } from '@/types/database'

interface FilesPageProps {
  params: Promise<{ id: string }>
}

export default function CaseFilesPage({ params }: FilesPageProps) {
  const { id: urlId } = use(params)
  const [caseData, setCaseData] = useState<any>(null)
  const [clientName, setClientName] = useState<string | null>(null)
  const [headerSub, setHeaderSub] = useState('')
  const [attachments, setAttachments] = useState<CaseAttachment[]>([])
  const [comments, setComments] = useState<Comment[]>([])
  const [legacyOpen, setLegacyOpen] = useState(false)
  const [loading, setLoading] = useState(true)
  const isMounted = useRef(true)
  const queryClient = useQueryClient()
  const { getCached: getCachedHeader } = useCaseHeaderCache(urlId)

  useEffect(() => {
    isMounted.current = true
    ;(async () => {
      const cachedHeader = getCachedHeader()
      if (cachedHeader?.caseId) {
        setCaseData({ id: cachedHeader.caseId, client_id: cachedHeader.clientId })
        setClientName(cachedHeader.title)
        setHeaderSub(cachedHeader.subtitle)
        const cachedAtts = queryClient.getQueryData<CaseAttachment[]>(queryKeys.attachments(cachedHeader.caseId))
        if (cachedAtts) {
          setAttachments(cachedAtts)
          setLoading(false)
        }
      }

      const header = await fetchCaseHeaderQuery(queryClient, urlId)
      if (!isMounted.current) return
      if ('error' in header) { setLoading(false); return }
      setCaseData({ id: header.caseId, client_id: header.clientId, case_code: urlId.startsWith('C') ? urlId : undefined })
      setClientName(header.title)
      setHeaderSub(header.subtitle)

      const cachedAtts = queryClient.getQueryData<CaseAttachment[]>(queryKeys.attachments(header.caseId))
      if (cachedAtts) {
        setAttachments(cachedAtts)
        setLoading(false)
      }
      const atts = await fetchAttachmentsQuery(queryClient, header.caseId)
      if (!isMounted.current) return
      setAttachments(atts)

      // Load legacy comments in the background so the Legacy card appears
      // once available, without blocking the file list.
      fetchComments(header.caseId).then(commentsData => {
        if (!isMounted.current) return
        setComments(commentsData)
      })

      setLoading(false)
    })()
    return () => { isMounted.current = false }
  }, [urlId])

  const reloadAttachments = async () => {
    if (!caseData) return
    const atts = await fetchAttachments(caseData.id)
    setAttachments(atts)
    queryClient.setQueryData(queryKeys.attachments(caseData.id), atts)
  }

  const reloadComments = async () => {
    if (!caseData) return
    const commentsData = await fetchComments(caseData.id)
    setComments(commentsData)
  }

  if (loading) {
    return (
      <div className="flex justify-center py-16 text-[hsl(var(--color-text-secondary))]">
        <Loader2 className="w-6 h-6 animate-spin" />
      </div>
    )
  }
  if (!caseData) return <div className="flex items-center justify-center min-h-screen"><p>Case not found</p></div>

  return (
    <div className="max-w-3xl mx-auto pb-20">
      <SubPageHeader backHref={`/cases/${urlId}`} title={clientName || caseData.case_code || 'Case'} subtitle={headerSub} icon={<FolderOpen className="w-4 h-4 text-white" />} titleHref={caseData.client_id ? `/clients/${caseData.client_id}` : undefined} />

      <div className="rounded-xl border border-[hsl(var(--color-border))] bg-[hsl(var(--color-surface))] p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-semibold text-[hsl(var(--color-text-primary))]">Attachments</h3>
          <Button
            size="sm"
            onClick={() => {
              const input = document.getElementById('attachment-file-input') as HTMLInputElement
              input?.click()
            }}
          >
            Add Attachment
          </Button>
        </div>
        <AttachmentsSection caseId={caseData.id} attachments={attachments} onUpdate={reloadAttachments} />
      </div>

      {comments.length > 0 && (
        <div className="rounded-xl border border-[hsl(var(--color-border))] bg-[hsl(var(--color-surface))] p-5">
          <button
            type="button"
            onClick={() => setLegacyOpen(true)}
            className="w-full flex items-center gap-4 text-left group"
          >
            <div className="w-10 h-10 rounded-full bg-[hsl(var(--color-surface-hover))] flex items-center justify-center shrink-0 text-[hsl(var(--color-text-muted))] group-hover:text-[hsl(var(--color-text-secondary))] transition-colors">
              <MessageSquareText className="w-5 h-5" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-[hsl(var(--color-text-primary))]">Legacy</p>
              <p className="text-xs text-[hsl(var(--color-text-muted))]">Old notes</p>
            </div>
            <span className="text-xs text-[hsl(var(--color-text-muted))] bg-[hsl(var(--color-surface-hover))] px-2 py-1 rounded-full">
              {comments.length}
            </span>
          </button>
        </div>
      )}

      <Modal isOpen={legacyOpen} onClose={() => setLegacyOpen(false)} title="Legacy notes">
        <CommentsSection caseId={caseData.id} comments={comments} onUpdate={reloadComments} currentUserId={undefined} />
      </Modal>
    </div>
  )
}
