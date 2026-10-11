'use client'

import { use, useEffect, useState } from 'react'
import { getCaseAgreementData } from '@/app/actions/cases'
import { getCompanySettings } from '@/app/actions/company'
import { Button } from '@/components/ui/Button'
import { Printer } from 'lucide-react'

interface AgreementPageProps {
  params: Promise<{ id: string }>
}

export default function AgreementPage({ params }: AgreementPageProps) {
  const { id: caseId } = use(params)
  const [data, setData] = useState<Awaited<ReturnType<typeof getCaseAgreementData>> | null>(null)
  const [company, setCompany] = useState<Record<string, string | null>>({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([getCaseAgreementData(caseId), getCompanySettings()]).then(([caseData, companyRes]) => {
      setData(caseData)
      setCompany(companyRes.settings || {})
      setLoading(false)
    })
  }, [caseId])

  if (loading) {
    return <div className="flex items-center justify-center min-h-screen"><p>Loading…</p></div>
  }
  if (!data || data.error) {
    return <div className="flex items-center justify-center min-h-screen"><p>Agreement unavailable</p></div>
  }

  const { caseCode, clientName, serviceName, totalPrice, date } = data

  return (
    <div className="max-w-3xl mx-auto py-8 px-4 md:px-6">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-lg font-semibold text-[hsl(var(--color-text-primary))]">Service agreement</h1>
        <Button onClick={() => window.print()} size="sm">
          <Printer className="w-4 h-4 mr-2" />
          Print / Save as PDF
        </Button>
      </div>

      <div className="prose prose-sm max-w-none text-[hsl(var(--color-text-primary))] print:prose-black space-y-6">
        <div className="border-b border-[hsl(var(--color-border))] pb-6">
          <p className="text-sm text-[hsl(var(--color-text-secondary))]">Date: {date}</p>
          <p className="text-sm text-[hsl(var(--color-text-secondary))]">Case: {caseCode}</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <h2 className="text-base font-semibold mb-2">Service provider</h2>
            <p className="font-medium">{company.company_name || 'Nexus'}</p>
            {company.address && <p className="text-sm text-[hsl(var(--color-text-secondary))] whitespace-pre-line">{company.address}</p>}
            {company.tax_id && <p className="text-sm text-[hsl(var(--color-text-secondary))]">Tax ID: {company.tax_id}</p>}
            {company.email && <p className="text-sm text-[hsl(var(--color-text-secondary))]">{company.email}</p>}
            {company.phone && <p className="text-sm text-[hsl(var(--color-text-secondary))]">{company.phone}</p>}
          </div>

          <div>
            <h2 className="text-base font-semibold mb-2">Client</h2>
            <p>{clientName || 'Client name'}</p>
          </div>
        </div>

        <div>
          <h2 className="text-base font-semibold mb-2">Service</h2>
          <p>{serviceName || 'Selected service'}</p>
        </div>

        <div>
          <h2 className="text-base font-semibold mb-2">Price</h2>
          <p className="text-lg font-semibold">{totalPrice ? `${Number(totalPrice).toLocaleString()} PLN` : 'To be agreed'}</p>
        </div>

        <div>
          <h2 className="text-base font-semibold mb-2">Terms</h2>
          <p>
            This document is a non-binding summary of the service described above. It is provided for
            transparency so the client understands what they are paying for. No signature is required.
          </p>
          <p>
            The service provider will carry out the agreed service with reasonable care and skill. The
            client is responsible for providing accurate information and any requested documents in a
            timely manner.
          </p>
          <p>
            Payment terms, refund policy, and the exact scope of work are governed by the separate
            engagement agreement and invoices issued through this case.
          </p>
        </div>
      </div>
    </div>
  )
}
