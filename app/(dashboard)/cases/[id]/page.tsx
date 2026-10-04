'use client'

import { useState, useEffect, useRef, use } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle, Modal } from '@/components/ui'
import { Button } from '@/components/ui/Button'
import { createClient } from '@/lib/supabase/client'
import { deleteCase, getCasePageData } from '@/app/actions/cases'
import { usePaneBack } from '@/lib/panes'
import { useQueryClient } from '@tanstack/react-query'
import { useCasePageCache, fetchCasePageQuery, queryKeys } from '@/lib/query'
import { CaseHeader } from './components/CaseHeader'
import { AssignedPeople } from './components/AssignedPeople'
import { CaseSubNav } from './components/CaseSubNav'
import { DangerZone } from '@/components/shared/DangerZone'
import type { Case, Client, ContactNumber } from '@/types/database'

interface CasePageProps {
  params: Promise<{ id: string }>
}

export default function CasePage({ params }: CasePageProps) {
  // Use React 19's use() to synchronously unwrap the params Promise
  const { id: urlId } = use(params)
  
  const [caseData, setCaseData] = useState<Case | null>(null)
  const [client, setClient] = useState<Client | null>(null)
  const [clientPhoneNumbers, setClientPhoneNumbers] = useState<ContactNumber[]>([])
  const [serviceName, setServiceName] = useState('')
  const [currentStepName, setCurrentStepName] = useState('')
  const [paidAmount, setPaidAmount] = useState(0)
  const [fileCount, setFileCount] = useState(0)
  const [commentsCount, setCommentsCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const router = useRouter()
  const paneBack = usePaneBack()
  const supabase = createClient()
  const isMounted = useRef(true)
  const queryClient = useQueryClient()
  const { getCached: getCachedCase } = useCasePageCache(urlId)

  useEffect(() => {
    isMounted.current = true

    const cached = getCachedCase()
    if (cached?.case) {
      applyData(cached)
      setLoading(false)
      fetchCaseData(urlId, false) // background refresh
    } else {
      fetchCaseData(urlId, true)
    }

    return () => {
      isMounted.current = false
    }
  }, [urlId])

  function applyData(data: NonNullable<Awaited<ReturnType<typeof getCasePageData>>>) {
    if (!('case' in data) || !data.case) return
    setCaseData(data.case as Case)
    setClient((data.client as Client | null) || null)
    setClientPhoneNumbers((data.phones as ContactNumber[]) || [])
    setServiceName(data.serviceName || '')
    setCurrentStepName(data.currentStepName || '')
    setPaidAmount(data.paidAmount || 0)
    setFileCount(data.fileCount || 0)
    setCommentsCount(data.commentsCount || 0)
  }

  async function fetchCaseData(caseIdParam: string, showLoading = true) {
    if (!caseIdParam) return
    if (showLoading) setLoading(true)

    // fetchQuery joins an in-flight row-hover prefetch instead of duplicating it
    const data = await fetchCasePageQuery(queryClient, caseIdParam)
    if (!isMounted.current) return

    if ('error' in data || !('case' in data) || !data.case) {
      console.error('Error fetching case')
      setLoading(false)
      return
    }

    applyData(data)
    setLoading(false)
  }

  // Optimistic update handlers - only refetch what changed
  const invalidateCaseCache = () => {
    if (!caseData) return
    queryClient.invalidateQueries({ queryKey: queryKeys.case(urlId) })
    queryClient.invalidateQueries({ queryKey: queryKeys.case(caseData.id) })
    if (caseData.case_code) queryClient.invalidateQueries({ queryKey: queryKeys.case(caseData.case_code) })
  }

  const handleCaseUpdate = async () => {
    if (!caseData) return
    const { data: updatedCase } = await supabase
      .from('cases')
      .select('*')
      .eq('id', caseData.id)
      .single()
    if (updatedCase) setCaseData(updatedCase)
    invalidateCaseCache()
  }

  const handleDelete = async () => {
    if (!caseData) return
    setSubmitting(true)
    const result = await deleteCase(caseData.id)
    if (!result?.error) {
      // Let an open client pane/page underneath drop the case from its list
      if (caseData.client_id) {
        window.dispatchEvent(new CustomEvent('nexus:client-data-changed', { detail: { clientId: caseData.client_id } }))
      }
      const clientHref = client ? `/clients/${client.client_code || client.id}` : '/cases'
      if (paneBack) paneBack()
      else router.push(clientHref)
    } else {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-24 rounded-xl bg-[hsl(var(--color-surface-hover))]" />
        <div className="space-y-1.5">
          <div className="h-6 w-48 rounded-lg bg-[hsl(var(--color-surface-hover))]" />
          <div className="h-4 w-64 rounded-lg bg-[hsl(var(--color-surface-hover))]" />
        </div>
        <div className="space-y-2">
          {[0, 1, 2].map(i => (
            <div key={i} className="h-14 rounded-xl bg-[hsl(var(--color-surface-hover))]" />
          ))}
        </div>
        <div className="h-40 rounded-xl bg-[hsl(var(--color-surface-hover))]" />
      </div>
    )
  }
  if (!caseData) return <div className="flex items-center justify-center min-h-screen"><p>Case not found</p></div>

  return (
    <div className="space-y-6">
      <CaseHeader caseData={caseData} client={client} clientPhoneNumbers={clientPhoneNumbers} serviceName={serviceName} />

      <Modal isOpen={isDeleteModalOpen} onClose={() => setIsDeleteModalOpen(false)} title="Delete Case">
        <div className="space-y-4">
          <p>Are you sure you want to delete this case? This action cannot be undone.</p>
          <div className="flex justify-end gap-3">
            <Button variant="ghost" onClick={() => setIsDeleteModalOpen(false)} disabled={submitting}>Cancel</Button>
            <Button onClick={handleDelete} disabled={submitting} className="bg-red-500 hover:bg-red-600 text-white">{submitting ? 'Deleting...' : 'Delete Case'}</Button>
          </div>
        </div>
      </Modal>
      {/* Assigned reps */}
      <AssignedPeople caseData={caseData} onUpdate={handleCaseUpdate} />

      {/* Process / Billing / Files */}
      <CaseSubNav
        caseId={caseData.id}
        processInfo={currentStepName ? `Current: ${currentStepName}` : undefined}
        billingInfo={`${paidAmount.toFixed(2)} PLN paid`}
        filesInfo={fileCount === 0 ? 'No files' : `${fileCount} file${fileCount === 1 ? '' : 's'}`}
        legacyInfo={commentsCount > 0 ? `${commentsCount} old note${commentsCount === 1 ? '' : 's'}` : undefined}
      />

      <DangerZone
        title="Danger zone"
        buttonText="Delete Case"
        onDelete={() => setIsDeleteModalOpen(true)}
        disabled={submitting}
      />
    </div>
  )
}
