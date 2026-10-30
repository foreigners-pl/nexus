'use client'

import { useEffect, useState } from 'react'
import { recordAgreementOpen, submitAgreementSignature, getSigningPageData } from '@/app/actions/agreements'
import { AgreementDocument } from '@/components/AgreementDocument'
import { SignaturePad } from '@/components/SignaturePad'

type SigningData = NonNullable<Awaited<ReturnType<typeof getSigningPageData>>>

interface SigningFlowProps {
  token: string
  data: SigningData
}

export function SigningFlow({ token, data }: SigningFlowProps) {
  const [signed, setSigned] = useState(data.status === 'signed')
  const [name, setName] = useState(data.clientName || '')
  const [email, setEmail] = useState(data.clientEmail || '')
  const [pesel, setPesel] = useState('')
  const [idNumber, setIdNumber] = useState('')
  const [signature, setSignature] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (data.status !== 'signed') recordAgreementOpen(token)
  }, [token, data.status])

  const submit = async () => {
    setError(null)
    if (!name.trim()) return setError('Please enter your full name')
    if (!signature) return setError('Please add your signature')
    setSubmitting(true)
    const res = await submitAgreementSignature(token, { name, email, pesel, idNumber, signatureData: signature })
    setSubmitting(false)
    if (res.error) setError(res.error)
    else setSigned(true)
  }

  return (
    <div className="min-h-screen py-8 px-4 md:px-6">
      <div className="max-w-3xl mx-auto">
        <div className="mb-6 text-center">
          <h1 className="text-xl font-semibold text-[hsl(var(--color-text-primary))]">Foreigners.pl</h1>
          <p className="text-sm text-[hsl(var(--color-text-secondary))] mt-1">Service agreement</p>
        </div>

        <AgreementDocument
          clientName={data.signed?.name || name || data.clientName}
          serviceName={data.serviceName}
          totalPrice={data.totalPrice}
          steps={data.steps}
          date={data.date}
          company={data.company}
          signer={signed && data.signed ? data.signed : null}
        />

        {signed ? (
          <div className="mt-8 rounded-xl border border-green-500/40 bg-green-500/10 p-5 text-center">
            <p className="font-medium text-green-400">Agreement signed</p>
            <p className="text-sm text-[hsl(var(--color-text-secondary))] mt-1">
              Thank you — your signed agreement has been sent to your Foreigners.pl team.
            </p>
          </div>
        ) : (
          <div className="mt-8 rounded-xl border border-[hsl(var(--color-border))] bg-[hsl(var(--color-surface))] p-5 space-y-4">
            <h2 className="text-base font-semibold text-[hsl(var(--color-text-primary))]">Your details</h2>
            {error && <p className="text-sm text-red-400">{error}</p>}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-[hsl(var(--color-text-secondary))] mb-1">Full name *</label>
                <input
                  value={name}
                  onChange={e => setName(e.target.value)}
                  className="w-full rounded-lg border border-[hsl(var(--color-border))] bg-[hsl(var(--color-bg))] px-3 py-2.5 text-sm text-[hsl(var(--color-text-primary))] outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-[hsl(var(--color-text-secondary))] mb-1">Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  className="w-full rounded-lg border border-[hsl(var(--color-border))] bg-[hsl(var(--color-bg))] px-3 py-2.5 text-sm text-[hsl(var(--color-text-primary))] outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-[hsl(var(--color-text-secondary))] mb-1">PESEL (optional)</label>
                <input
                  value={pesel}
                  onChange={e => setPesel(e.target.value)}
                  className="w-full rounded-lg border border-[hsl(var(--color-border))] bg-[hsl(var(--color-bg))] px-3 py-2.5 text-sm text-[hsl(var(--color-text-primary))] outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-[hsl(var(--color-text-secondary))] mb-1">ID / passport no. (optional)</label>
                <input
                  value={idNumber}
                  onChange={e => setIdNumber(e.target.value)}
                  className="w-full rounded-lg border border-[hsl(var(--color-border))] bg-[hsl(var(--color-bg))] px-3 py-2.5 text-sm text-[hsl(var(--color-text-primary))] outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-[hsl(var(--color-text-secondary))] mb-1">Signature *</label>
              <SignaturePad onChange={setSignature} />
            </div>

            <button
              onClick={submit}
              disabled={submitting}
              className="w-full rounded-xl bg-[hsl(var(--color-primary))] py-3 text-sm font-semibold text-white hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              {submitting ? 'Signing…' : 'Sign agreement'}
            </button>
            <p className="text-[11px] text-[hsl(var(--color-text-muted))] text-center">
              By signing you confirm you have read and accept the terms above.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
