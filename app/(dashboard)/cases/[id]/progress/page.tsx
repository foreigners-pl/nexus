'use client'

import { use, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { StepsPanel } from '../components/StepsPanel'
import { getEntryIdForQuery } from '@/app/actions/workflow'
import { getCaseHeaderData } from '@/app/actions/cases'
import { useCaseHeaderCache } from '@/lib/query'
import { SubPageHeader } from '@/components/shared/SubPageHeader'
import { Loader2, ListChecks } from 'lucide-react'

interface ProgressPageProps {
  params: Promise<{ id: string }>
  searchParams: Promise<{ q?: string; e?: string }>
}

export default function CaseProgressPage({ params, searchParams }: ProgressPageProps) {
  const { id: urlId } = use(params)
  const { q: focusQueryId, e: focusEntryId } = use(searchParams)
  const router = useRouter()
  const [caseId, setCaseId] = useState<string | null>(null)
  const [clientId, setClientId] = useState<string | null>(null)
  const [title, setTitle] = useState('')
  const [subtitle, setSubtitle] = useState('')
  const [loading, setLoading] = useState(true)
  const [redirecting, setRedirecting] = useState(!!(focusQueryId || focusEntryId))
  const isMounted = useRef(true)
  const { getCached: getCachedHeader, setCached: setCachedHeader } = useCaseHeaderCache(urlId)

  // Legacy deep links (?e=entry / ?q=query) → straight to the entry page
  useEffect(() => {
    if (focusEntryId) {
      router.replace(`/cases/${urlId}/progress/${focusEntryId}`)
      return
    }
    if (focusQueryId) {
      getEntryIdForQuery(focusQueryId).then(entryId => {
        if (entryId) {
          router.replace(`/cases/${urlId}/progress/${entryId}`)
        } else if (isMounted.current) {
          setRedirecting(false)
        }
      })
    }
  }, [focusEntryId, focusQueryId, urlId, router])

  useEffect(() => {
    if (redirecting) return
    isMounted.current = true

    const cached = getCachedHeader()
    if (cached?.caseId) {
      setCaseId(cached.caseId)
      setClientId(cached.clientId ?? null)
      setTitle(cached.title)
      setSubtitle(cached.subtitle)
      setLoading(false)
    }

    ;(async () => {
      const data = await getCaseHeaderData(urlId)
      if (!isMounted.current) return
      if ('error' in data) {
        setLoading(false)
        return
      }
      setCaseId(data.caseId)
      setClientId(data.clientId)
      setTitle(data.title)
      setSubtitle(data.subtitle)
      setCachedHeader(data)
      setLoading(false)
    })()
    return () => { isMounted.current = false }
  }, [urlId, redirecting])

  if (redirecting || loading) {
    return (
      <div className="flex justify-center py-16 text-[hsl(var(--color-text-secondary))]">
        <Loader2 className="w-6 h-6 animate-spin" />
      </div>
    )
  }

  if (!caseId) {
    return <div className="flex items-center justify-center min-h-screen"><p>Case not found</p></div>
  }

  return (
    <div className="max-w-3xl mx-auto pb-20">
      <SubPageHeader backHref={`/cases/${urlId}`} title={title} subtitle={subtitle} icon={<ListChecks className="w-4 h-4 text-white" />} titleHref={clientId ? `/clients/${clientId}` : undefined} />
      <StepsPanel caseId={caseId} />
    </div>
  )
}
