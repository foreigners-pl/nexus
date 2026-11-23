'use client'

import { use, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useQueryClient } from '@tanstack/react-query'
import { usePaneBack } from '@/lib/panes'
import { useCaseHeaderCache, fetchCaseHeaderQuery, queryKeys } from '@/lib/query'
import { SubPageHeader } from '@/components/shared/SubPageHeader'
import { Button } from '@/components/ui/Button'
import {
  getCaseEligibilityDetail,
  toggleAllCaseEligibility,
  type ServiceEligibilityItem,
} from '@/app/actions/workflow'
import { ShieldCheck, FileCheck, Check } from 'lucide-react'

interface Section {
  key: 'status' | 'documents'
  title: string
  icon: typeof ShieldCheck
  items: ServiceEligibilityItem[]
  completed: boolean
}

export default function EligibilityPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: urlId } = use(params)
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

  const [sections, setSections] = useState<Section[]>([
    { key: 'status', title: 'Status verification', icon: ShieldCheck, items: [], completed: false },
    { key: 'documents', title: 'Mandatory documents', icon: FileCheck, items: [], completed: false },
  ])
  const [loading, setLoading] = useState(true)
  const [toggling, setToggling] = useState(false)
  const [error, setError] = useState<string | null>(null)

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

      const [statusRes, docsRes] = await Promise.all([
        getCaseEligibilityDetail(header.caseId, 'status'),
        getCaseEligibilityDetail(header.caseId, 'documents'),
      ])
      if (!isMounted.current) return
      setSections([
        { key: 'status', title: 'Status verification', icon: ShieldCheck, items: statusRes.items, completed: statusRes.completed },
        { key: 'documents', title: 'Mandatory documents', icon: FileCheck, items: docsRes.items, completed: docsRes.completed },
      ])
      setLoading(false)
    })()

    return () => { isMounted.current = false }
  }, [urlId])

  const confirmed = sections.every(s => s.completed)

  const handleToggle = async () => {
    if (!caseId) return
    setToggling(true)
    setError(null)
    const result = await toggleAllCaseEligibility(caseId)
    setToggling(false)
    if (result.error) {
      setError(result.error)
      return
    }
    setSections(prev => prev.map(s => ({ ...s, completed: result.completed })))
    queryClient.invalidateQueries({ queryKey: queryKeys.workflow(caseId) })
  }

  const handleBack = () => {
    if (paneBack) paneBack()
    else router.push(`/cases/${urlId}/progress`)
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
        icon={<ShieldCheck className="w-4 h-4 text-white" />}
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

        {sections.map(section => {
          const Icon = section.icon
          return (
            <div
              key={section.key}
              className="rounded-xl border border-[hsl(var(--color-border))] bg-[hsl(var(--color-surface))] overflow-hidden"
            >
              <div className="px-4 py-3 border-b border-[hsl(var(--color-border))] bg-[hsl(var(--color-surface-hover))]/30 flex items-center gap-2">
                <Icon className={`w-4 h-4 shrink-0 ${section.completed ? 'text-green-500' : 'text-[hsl(var(--color-text-secondary))]'}`} />
                <h2 className="text-sm font-semibold text-[hsl(var(--color-text-primary))] flex-1">{section.title}</h2>
                {section.completed && (
                  <span className="text-xs font-medium text-green-400">Done</span>
                )}
              </div>
              {section.items.length === 0 ? (
                <p className="text-sm text-[hsl(var(--color-text-secondary))] text-center py-6">
                  Nothing configured for this service yet.
                </p>
              ) : (
                <ul className="divide-y divide-[hsl(var(--color-border))]">
                  {section.items.map(item => (
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
          )
        })}

        <Button
          onClick={handleToggle}
          disabled={toggling}
          variant={confirmed ? 'danger' : 'primary'}
          className="w-full"
        >
          <Check className="w-4 h-4 mr-2" />
          {confirmed ? 'Unconfirm eligibility' : 'Confirm eligibility'}
        </Button>
      </div>
    </div>
  )
}
