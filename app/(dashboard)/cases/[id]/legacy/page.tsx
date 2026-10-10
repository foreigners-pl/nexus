'use client'

import { use, useEffect, useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { queryKeys, useCaseHeaderCache, fetchCaseHeaderQuery, fetchCommentsQuery } from '@/lib/query'
import { SubPageHeader } from '@/components/shared/SubPageHeader'
import { CommentsSection } from '../components/CommentsSection'
import { Loader2, MessageSquareText } from 'lucide-react'
import type { Comment } from '@/types/database'

interface LegacyPageProps {
  params: Promise<{ id: string }>
}

export default function CaseLegacyPage({ params }: LegacyPageProps) {
  const { id: urlId } = use(params)
  const [caseData, setCaseData] = useState<{ id: string; client_id?: string | null; case_code?: string } | null>(null)
  const [caseCode, setCaseCode] = useState<string | null>(null)
  const [clientName, setClientName] = useState<string | null>(null)
  const [serviceName, setServiceName] = useState<string | null>(null)
  const [phone, setPhone] = useState<string | null>(null)
  const [headerSub, setHeaderSub] = useState('')
  const [comments, setComments] = useState<Comment[]>([])
  const [loading, setLoading] = useState(true)
  const isMounted = useRef(true)
  const queryClient = useQueryClient()
  const { getCached: getCachedHeader } = useCaseHeaderCache(urlId)

  const applyData = (commentsData: Comment[]) => {
    setComments(commentsData)
  }

  useEffect(() => {
    isMounted.current = true

    const cachedComments = queryClient.getQueryData<Comment[]>(queryKeys.comments(urlId))
    const cachedHeader = getCachedHeader()
    if (cachedHeader?.caseId) {
      setCaseData({ id: cachedHeader.caseId, client_id: cachedHeader.clientId })
      setCaseCode(cachedHeader.caseCode)
      setClientName(cachedHeader.clientName || cachedHeader.title)
      setServiceName(cachedHeader.serviceName || null)
      setPhone(cachedHeader.phone || null)
      setHeaderSub(cachedHeader.subtitle)
    }
    if (cachedComments) {
      applyData(cachedComments)
      setLoading(false)
      load() // background refresh
    } else {
      load()
    }

    return () => { isMounted.current = false }
  }, [urlId])

  const load = async () => {
    const header = await fetchCaseHeaderQuery(queryClient, urlId)
    if (!isMounted.current) return
    if ('error' in header) { setLoading(false); return }
    setCaseData({ id: header.caseId, client_id: header.clientId, case_code: header.caseCode })
    setCaseCode(header.caseCode)
    setClientName(header.clientName || header.title)
    setServiceName(header.serviceName || null)
    setPhone(header.phone || null)
    setHeaderSub(header.subtitle)

    const commentsData = await fetchCommentsQuery(queryClient, header.caseId)
    if (!isMounted.current) return
    applyData(commentsData)
    setLoading(false)
  }

  const reloadComments = async () => {
    if (!caseData) return
    const commentsData = await fetchCommentsQuery(queryClient, caseData.id)
    if (!isMounted.current) return
    applyData(commentsData)
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
      <SubPageHeader
        backHref={`/cases/${urlId}`}
        title={serviceName || caseCode || caseData.case_code || 'Case'}
        subtitle={[clientName, phone].filter(Boolean).join(' · ')}
        icon={<MessageSquareText className="w-4 h-4 text-white" />}
        titleHref={caseData.client_id ? `/clients/${caseData.client_id}` : undefined}
      />

      <div className="rounded-xl border border-[hsl(var(--color-border))] bg-[hsl(var(--color-surface))] p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-semibold text-[hsl(var(--color-text-primary))]">Legacy notes</h3>
          <span className="text-xs text-[hsl(var(--color-text-muted))]">{comments.length} note{comments.length === 1 ? '' : 's'}</span>
        </div>
        <CommentsSection caseId={caseData.id} comments={comments} onUpdate={reloadComments} currentUserId={undefined} readOnly />
      </div>
    </div>
  )
}
