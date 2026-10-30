'use client'

import { use, useEffect, useState } from 'react'
import { getCaseAgreementData } from '@/app/actions/cases'
import { getCompanySettings } from '@/app/actions/company'
import { getCaseAgreementStatus, getAgreementLink, sendAgreementEmail } from '@/app/actions/agreements'
import { logAgreementDownload } from '@/app/actions/workflow'
import { Button } from '@/components/ui/Button'
import { AgreementDocument, type AgreementSigner } from '@/components/AgreementDocument'
import { Printer, Send, Link2, Check, Clock, Eye, PenLine } from 'lucide-react'

interface AgreementPageProps {
  params: Promise<{ id: string }>
}

type AgreementRow = {
  status: string
  sent_at: string | null
  open_count: number
  last_opened_at: string | null
  signed_at: string | null
  signer_name: string | null
  signer_email: string | null
  signer_pesel: string | null
  signer_id_number: string | null
  signature_data: string | null
} | null

export default function AgreementPage({ params }: AgreementPageProps) {
  const { id: caseId } = use(params)
  const [data, setData] = useState<Awaited<ReturnType<typeof getCaseAgreementData>> | null>(null)
  const [company, setCompany] = useState<Record<string, string | null>>({})
  const [agreement, setAgreement] = useState<AgreementRow>(null)
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = () => {
    Promise.all([
      getCaseAgreementData(caseId),
      getCompanySettings(),
      getCaseAgreementStatus(caseId),
    ]).then(([caseData, companyRes, statusRes]) => {
      setData(caseData)
      setCompany(companyRes.settings || {})
      setAgreement('agreement' in statusRes ? statusRes.agreement : null)
      setLoading(false)
    })
  }

  useEffect(load, [caseId])

  const copyLink = async () => {
    setError(null)
    const res = await getAgreementLink(caseId)
    if ('error' in res && res.error) {
      setError(res.error)
      return
    }
    if ('url' in res) {
      await navigator.clipboard.writeText(res.url)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
      load()
    }
  }

  const send = async () => {
    setSending(true)
    setError(null)
    const res = await sendAgreementEmail(caseId)
    setSending(false)
    if (res.error) setError(res.error)
    else load()
  }

  const print = () => {
    logAgreementDownload(caseId)
    window.print()
  }

  if (loading) {
    return <div className="flex items-center justify-center min-h-screen"><p>Loading…</p></div>
  }
  if (!data || data.error) {
    return <div className="flex items-center justify-center min-h-screen"><p>Agreement unavailable</p></div>
  }

  const { clientName, clientEmail, serviceName, totalPrice, steps, date } = data
  const status = agreement?.status || 'created'
  const signed = status === 'signed'
  const signer: AgreementSigner | null = signed
    ? {
        name: agreement!.signer_name,
        email: agreement!.signer_email,
        pesel: agreement!.signer_pesel,
        idNumber: agreement!.signer_id_number,
        signedAt: agreement!.signed_at,
        signatureData: agreement!.signature_data,
      }
    : null

  return (
    <div className="max-w-3xl mx-auto py-8 px-4 md:px-6">
      <div className="flex items-center justify-between mb-6 print:hidden">
        <h1 className="text-lg font-semibold text-[hsl(var(--color-text-primary))]">Service agreement</h1>
        <Button onClick={print} size="sm">
          <Printer className="w-4 h-4 mr-2" />
          Print / Save as PDF
        </Button>
      </div>

      {/* Status panel */}
      <div className="rounded-xl border border-[hsl(var(--color-border))] bg-[hsl(var(--color-surface))] p-4 mb-8 print:hidden">
        {error && <p className="text-sm text-red-400 mb-3">{error}</p>}

        {status === 'created' && (
          <div className="flex items-start gap-3">
            <Clock className="w-5 h-5 text-[hsl(var(--color-text-muted))] shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm font-medium text-[hsl(var(--color-text-primary))]">Not sent yet</p>
              <p className="text-xs text-[hsl(var(--color-text-secondary))] mt-0.5">
                Send the client a link where they can review and sign this agreement{clientEmail ? ` (${clientEmail})` : ''}.
              </p>
              <div className="flex gap-2 mt-3">
                <Button size="sm" onClick={send} disabled={sending || !clientEmail}>
                  <Send className="w-3.5 h-3.5 mr-1.5" />
                  {sending ? 'Sending…' : 'Send by email'}
                </Button>
                <Button size="sm" variant="outline" onClick={copyLink}>
                  {copied ? <Check className="w-3.5 h-3.5 mr-1.5" /> : <Link2 className="w-3.5 h-3.5 mr-1.5" />}
                  {copied ? 'Copied' : 'Copy link'}
                </Button>
              </div>
              {!clientEmail && (
                <p className="text-[11px] text-[hsl(var(--color-text-muted))] mt-2">
                  Client has no email — use Copy link and send it yourself.
                </p>
              )}
            </div>
          </div>
        )}

        {(status === 'sent' || status === 'opened') && (
          <div className="flex items-start gap-3">
            <Eye className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm font-medium text-[hsl(var(--color-text-primary))]">
                {status === 'opened' ? 'Opened by client' : 'Sent — waiting for client'}
              </p>
              <div className="text-xs text-[hsl(var(--color-text-secondary))] mt-0.5 space-y-0.5">
                {agreement?.sent_at && <p>Sent {new Date(agreement.sent_at).toLocaleString()}</p>}
                {(agreement?.open_count ?? 0) > 0 && (
                  <p>
                    Opened {agreement!.open_count} {agreement!.open_count === 1 ? 'time' : 'times'}
                    {agreement?.last_opened_at ? ` — last ${new Date(agreement.last_opened_at).toLocaleString()}` : ''}
                  </p>
                )}
              </div>
              <div className="flex gap-2 mt-3">
                <Button size="sm" variant="outline" onClick={send} disabled={sending}>
                  <Send className="w-3.5 h-3.5 mr-1.5" />
                  {sending ? 'Sending…' : 'Resend email'}
                </Button>
                <Button size="sm" variant="outline" onClick={copyLink}>
                  {copied ? <Check className="w-3.5 h-3.5 mr-1.5" /> : <Link2 className="w-3.5 h-3.5 mr-1.5" />}
                  {copied ? 'Copied' : 'Copy link'}
                </Button>
              </div>
            </div>
          </div>
        )}

        {signed && (
          <div className="flex items-start gap-3">
            <PenLine className="w-5 h-5 text-green-500 shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm font-medium text-[hsl(var(--color-text-primary))]">Signed</p>
              <div className="text-xs text-[hsl(var(--color-text-secondary))] mt-0.5 space-y-0.5">
                <p>Signed by {agreement?.signer_name} on {agreement?.signed_at ? new Date(agreement.signed_at).toLocaleString() : ''}</p>
                {(agreement?.open_count ?? 0) > 0 && <p>Link was opened {agreement!.open_count} {agreement!.open_count === 1 ? 'time' : 'times'} before signing</p>}
              </div>
            </div>
          </div>
        )}
      </div>

      <AgreementDocument
        clientName={clientName}
        serviceName={serviceName}
        totalPrice={totalPrice}
        steps={steps}
        date={date}
        company={company}
        signer={signer}
      />
    </div>
  )
}
