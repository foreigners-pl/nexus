'use client'

import { use, useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { getAttachments } from '@/app/actions/attachments'
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
  const supabase = createClient()

  useEffect(() => {
    isMounted.current = true
    ;(async () => {
      const select = 'id, case_code, client_id, case_services!fk_case_services_case(services(name))'
      const result = urlId.startsWith('C')
        ? await supabase.from('cases').select(select).eq('case_code', urlId).single()
        : await supabase.from('cases').select(select).eq('id', urlId).single()
      if (!isMounted.current) return
      const caseRow = result.data
      if (!caseRow) { setLoading(false); return }
      setCaseData(caseRow)

      const svc = (caseRow.case_services as any[])?.[0]?.services?.name || null
      if (caseRow.client_id) {
        const [clientRes, phoneRes] = await Promise.all([
          supabase.from('clients').select('first_name, last_name, contact_email').eq('id', caseRow.client_id).single(),
          supabase.from('contact_numbers').select('country_code, number').eq('client_id', caseRow.client_id).limit(1).maybeSingle(),
        ])
        const c = clientRes.data
        const name = c ? ([c.first_name, c.last_name].filter(Boolean).join(' ') || c.contact_email) : ''
        const phone = phoneRes.data ? `${phoneRes.data.country_code || ''} ${phoneRes.data.number}`.trim() : ''
        setClientName(name)
        setHeaderSub([svc, phone].filter(Boolean).join(' · '))
      } else {
        setHeaderSub(svc || '')
      }

      const atts = await getAttachments(caseRow.id)
      if (!isMounted.current) return
      setAttachments(atts)
      setLoading(false)
    })()
    return () => { isMounted.current = false }
  }, [urlId])

  const reloadAttachments = async () => {
    if (!caseData) return
    setAttachments(await getAttachments(caseData.id))
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
