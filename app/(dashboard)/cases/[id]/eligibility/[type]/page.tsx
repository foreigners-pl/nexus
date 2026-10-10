'use client'

import { use, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useQueryClient } from '@tanstack/react-query'
import { usePaneBack } from '@/lib/panes'
import { useCaseHeaderCache, fetchCaseHeaderQuery, queryKeys } from '@/lib/query'
import { SubPageHeader } from '@/components/shared/SubPageHeader'
import { Button } from '@/components/ui/Button'
import { getCaseEligibilityDetail, toggleCaseEligibility, type ServiceEligibilityItem } from '@/app/actions/workflow'
import { ShieldCheck, FileCheck, Check } from 'lucide-react'

const TYPE_LABELS: Record<string, string> = {
  status: 'Status verification',
  documents: 'Mandatory documents',
}

const TYPE_ICONS: Record<string, typeof ShieldCheck> = {
  status: ShieldCheck,
  documents: FileCheck,
}

interface EligibilityDetailPageProps {
  params: Promise<{ id: string; type: string }>
}

export default function EligibilityDetailPage({ params }: EligibilityDetailPageProps) {
  const { id: urlId, type } = use(params)
  const router = useRouter()
  const paneBack = usePaneBack()
  const queryClient = useQueryClient()
  const { getCached: getCachedHeader } = useCaseHeaderCache(urlId)
  const isMounted = useRef(true)

  const [caseId, setCaseId] = useState<string | null>(null)
  const [clientId, setClientId] = useState<string | null>(null)
  const [caseCode, setCaseCode] = useState<string | null>(null)
  const [clientName, setClientName] = useState<string | null>(null)
  const [serviceName, setServiceName] = useState<string | null>(null)
  const [phone, setPhone] = useState<string | null>(null)

  const [items, setItems] = useState<ServiceEligibilityItem[]>([])
  const [completed, setCompleted] = useState(false)
  const [loading, setLoading] = useState(true)
  const [toggling, setToggling] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const validType = type === 'status' || type === 'documents' ? type : null

  useEffect(() => {
    isMounted.current = true

    const cachedHeader = getCachedHeader()
    if (cachedHeader?.caseId) {
      setCaseId(cachedHeader.caseId)
      setClientId(cachedHeader.clientId ?? null)
      setCaseCode(cachedHeader.caseCode)
      setClientName(cachedHeader.clientName || cachedHeader.title)
      setServiceName(cachedHeader.serviceName || null)
      setPhone(cachedHeader.phone || null)
    }

    ;(async () => {
      const header = await fetchCaseHeaderQuery(queryClient, urlId)
      if (!isMounted.current) return
      if ('error' in header) {
        setLoading(false)
        return
      }
      setCaseId(header.caseId)
      setClientId(header.clientId)
      setCaseCode(header.caseCode)
      setClientName(header.clientName || header.title)
      setServiceName(header.serviceName || null)
      setPhone(header.phone || null)

      if (!validType) {
        setLoading(false)
        return
      }
      const data = await getCaseEligibilityDetail(header.caseId, validType)
      if (!isMounted.current) return
      if (data.error) {
        setError(data.error)
      } else {
        setItems(data.items)
        setCompleted(data.completed)
      }
      setLoading(false)
    })()

    return () => { isMounted.current = false }
  }, [urlId, validType])

  const handleToggle = async () => {
    if (!caseId || !validType) return
    setToggling(true)
    const result = await toggleCaseEligibility(caseId, validType)
    setToggling(false)
    if (result.error) {
      setError(result.error)
      return
    }
    setCompleted(result.completed)
    queryClient.invalidateQueries({ queryKey: queryKeys.workflow(caseId) })
  }

  const handleBack = () => {
    if (paneBack) paneBack()
    else router.push(`/cases/${urlId}/progress`)
  }

  const Icon = validType ? TYPE_ICONS[validType] : ShieldCheck
  const title = validType ? TYPE_LABELS[validType] : 'Eligibility'

  if (!validType) {
    return <div className="flex items-center justify-center min-h-screen"><p>Invalid eligibility type</p></div>
  }

  if (loading) {
    return (
      <div className="flex justify-center py-16 text-[hsl(var(--color-text-secondary))]">
        <div className="w-6 h-6 border-2 border-current border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="max-w-3xl mx-auto pb-20">
      <SubPageHeader
        backHref={`/cases/${urlId}/progress`}
        title={serviceName || caseCode || 'Case'}
        subtitle={[clientName, phone].filter(Boolean).join(' · ')}
        icon={<Icon className="w-4 h-4 text-white" />}
        titleHref={clientId ? `/clients/${clientId}` : undefined}
        action={
          <Button variant="ghost" size="sm" onClick={handleBack}>
            Back
          </Button>
        }
      />

      <div className="space-y-4">
        {error && (
          <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
            {error}
          </div>
        )}

        <div className="rounded-xl border border-[hsl(var(--color-border))] bg-[hsl(var(--color-surface))] overflow-hidden">
          <div className="px-4 py-3 border-b border-[hsl(var(--color-border))] bg-[hsl(var(--color-surface-hover))]/30">
            <h2 className="text-sm font-semibold text-[hsl(var(--color-text-primary))]">{title}</h2>
            <p className="text-xs text-[hsl(var(--color-text-secondary))]">
              {items.length === 0 ? 'No items configured for this service yet.' : 'Review each item before marking complete.'}
            </p>
          </div>

          {items.length === 0 ? (
            <p className="text-sm text-[hsl(var(--color-text-secondary))] text-center py-8">Nothing to display.</p>
          ) : (
            <ul className="divide-y divide-[hsl(var(--color-border))]">
              {items.map(item => (
                <li key={item.id} className="px-4 py-3">
                  <p className="text-sm font-medium text-[hsl(var(--color-text-primary))]">{item.title}</p>
                  {item.description && (
                    <p className="text-xs text-[hsl(var(--color-text-secondary))] mt-1">{item.description}</p>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>

        <Button
          onClick={handleToggle}
          disabled={toggling}
          className={`w-full ${completed ? 'bg-red-600 hover:bg-red-700' : ''}`}
        >
          {completed ? (
            <>
              <Check className="w-4 h-4 mr-2" />
              Mark as not done
            </>
          ) : (
            <>
              <Check className="w-4 h-4 mr-2" />
              Mark as done
            </>
          )}
        </Button>
      </div>
    </div>
  )
}
