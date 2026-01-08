'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

/**
 * Get all form submissions
 */
export async function getFormSubmissions(status?: string) {
  const supabase = await createClient()

  let query = supabase
    .from('form_submissions')
    .select(`
      *,
      clients(id, first_name, last_name, client_code),
      cases(id, case_code)
    `)
    .order('created_at', { ascending: false })

  if (status) {
    query = query.eq('status', status)
  }

  const { data, error } = await query

  if (error) {
    console.error('Error fetching form submissions:', error)
    return { error: error.message }
  }

  return { data }
}

/**
 * Update submission status
 */
export async function updateSubmissionStatus(
  submissionId: string,
  status: 'new' | 'contacted' | 'converted' | 'spam' | 'rejected',
  notes?: string
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const updateData: Record<string, unknown> = {
    status,
    processed_at: status !== 'new' ? new Date().toISOString() : null,
    processed_by: status !== 'new' ? user?.id : null,
  }

  if (notes !== undefined) {
    updateData.notes = notes
  }

  const { error } = await supabase
    .from('form_submissions')
    .update(updateData)
    .eq('id', submissionId)

  if (error) {
    console.error('Error updating submission:', error)
    return { error: error.message }
  }

  revalidatePath('/leads')
  return { success: true }
}

/**
 * Convert a form submission to a client + case
 * Creates client, case, and adds the submission description as the first comment
 */
export async function convertSubmissionToClient(submissionId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return { error: 'Not authenticated' }
  }

  // Get the submission
  const { data: submission, error: fetchError } = await supabase
    .from('form_submissions')
    .select('*')
    .eq('id', submissionId)
    .single()

  if (fetchError || !submission) {
    return { error: 'Submission not found' }
  }

  if (submission.client_id) {
    return { error: 'Submission already converted to client' }
  }

  // Parse name into first/last
  const nameParts = submission.full_name.trim().split(' ')
  const firstName = nameParts[0] || null
  const lastName = nameParts.slice(1).join(' ') || null

  // 1. Create the client
  const { data: client, error: clientError } = await supabase
    .from('clients')
    .insert({
      first_name: firstName,
      last_name: lastName,
      contact_email: submission.email,
    })
    .select()
    .single()

  if (clientError) {
    console.error('Error creating client:', clientError)
    return { error: 'Failed to create client' }
  }

  // 2. Add phone number if provided
  if (submission.phone) {
    const phoneNumber = submission.phone_country_code 
      ? `${submission.phone_country_code} ${submission.phone}`
      : submission.phone

    await supabase
      .from('contact_numbers')
      .insert({
        client_id: client.id,
        number: phoneNumber,
        is_on_whatsapp: false,
      })
  }

  // 3. Get "New" status for the case
  const { data: newStatus } = await supabase
    .from('status')
    .select('id')
    .eq('name', 'New')
    .single()

  // 4. Create the case
  const { data: caseData, error: caseError } = await supabase
    .from('cases')
    .insert({
      client_id: client.id,
      status_id: newStatus?.id || null,
    })
    .select()
    .single()

  if (caseError) {
    console.error('Error creating case:', caseError)
    // Client was created, so don't fail completely
  }

  // 5. Create default down payment installment
  if (caseData?.id) {
    await supabase
      .from('installments')
      .insert({
        case_id: caseData.id,
        amount: 0,
        position: 1,
        is_down_payment: true,
        automatic_invoice: false,
      })
  }

  // 6. Add submission details as first comment on the case
  if (caseData?.id && submission.description) {
    // Build a detailed comment with all submission info
    const commentParts = [
      `📥 **Website Form Submission**`,
      ``,
      `**Description:**`,
      submission.description,
      ``,
      `---`,
      `**Source:** ${submission.source || 'Unknown'}`,
      `**Location:** ${[submission.city, submission.country].filter(Boolean).join(', ') || 'Unknown'}`,
    ]

    if (submission.referrer) {
      commentParts.push(`**Referrer:** ${submission.referrer}`)
    }
    if (submission.utm_campaign) {
      commentParts.push(`**Campaign:** ${submission.utm_campaign}`)
    }

    commentParts.push(`**Submitted:** ${new Date(submission.created_at).toLocaleString()}`)

    await supabase
      .from('comments')
      .insert({
        case_id: caseData.id,
        user_id: user.id,
        text: commentParts.join('\n'),
      })
  }

  // 7. Update the submission with client/case links
  await supabase
    .from('form_submissions')
    .update({
      status: 'converted',
      client_id: client.id,
      case_id: caseData?.id || null,
      processed_at: new Date().toISOString(),
      processed_by: user.id,
    })
    .eq('id', submissionId)

  revalidatePath('/leads')
  revalidatePath('/clients')
  revalidatePath('/cases')

  return {
    success: true,
    clientId: client.id,
    caseId: caseData?.id,
  }
}

/**
 * Link an existing client to a form submission
 */
export async function linkSubmissionToClient(submissionId: string, clientId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { error } = await supabase
    .from('form_submissions')
    .update({
      client_id: clientId,
      status: 'converted',
      processed_at: new Date().toISOString(),
      processed_by: user?.id,
    })
    .eq('id', submissionId)

  if (error) {
    return { error: error.message }
  }

  revalidatePath('/leads')
  return { success: true }
}
