'use client'

import { use, useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { StepsPanel } from '../components/StepsPanel'
import { SubPageHeader } from '@/components/shared/SubPageHeader'
import { Loader2, ListChecks } from 'lucide-react'

interface ProgressPageProps {
  params: Promise<{ id: string }>
  searchParams: Promise<{ q?: string; e?: string }>
}

export default function CaseProgressPage({ params, searchParams }: ProgressPageProps) {
  const { id: urlId } = use(params)
  const { q: focusQueryId, e: focusEntryId } = use(searchParams)
  const [caseId, setCaseId] = useState<string | null>(null)
  const [title, setTitle] = useState('')
  const [subtitle, setSubtitle] = useState('')
  const [loading, setLoading] = useState(true)
  const isMounted = useRef(true)

  useEffect(() => {
    isMounted.current = true
    ;(async () => {
      const supabase = createClient()
      const select = 'id, case_code, client_id, case_services!fk_case_services_case(services(name))'
      const result = urlId.startsWith('C')
        ? await supabase.from('cases').select(select).eq('case_code', urlId).single()
        : await supabase.from('cases').select(select).eq('id', urlId).single()

      if (!isMounted.current) return
      const caseRow = result.data
      if (caseRow) {
        setCaseId(caseRow.id)

        // Title = the case's service name (fallback to case code)
        const svc = (caseRow.case_services as any[])?.[0]?.services?.name
        setTitle(svc || caseRow.case_code || 'Case')

        // Subtitle = client name · phone number
        if (caseRow.client_id) {
          const [clientRes, phoneRes] = await Promise.all([
            supabase.from('clients').select('first_name, last_name, contact_email').eq('id', caseRow.client_id).single(),
            supabase.from('contact_numbers').select('country_code, number').eq('client_id', caseRow.client_id).limit(1).maybeSingle(),
          ])
          if (!isMounted.current) return
          const c = clientRes.data
          const name = c ? ([c.first_name, c.last_name].filter(Boolean).join(' ') || c.contact_email) : ''
          const phone = phoneRes.data ? `${phoneRes.data.country_code || ''} ${phoneRes.data.number}`.trim() : ''
          setSubtitle([name, phone].filter(Boolean).join(' · '))
        }
      }
      setLoading(false)
    })()
    return () => { isMounted.current = false }
  }, [urlId])

  if (loading) {
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
      <SubPageHeader backHref={`/cases/${urlId}`} title={title} subtitle={subtitle} icon={<ListChecks className="w-4 h-4 text-white" />} />
      <StepsPanel caseId={caseId} focusQueryId={focusQueryId} focusEntryId={focusEntryId} />
    </div>
  )
}
