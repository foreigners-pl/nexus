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
import { getComments } from '@/app/actions/comments'
import { CaseHeader } from './components/CaseHeader'
import { AssignedPeople } from './components/AssignedPeople'
import { CaseSubNav } from './components/CaseSubNav'
import { CommentsSection } from './components/CommentsSection'
import type { Case, Client, Comment, ContactNumber } from '@/types/database'

interface CasePageProps {
  params: Promise<{ id: string }>
}

export default function CasePage({ params }: CasePageProps) {
  // Use React 19's use() to synchronously unwrap the params Promise
  const { id: urlId } = use(params)
  
  const [caseData, setCaseData] = useState<Case | null>(null)
  const [client, setClient] = useState<Client | null>(null)
  const [clientPhoneNumbers, setClientPhoneNumbers] = useState<ContactNumber[]>([])
  const [comments, setComments] = useState<Comment[]>([])
  const [serviceName, setServiceName] = useState('')
  const [currentStepName, setCurrentStepName] = useState('')
  const [paidAmount, setPaidAmount] = useState(0)
  const [fileCount, setFileCount] = useState(0)
  const [currentUserId, setCurrentUserId] = useState<string | undefined>(undefined)
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
    setComments((data.comments as Comment[]) || [])
    setCurrentUserId(data.currentUserId)
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

  const handleCommentsUpdate = async () => {
    if (!caseData) return
    const commentsData = await getComments(caseData.id)
    setComments(commentsData)
    invalidateCaseCache()
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
      <CaseHeader caseData={caseData} client={client} clientPhoneNumbers={clientPhoneNumbers} serviceName={serviceName} onDelete={() => setIsDeleteModalOpen(true)} />

      {/* Page title */}
      <div>
        <h2 className="text-xl font-bold text-[hsl(var(--color-text-primary))]">
          {serviceName || caseData.case_code || 'Case'}
        </h2>
        <p className="text-sm text-[hsl(var(--color-text-secondary))] mt-0.5">
          {[
            client ? [client.first_name, client.last_name].filter(Boolean).join(' ') || client.contact_email : null,
            clientPhoneNumbers.length > 0 ? `${clientPhoneNumbers[0].country_code || ''} ${clientPhoneNumbers[0].number}`.trim() : null,
            caseData.case_code,
          ].filter(Boolean).join(' · ') || '—'}
        </p>
      </div>

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
      />

      {/* Comments */}
      <Card className="backdrop-blur-xl bg-[hsl(var(--color-surface))]/80 border-[hsl(var(--color-border))] shadow-[0_8px_32px_rgb(0_0_0/0.25)]">
        <CardHeader>
          <CardTitle>Comments</CardTitle>
        </CardHeader>
        <CardContent>
          <CommentsSection 
            caseId={caseData.id} 
            comments={comments} 
            onUpdate={handleCommentsUpdate}
            currentUserId={currentUserId}
          />
        </CardContent>
      </Card>

      {/* Mobile Delete Button - shows at bottom on mobile only */}
      <div className="sm:hidden pb-20">
        <Button 
          variant="ghost"
          onClick={() => setIsDeleteModalOpen(true)}
          className="w-full text-red-400 hover:text-red-300 hover:bg-red-500/10 border border-red-500/20"
        >
          <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
          Delete Case
        </Button>
      </div>
    </div>
  )
}
