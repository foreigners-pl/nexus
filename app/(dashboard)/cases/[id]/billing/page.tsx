'use client'

import { use, useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useQueryClient } from '@tanstack/react-query'
import { queryKeys, fetchBillingQuery } from '@/lib/query'
import { SubPageHeader } from '@/components/shared/SubPageHeader'
import { PaymentPanel } from '../components/PaymentPanel'
import { Loader2, Receipt } from 'lucide-react'

interface BillingPageProps {
  params: Promise<{ id: string }>
}

export default function CaseBillingPage({ params }: BillingPageProps) {
  const { id: urlId } = use(params)
  const [caseData, setCaseData] = useState<any>(null)
  const [client, setClient] = useState<any>(null)
  const [caseCode, setCaseCode] = useState<string | null>(null)
  const [clientPhone, setClientPhone] = useState('')
  const [caseServices, setCaseServices] = useState<any[]>([])
  const [installments, setInstallments] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const isMounted = useRef(true)
  const supabase = createClient()
  const queryClient = useQueryClient()

  useEffect(() => {
    isMounted.current = true
    const cached = queryClient.getQueryData<any>(queryKeys.billing(urlId))
    if (cached?.case) {
      applyData(cached)
      setLoading(false)
      load() // background refresh
    } else {
      load()
    }
    return () => { isMounted.current = false }
  }, [urlId])

  const applyData = (data: any) => {
    setCaseData(data.case)
    setCaseCode(data.case?.case_code || null)
    setClient(data.client)
    setClientPhone(data.clientPhone || '')
    setCaseServices(data.caseServices || [])
    setInstallments(data.installments || [])
  }

  const load = async () => {
    const data = await fetchBillingQuery(queryClient, urlId)
    if (!isMounted.current) return
    if ('error' in data) { setLoading(false); return }
    applyData(data)
    setLoading(false)
  }

  // Refetch when an installment pane/page mutates this case's data
  useEffect(() => {
    const handler = (e: Event) => {
      if ((e as CustomEvent).detail?.caseId === caseData?.id) reload()
    }
    window.addEventListener('nexus:case-data-changed', handler)
    return () => window.removeEventListener('nexus:case-data-changed', handler)
  }, [caseData?.id])

  const reload = async () => {
    if (!caseData) return
    const [caseRes, servicesRes, instRes] = await Promise.all([
      supabase.from('cases').select('total_price').eq('id', caseData.id).single(),
      supabase.from('case_services').select('*, services(*)').eq('case_id', caseData.id),
      supabase.from('installments').select('*').eq('case_id', caseData.id).order('position', { ascending: true }),
    ])
    if (caseRes.data) setCaseData({ ...caseData, total_price: caseRes.data.total_price })
    setCaseServices(servicesRes.data || [])
    setInstallments(instRes.data || [])
    // Mutations landed — mark cached bundle stale so the next mount refetches
    queryClient.invalidateQueries({ queryKey: queryKeys.billing(urlId) })
    queryClient.invalidateQueries({ queryKey: queryKeys.billing(caseData.id) })
  }

  if (loading) {
    return (
      <div className="flex justify-center py-16 text-[hsl(var(--color-text-secondary))]">
        <Loader2 className="w-6 h-6 animate-spin" />
      </div>
    )
  }
  if (!caseData) return <div className="flex items-center justify-center min-h-screen"><p>Case not found</p></div>

  const clientName = client
    ? [client.first_name, client.last_name].filter(Boolean).join(' ') || client.contact_email
    : null
  const serviceName = (caseServices[0] as any)?.services?.name || null
  const subtitle = [serviceName, clientPhone].filter(Boolean).join(' · ')

  return (
    <div className="max-w-3xl mx-auto pb-20">
      <SubPageHeader backHref={`/cases/${urlId}`} label="Case" title={caseCode || caseData.case_code || 'Case'} subtitle={[clientName, subtitle].filter(Boolean).join(' · ')} icon={<Receipt className="w-4 h-4 text-white" />} titleHref={caseData.client_id ? `/clients/${caseData.client_id}` : undefined} />

      <div className="rounded-xl border border-[hsl(var(--color-border))] bg-[hsl(var(--color-surface))] p-5 space-y-6">
        <div>
          <h3 className="text-base font-semibold text-[hsl(var(--color-text-primary))] mb-3">Service</h3>
          {caseServices.length === 0 ? (
            <p className="text-sm text-[hsl(var(--color-text-secondary))]">No service attached to this case</p>
          ) : (
            <div className="divide-y divide-[hsl(var(--color-border))]">
              {caseServices.map(cs => (
                <div key={cs.id} className="flex items-center justify-between py-2.5">
                  <span className="text-sm text-[hsl(var(--color-text-primary))]">{cs.services?.name || 'Service'}</span>
                  <span className="text-sm font-semibold text-[hsl(var(--color-text-primary))]">
                    {((cs as any).custom_price ?? cs.services?.gross_price ?? 0).toFixed(2)} PLN
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="border-t border-[hsl(var(--color-border))] pt-6">
          <h3 className="text-base font-semibold text-[hsl(var(--color-text-primary))] mb-4">Payment</h3>
          <PaymentPanel
            caseId={caseData.id}
            caseUrlId={urlId}
            installments={installments}
            totalPrice={Number(caseData.total_price ?? caseServices.reduce((sum, cs) => sum + ((cs as any).custom_price ?? cs.services?.gross_price ?? 0), 0))}
            onUpdate={reload}
          />
        </div>
      </div>
    </div>
  )
}
