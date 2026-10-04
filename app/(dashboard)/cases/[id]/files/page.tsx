'use client'

import { use, useEffect, useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { queryKeys } from '@/lib/query'
import { getAttachments } from '@/app/actions/attachments'
import { getCaseHeaderData } from '@/app/actions/cases'
import { useCaseHeaderCache } from '@/lib/query'
import { SubPageHeader } from '@/components/shared/SubPageHeader'
import { AttachmentsSection } from '../components/AttachmentsSection'
import { Button } from '@/components/ui/Button'
import { Loader2, FolderOpen } from 'lucide-react'
import type { CaseAttachment } from '@/types/database'

interface FilesPageProps {
  params: Promise<{ id: string }>
}

export default function CaseFilesPage({ params }: FilesPageProps) {
  const { id: urlId } = use(params)
  const [caseData, setCaseData] = useState<any>(null)
  const [clientName, setClientName] = useState<string | null>(null)
  const [headerSub, setHeaderSub] = useState('')
  const [attachments, setAttachments] = useState<CaseAttachment[]>([])
  const [loading, setLoading] = useState(true)
  const isMounted = useRef(true)
  const queryClient = useQueryClient()
  const { getCached: getCachedHeader, setCached: setCachedHeader } = useCaseHeaderCache(urlId)

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

      const header = await getCaseHeaderData(urlId)
      if (!isMounted.current) return
      if ('error' in header) { setLoading(false); return }
      setCaseData({ id: header.caseId, client_id: header.clientId, case_code: urlId.startsWith('C') ? urlId : undefined })
      setClientName(header.title)
      setHeaderSub(header.subtitle)
      setCachedHeader(header)

      const cachedAtts = queryClient.getQueryData<CaseAttachment[]>(queryKeys.attachments(header.caseId))
      if (cachedAtts) {
        setAttachments(cachedAtts)
        setLoading(false)
      }
      const atts = await getAttachments(header.caseId)
      if (!isMounted.current) return
      setAttachments(atts)
      queryClient.setQueryData(queryKeys.attachments(header.caseId), atts)
      setLoading(false)
    })()
    return () => { isMounted.current = false }
  }, [urlId])

  const reloadAttachments = async () => {
    if (!caseData) return
    const atts = await getAttachments(caseData.id)
    setAttachments(atts)
    queryClient.setQueryData(queryKeys.attachments(caseData.id), atts)
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
    </div>
  )
}
