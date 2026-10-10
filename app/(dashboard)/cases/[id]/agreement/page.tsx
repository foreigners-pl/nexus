'use client'

import { use, useEffect, useState } from 'react'
import { getCaseAgreementData } from '@/app/actions/cases'
import { Button } from '@/components/ui/Button'
import { Printer } from 'lucide-react'

interface AgreementPageProps {
  params: Promise<{ id: string }>
}

export default function AgreementPage({ params }: AgreementPageProps) {
  const { id: caseId } = use(params)
  const [data, setData] = useState<Awaited<ReturnType<typeof getCaseAgreementData>> | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getCaseAgreementData(caseId).then(res => {
      setData(res)
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

      <div className="prose prose-sm max-w-none text-[hsl(var(--color-text-primary))] print:prose-black">
        <p className="text-[hsl(var(--color-text-secondary))]">Date: {date}</p>
        <p className="text-[hsl(var(--color-text-secondary))]">Case: {caseCode}</p>

        <h2 className="text-base font-semibold mt-6">Client</h2>
        <p>{clientName || 'Client name'}</p>

        <h2 className="text-base font-semibold mt-6">Service</h2>
        <p>{serviceName || 'Selected service'}</p>

        <h2 className="text-base font-semibold mt-6">Price</h2>
        <p>{totalPrice ? `${totalPrice.toLocaleString()} PLN` : 'To be agreed'}</p>

        <h2 className="text-base font-semibold mt-6">Terms</h2>
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
  )
}
