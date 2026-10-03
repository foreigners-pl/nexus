'use client'

import { useState, useEffect, useRef, use } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle, Modal } from '@/components/ui'
import { Button } from '@/components/ui/Button'
import { createClient } from '@/lib/supabase/client'
import { deleteCase } from '@/app/actions/cases'
import { usePaneBack } from '@/lib/panes'
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

  useEffect(() => {
    isMounted.current = true
    fetchCaseData(urlId)
    
    return () => {
      isMounted.current = false
    }
  }, [urlId])

  async function fetchCaseData(caseIdParam: string) {
    if (!caseIdParam) return
    setLoading(true)

    // Get current user (local session - no network call)
    const { data: { session } } = await supabase.auth.getSession()
    if (!isMounted.current) return
    if (session?.user) setCurrentUserId(session.user.id)

    let caseResult, caseError
    
    if (caseIdParam.startsWith('C')) {
      const result = await supabase.from('cases').select('*').eq('case_code', caseIdParam).single()
      caseResult = result.data
      caseError = result.error
    } else {
      const result = await supabase.from('cases').select('*').eq('id', caseIdParam).single()
      caseResult = result.data
      caseError = result.error
    }

    if (!isMounted.current) return
    
    if (caseError || !caseResult) {
      console.error('Error fetching case:', caseError)
      setLoading(false)
      return
    }

    setCaseData(caseResult)

    if (caseResult.client_id) {
      const { data: clientData } = await supabase.from('clients').select('*').eq('id', caseResult.client_id).single()
      if (!isMounted.current) return
      if (clientData) setClient(clientData)
      
      // Fetch client phone numbers
      const { data: phonesData } = await supabase
        .from('contact_numbers')
        .select('*')
        .eq('client_id', caseResult.client_id)
        .order('number')
      if (!isMounted.current) return
      if (phonesData) setClientPhoneNumbers(phonesData)
    }

    // Summaries for the header + Process / Billing / Files buttons
    const [serviceRes, stepRes, installmentsRes, attachmentsRes] = await Promise.all([
      supabase.from('case_services').select('services(name)').eq('case_id', caseResult.id).limit(1).maybeSingle(),
      caseResult.current_step_id
        ? supabase.from('case_steps').select('name').eq('id', caseResult.current_step_id).maybeSingle()
        : Promise.resolve({ data: null }),
      supabase.from('installments').select('amount, paid, parent_installment_id').eq('case_id', caseResult.id),
      supabase.from('case_attachments').select('id', { count: 'exact', head: true }).eq('case_id', caseResult.id),
    ])
    if (!isMounted.current) return
    const svc = (serviceRes.data?.services as { name?: string } | null)?.name
    if (svc) setServiceName(svc)
    if (stepRes.data) setCurrentStepName((stepRes.data as { name: string }).name)
    const inst = (installmentsRes.data || []) as { amount: number; paid: boolean; parent_installment_id?: string }[]
    setPaidAmount(inst.filter(i => i.paid && !i.parent_installment_id).reduce((sum, i) => sum + (i.amount || 0), 0))
    setFileCount(attachmentsRes.count || 0)

    const commentsData = await getComments(caseResult.id)
    if (!isMounted.current) return
    setComments(commentsData)

    setLoading(false)
  }

  // Optimistic update handlers - only refetch what changed
  const handleCommentsUpdate = async () => {
    if (!caseData) return
    const commentsData = await getComments(caseData.id)
    setComments(commentsData)
  }

  const handleCaseUpdate = async () => {
    if (!caseData) return
    const { data: updatedCase } = await supabase
      .from('cases')
      .select('*')
      .eq('id', caseData.id)
      .single()
    if (updatedCase) setCaseData(updatedCase)
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

  if (loading) return <div className="flex items-center justify-center min-h-screen"><p>Loading...</p></div>
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
