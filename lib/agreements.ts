import { createAdminClient } from '@/lib/supabase/admin'

type AdminClient = ReturnType<typeof createAdminClient>

export async function logAgreementToPresale(supabase: AdminClient | any, caseId: string, body: string) {
  const { data: step } = await supabase
    .from('case_steps')
    .select('id')
    .eq('case_id', caseId)
    .eq('step_type', 'presale')
    .maybeSingle()
  await supabase.from('case_entries').insert({
    case_id: caseId,
    step_id: step?.id ?? null,
    kind: 'note',
    body,
  })
}

/** Data for the public signing page. */
export async function fetchSigningData(token: string) {
  const admin = createAdminClient()

  const { data: agreement } = await admin
    .from('case_agreements')
    .select('*')
    .eq('token', token)
    .maybeSingle()
  if (!agreement) return null

  const { data: caseRow } = await admin
    .from('cases')
    .select('id, client_id, created_at, custom_service_name, total_price')
    .eq('id', agreement.case_id)
    .single()
  if (!caseRow) return null

  const [clientRes, serviceRes, companyRes] = await Promise.all([
    caseRow.client_id
      ? admin.from('clients').select('first_name, last_name, contact_email').eq('id', caseRow.client_id).single()
      : Promise.resolve({ data: null }),
    admin.from('case_services').select('service_id').eq('case_id', caseRow.id).limit(1).maybeSingle(),
    admin.from('company_settings').select('*').limit(1).maybeSingle(),
  ])

  const client = clientRes.data
  const clientName = client
    ? ([client.first_name, client.last_name].filter(Boolean).join(' ') || client.contact_email || '')
    : ''

  let serviceName = caseRow.custom_service_name as string | null
  let totalPrice = caseRow.total_price as number | null
  let steps: string[] = []

  const serviceId = serviceRes.data?.service_id
  if (serviceId) {
    const [{ data: service }, { data: serviceSteps }] = await Promise.all([
      admin.from('services').select('name, gross_price').eq('id', serviceId).single(),
      admin.from('service_steps').select('name').eq('service_id', serviceId).order('position'),
    ])
    if (service) {
      serviceName = service.name
      totalPrice = service.gross_price ?? totalPrice
    }
    steps = (serviceSteps || []).map(s => s.name)
  }

  return {
    status: agreement.status as string,
    clientName,
    clientEmail: client?.contact_email || '',
    serviceName,
    totalPrice,
    steps,
    date: caseRow.created_at ? new Date(caseRow.created_at).toLocaleDateString('en-GB') : null,
    company: (companyRes.data as Record<string, string | null> | null) || {},
    signed: agreement.status === 'signed'
      ? {
          name: agreement.signer_name,
          email: agreement.signer_email,
          pesel: agreement.signer_pesel,
          idNumber: agreement.signer_id_number,
          signedAt: agreement.signed_at,
          signatureData: agreement.signature_data,
        }
      : null,
  }
}

/** Records a link open. */
export async function recordAgreementOpen(token: string) {
  const admin = createAdminClient()

  const { data: agreement } = await admin
    .from('case_agreements')
    .select('id, case_id, status, open_count')
    .eq('token', token)
    .maybeSingle()
  if (!agreement || agreement.status === 'signed') return { success: true }

  const firstOpen = (agreement.open_count || 0) === 0
  await Promise.all([
    admin.from('agreement_opens').insert({ agreement_id: agreement.id }),
    admin
      .from('case_agreements')
      .update({
        open_count: (agreement.open_count || 0) + 1,
        last_opened_at: new Date().toISOString(),
        status: 'opened',
        updated_at: new Date().toISOString(),
      })
      .eq('id', agreement.id),
  ])

  if (firstOpen) {
    await logAgreementToPresale(admin, agreement.case_id, 'Service agreement opened by client')
  }
  return { success: true }
}

/** Stores the signature and marks the agreement signed. */
export async function signAgreement(
  token: string,
  fields: {
    name: string
    email?: string
    pesel?: string
    idNumber?: string
    signatureData: string
  },
  meta: { ip?: string | null; userAgent?: string | null } = {}
) {
  const admin = createAdminClient()

  const { data: agreement } = await admin
    .from('case_agreements')
    .select('id, case_id, status')
    .eq('token', token)
    .maybeSingle()
  if (!agreement) return { error: 'Agreement not found' }
  if (agreement.status === 'signed') return { error: 'Agreement already signed' }

  const name = fields.name?.trim()
  if (!name) return { error: 'Name is required' }
  if (!fields.signatureData || !fields.signatureData.startsWith('data:image/')) {
    return { error: 'Signature is required' }
  }

  const { error } = await admin
    .from('case_agreements')
    .update({
      status: 'signed',
      signed_at: new Date().toISOString(),
      signer_name: name,
      signer_email: fields.email?.trim() || null,
      signer_pesel: fields.pesel?.trim() || null,
      signer_id_number: fields.idNumber?.trim() || null,
      signer_ip: meta.ip || null,
      signer_user_agent: meta.userAgent || null,
      signature_data: fields.signatureData,
      updated_at: new Date().toISOString(),
    })
    .eq('id', agreement.id)

  if (error) {
    console.error('Error signing agreement:', error)
    return { error: 'Failed to save signature' }
  }

  await logAgreementToPresale(admin, agreement.case_id, `Service agreement signed by ${name}`)
  return { success: true }
}
