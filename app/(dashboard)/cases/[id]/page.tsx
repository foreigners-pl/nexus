'use client'

import { useState, useEffect, useRef, use } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle, Modal } from '@/components/ui'
import { Button } from '@/components/ui/Button'
import { createClient } from '@/lib/supabase/client'
import { deleteCase } from '@/app/actions/cases'
import { getAttachments } from '@/app/actions/attachments'
import { getComments } from '@/app/actions/comments'
import { CaseHeader } from './components/CaseHeader'
import { CaseInfo } from './components/CaseInfo'
import { ServicesSection } from './components/ServicesSection'
import { PaymentPanel } from './components/PaymentPanel'
import { AttachmentsSection } from './components/AttachmentsSection'
import { CommentsSection } from './components/CommentsSection'
import type { Case, Client, Status, Installment, CaseAttachment, Comment } from '@/types/database'

interface CasePageProps {
  params: Promise<{ id: string }>
}

export default function CasePage({ params }: CasePageProps) {
  // Use React 19's use() to synchronously unwrap the params Promise
  const { id: urlId } = use(params)
  
  const [caseData, setCaseData] = useState<Case | null>(null)
  const [client, setClient] = useState<Client | null>(null)
  const [status, setStatus] = useState<Status | null>(null)
  const [assignees, setAssignees] = useState<any[]>([])
  const [caseServices, setCaseServices] = useState<any[]>([])
  const [installments, setInstallments] = useState<Installment[]>([])
  const [attachments, setAttachments] = useState<CaseAttachment[]>([])
  const [comments, setComments] = useState<Comment[]>([])
  const [currentUserId, setCurrentUserId] = useState<string | undefined>(undefined)
  const [loading, setLoading] = useState(true)
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const router = useRouter()
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

    // Get current user
    const { data: { user } } = await supabase.auth.getUser()
    if (!isMounted.current) return
    if (user) setCurrentUserId(user.id)

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
    }

    if (caseResult.status_id) {
      const { data: statusData } = await supabase.from('status').select('*').eq('id', caseResult.status_id).single()
      if (!isMounted.current) return
      if (statusData) setStatus(statusData)
    }

    const { data: assigneesData } = await supabase.from('case_assignees').select('*, users(*)').eq('case_id', caseResult.id)
    if (!isMounted.current) return
    if (assigneesData) setAssignees(assigneesData)

    const { data: servicesData } = await supabase.from('case_services').select('*, services(*)').eq('case_id', caseResult.id)
    if (!isMounted.current) return
    if (servicesData) setCaseServices(servicesData)

    const { data: installmentsData } = await supabase.from('installments').select('*').eq('case_id', caseResult.id).order('position', { ascending: true })
    if (!isMounted.current) return
    if (installmentsData) setInstallments(installmentsData)

    const attachmentsData = await getAttachments(caseResult.id)
    if (!isMounted.current) return
    setAttachments(attachmentsData)

    const commentsData = await getComments(caseResult.id)
    if (!isMounted.current) return
    setComments(commentsData)

    setLoading(false)
  }

  // Optimistic update handlers - only refetch what changed
  const handleAssigneesUpdate = async () => {
    if (!caseData) return
    const { data: assigneesData } = await supabase
      .from('case_assignees')
      .select('*, users(*)')
      .eq('case_id', caseData.id)
    if (assigneesData) setAssignees(assigneesData)
  }

  const handleServicesUpdate = async () => {
    if (!caseData) return
    const { data: servicesData } = await supabase
      .from('case_services')
      .select('*, services(*)')
      .eq('case_id', caseData.id)
    if (servicesData) setCaseServices(servicesData)
  }

  const handleInstallmentsUpdate = async () => {
    if (!caseData) return
    const { data: installmentsData } = await supabase
      .from('installments')
      .select('*')
      .eq('case_id', caseData.id)
      .order('position', { ascending: true })
    if (installmentsData) setInstallments(installmentsData)
  }

  const handleAttachmentsUpdate = async () => {
    if (!caseData) return
    const attachmentsData = await getAttachments(caseData.id)
    setAttachments(attachmentsData)
  }

  const handleCommentsUpdate = async () => {
    if (!caseData) return
    const commentsData = await getComments(caseData.id)
    setComments(commentsData)
  }

  const handleCaseInfoUpdate = async () => {
    if (!caseData) return
    const { data: updatedCase } = await supabase
      .from('cases')
      .select('*')
      .eq('id', caseData.id)
      .single()
    if (updatedCase) setCaseData(updatedCase)

    // Refetch status if it changed
    if (updatedCase?.status_id) {
      const { data: statusData } = await supabase
        .from('status')
        .select('*')
        .eq('id', updatedCase.status_id)
        .single()
      if (statusData) setStatus(statusData)
    }
  }

  const handleDelete = async () => {
    if (!caseData) return
    setSubmitting(true)
    const result = await deleteCase(caseData.id)
    if (!result?.error) {
      router.push('/cases')
    } else {
      setSubmitting(false)
    }
  }

  if (loading) return <div className="flex items-center justify-center min-h-screen"><p>Loading...</p></div>
  if (!caseData) return <div className="flex items-center justify-center min-h-screen"><p>Case not found</p></div>

  return (
    <div className="space-y-6">
      <CaseHeader caseData={caseData} client={client} onDelete={() => setIsDeleteModalOpen(true)} />
      <Modal isOpen={isDeleteModalOpen} onClose={() => setIsDeleteModalOpen(false)} title="Delete Case">
        <div className="space-y-4">
          <p>Are you sure you want to delete this case? This action cannot be undone.</p>
          <div className="flex justify-end gap-3">
            <Button variant="ghost" onClick={() => setIsDeleteModalOpen(false)} disabled={submitting}>Cancel</Button>
            <Button onClick={handleDelete} disabled={submitting} className="bg-red-500 hover:bg-red-600 text-white">{submitting ? 'Deleting...' : 'Delete Case'}</Button>
          </div>
        </div>
      </Modal>
      {/* Case Info - Full Width Top */}
      <Card className="relative z-10 backdrop-blur-xl bg-[hsl(var(--color-surface))]/80 border-[hsl(var(--color-border))] shadow-[0_8px_32px_rgb(0_0_0/0.25)]">
        <CardContent className="pt-6">
          <CaseInfo 
            caseData={caseData} 
            client={client} 
            status={status}
            assignees={assignees}
            onUpdate={handleCaseInfoUpdate}
            onAssigneesUpdate={handleAssigneesUpdate}
          />
        </CardContent>
      </Card>

      {/* Services & Payment Row */}
      <Card className="backdrop-blur-xl bg-[hsl(var(--color-surface))]/80 border-[hsl(var(--color-border))] shadow-[0_8px_32px_rgb(0_0_0/0.25)]">
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 divide-x divide-[hsl(var(--color-border))]">
            {/* Left: Services */}
            <div className="pr-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold">Services</h3>
                {caseServices.length > 0 && (
                  <span className="text-sm font-semibold text-[hsl(var(--color-text-primary))]">
                    Total: {caseServices.reduce((sum, cs) => sum + ((cs as any).custom_price ?? cs.services?.gross_price ?? 0), 0).toFixed(2)} PLN
                  </span>
                )}
              </div>
              <ServicesSection 
                caseId={caseData.id} 
                caseServices={caseServices} 
                onUpdate={handleServicesUpdate} 
              />
            </div>

            {/* Right: Payment */}
            <div className="pl-6">
              <h3 className="text-lg font-semibold mb-4">Payment</h3>
              <PaymentPanel 
                caseId={caseData.id} 
                installments={installments} 
                services={caseServices}
                client={client}
                onUpdate={handleInstallmentsUpdate} 
              />
            </div>
          </div>
        </CardContent>
      </Card>
      
      {/* Comments and Attachments Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
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

        <Card className="backdrop-blur-xl bg-[hsl(var(--color-surface))]/80 border-[hsl(var(--color-border))] shadow-[0_8px_32px_rgb(0_0_0/0.25)]">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Attachments</CardTitle>
              <Button
                size="sm"
                onClick={() => {
                  const fileInput = document.getElementById('attachment-file-input') as HTMLInputElement
                  fileInput?.click()
                }}
              >
                Add Attachment
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <AttachmentsSection 
              caseId={caseData.id} 
              attachments={attachments} 
              onUpdate={handleAttachmentsUpdate} 
            />
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
