'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { headers } from 'next/headers'
import {
  fetchSigningData,
  recordAgreementOpen as recordOpen,
  signAgreement,
  logAgreementToPresale,
} from '@/lib/agreements'

const FROM_ADDRESS = 'Foreigners.pl <noreply@foreigners.pl>'

/** Public site hosting the signing page. */
function agreementBaseUrl() {
  return process.env.AGREEMENT_BASE_URL || 'https://foreigners.pl'
}

/** Get-or-create the agreement row for a case (authed staff side). */
async function ensureAgreement(supabase: Awaited<ReturnType<typeof createClient>>, caseId: string) {
  const { data: existing } = await supabase
    .from('case_agreements')
    .select('*')
    .eq('case_id', caseId)
    .maybeSingle()
  if (existing) return existing
  const { data, error } = await supabase
    .from('case_agreements')
    .insert({ case_id: caseId })
    .select('*')
    .single()
  if (error) throw new Error('Failed to create agreement')
  return data
}

/** Status of the agreement for the staff panel. */
export async function getCaseAgreementStatus(caseId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' as const }

  const { data: row } = await supabase
    .from('case_agreements')
    .select('*')
    .eq('case_id', caseId)
    .maybeSingle()

  return { agreement: row }
}

/** Returns the public signing link, creating the agreement row if needed. */
export async function getAgreementLink(caseId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' as const }

  const row = await ensureAgreement(supabase, caseId)
  return { url: `${agreementBaseUrl()}/sign/${row.token}` }
}

/** Emails the signing link to the client via Resend. */
export async function sendAgreementEmail(caseId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' as const }

  const row = await ensureAgreement(supabase, caseId)
  if (row.status === 'signed') return { error: 'Agreement already signed' }

  const { data: caseRow } = await supabase
    .from('cases')
    .select('client_id, custom_service_name, case_services!fk_case_services_case(services(name))')
    .eq('id', caseId)
    .single()
  if (!caseRow?.client_id) return { error: 'Case has no client' }

  const { data: client } = await supabase
    .from('clients')
    .select('first_name, last_name, contact_email')
    .eq('id', caseRow.client_id)
    .single()

  const email = client?.contact_email
  if (!email) return { error: 'Client has no email address' }

  const clientName = [client?.first_name, client?.last_name].filter(Boolean).join(' ') || 'there'
  const serviceName = (caseRow.case_services as { services?: { name?: string } }[] | null)?.[0]?.services?.name
    || caseRow.custom_service_name
    || 'your service'

  const url = `${agreementBaseUrl()}/sign/${row.token}`

  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) return { error: 'Email is not configured' }

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: FROM_ADDRESS,
      to: email,
      subject: 'Your Foreigners.pl service agreement',
      html: `
        <div style="font-family: -apple-system, Segoe UI, Roboto, sans-serif; max-width: 560px; margin: 0 auto; padding: 24px;">
          <h2 style="margin: 0 0 16px;">Foreigners.pl</h2>
          <p>Hi ${clientName},</p>
          <p>Please review and sign your service agreement for <strong>${serviceName}</strong>.</p>
          <p style="margin: 24px 0;">
            <a href="${url}" style="background: #4f7cff; color: #fff; padding: 12px 20px; border-radius: 8px; text-decoration: none; display: inline-block;">Review and sign</a>
          </p>
          <p style="color: #666; font-size: 13px;">Or open this link:<br><a href="${url}" style="color: #4f7cff;">${url}</a></p>
          <p style="color: #666; font-size: 13px; margin-top: 32px;">— Foreigners.pl</p>
        </div>
      `,
    }),
  })

  if (!res.ok) {
    const text = await res.text()
    console.error('Resend error:', text)
    return { error: 'Failed to send email' }
  }

  await supabase
    .from('case_agreements')
    .update({ status: 'sent', sent_at: new Date().toISOString(), sent_by: user.id, updated_at: new Date().toISOString() })
    .eq('id', row.id)

  await logAgreementToPresale(supabase, caseId, `Service agreement sent to ${email}`)
  revalidatePath(`/cases/${caseId}`)
  return { success: true, email }
}

// ============================================================
// Public (signing link) side — scoped by the unguessable token.
// ============================================================

export async function getSigningPageData(token: string) {
  return fetchSigningData(token)
}

export async function recordAgreementOpen(token: string) {
  return recordOpen(token)
}

export async function submitAgreementSignature(
  token: string,
  fields: {
    name: string
    email: string
    pesel?: string
    idNumber?: string
    signatureData: string
  }
) {
  const h = await headers()
  const ip = h.get('x-forwarded-for')?.split(',')[0]?.trim() || h.get('x-real-ip') || null
  const ua = h.get('user-agent') || null
  return signAgreement(token, fields, { ip, userAgent: ua })
}
