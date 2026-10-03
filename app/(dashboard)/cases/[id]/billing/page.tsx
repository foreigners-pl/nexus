'use client'

import { use, useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { SubPageHeader } from '@/components/shared/SubPageHeader'
import { PaymentPanel } from '../components/PaymentPanel'
import { ensureBalanceInstallment } from '@/app/actions/installments'
import { Loader2, Receipt } from 'lucide-react'

interface BillingPageProps {
  params: Promise<{ id: string }>
}

export default function CaseBillingPage({ params }: BillingPageProps) {
  const { id: urlId } = use(params)
  const [caseData, setCaseData] = useState<any>(null)
  const [client, setClient] = useState<any>(null)
  const [clientPhone, setClientPhone] = useState('')
  const [caseServices, setCaseServices] = useState<any[]>([])
  const [installments, setInstallments] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const isMounted = useRef(true)
  const supabase = createClient()

  useEffect(() => {
    isMounted.current = true
    load()
    return () => { isMounted.current = false }
  }, [urlId])

  // Refetch when an installment pane/page mutates this case's data
  useEffect(() => {
    const handler = (e: Event) => {
      if ((e as CustomEvent).detail?.caseId === caseData?.id) reload()
    }
    window.addEventListener('nexus:case-data-changed', handler)
    return () => window.removeEventListener('nexus:case-data-changed', handler)
  }, [caseData?.id])

  const load = async () => {
    const result = urlId.startsWith('C')
      ? await supabase.from('cases').select('*').eq('case_code', urlId).single()
      : await supabase.from('cases').select('*').eq('id', urlId).single()
    if (!isMounted.current) return
    const caseRow = result.data
    if (!caseRow) { setLoading(false); return }
    setCaseData(caseRow)

    // Make sure the auto "Final payment" balance installment exists and matches the total
    await ensureBalanceInstallment(caseRow.id)

    const [clientRes, phoneRes, servicesRes, instRes] = await Promise.all([
      caseRow.client_id
        ? supabase.from('clients').select('*').eq('id', caseRow.client_id).single()
        : Promise.resolve({ data: null }),
      caseRow.client_id
        ? supabase.from('contact_numbers').select('country_code, number').eq('client_id', caseRow.client_id).limit(1).maybeSingle()
        : Promise.resolve({ data: null }),
      supabase.from('case_services').select('*, services(*)').eq('case_id', caseRow.id),
      supabase.from('installments').select('*').eq('case_id', caseRow.id).order('position', { ascending: true }),
    ])
    if (!isMounted.current) return
    setClient(clientRes.data)
    if (phoneRes.data) setClientPhone(`${phoneRes.data.country_code || ''} ${phoneRes.data.number}`.trim())
    setCaseServices(servicesRes.data || [])
    setInstallments(instRes.data || [])
    setLoading(false)
  }

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
  const subtitle = [clientName, clientPhone].filter(Boolean).join(' · ')

  return (
    <div className="max-w-3xl mx-auto pb-20">
      <SubPageHeader backHref={`/cases/${urlId}`} title="Billing" subtitle={subtitle} icon={<Receipt className="w-4 h-4 text-white" />} />

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
