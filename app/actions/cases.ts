'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { logActivity, logActivityForUsers } from './dashboard'
import { ensureSystemSteps, setInitialStep, generateStepsForService } from './workflow'
import { notifyUsers } from './notifications'

// Everything the case detail page needs in one round trip — the sub-queries
// run in parallel server-side instead of as a client waterfall.
export async function getCasePageData(idOrCode: string) {
  const supabase = await createClient()

  const [{ data: { user } }, caseRes] = await Promise.all([
    supabase.auth.getUser(),
    idOrCode.startsWith('C')
      ? supabase.from('cases').select('*').eq('case_code', idOrCode).single()
      : supabase.from('cases').select('*').eq('id', idOrCode).single(),
  ])

  const caseData = caseRes.data
  if (!caseData) return { error: 'Case not found' as const }

  const [clientRes, phonesRes, serviceRes, stepRes, installmentsRes, attachmentsRes, commentsCountRes] = await Promise.all([
    caseData.client_id
      ? supabase.from('clients').select('*').eq('id', caseData.client_id).single()
      : Promise.resolve({ data: null }),
    caseData.client_id
      ? supabase.from('contact_numbers').select('*').eq('client_id', caseData.client_id).order('number')
      : Promise.resolve({ data: null }),
    supabase.from('case_services').select('services(name)').eq('case_id', caseData.id).limit(1).maybeSingle(),
    caseData.current_step_id
      ? supabase.from('case_steps').select('name').eq('id', caseData.current_step_id).maybeSingle()
      : Promise.resolve({ data: null }),
    supabase.from('installments').select('amount, paid, parent_installment_id').eq('case_id', caseData.id),
    supabase.from('case_attachments').select('id', { count: 'exact', head: true }).eq('case_id', caseData.id),
    supabase.from('comments').select('id', { count: 'exact', head: true }).eq('case_id', caseData.id),
  ])

  const svc = (serviceRes.data?.services as { name?: string } | null)?.name || ''
  const inst = (installmentsRes.data || []) as { amount: number; paid: boolean; parent_installment_id?: string }[]

  return {
    currentUserId: user?.id,
    case: caseData,
    client: clientRes.data,
    phones: phonesRes.data || [],
    serviceName: svc,
    currentStepName: (stepRes.data as { name?: string } | null)?.name || '',
    paidAmount: inst.filter(i => i.paid && !i.parent_installment_id).reduce((sum, i) => sum + (i.amount || 0), 0),
    fileCount: attachmentsRes.count || 0,
    commentsCount: commentsCountRes.count || 0,
  }
}

// Lighter bundle for the progress/billing/files headers — case + client basics.
export async function getCaseHeaderData(idOrCode: string) {
  const supabase = await createClient()

  const select = 'id, case_code, client_id, case_services!fk_case_services_case(services(name))'
  const { data: caseRow } = idOrCode.startsWith('C')
    ? await supabase.from('cases').select(select).eq('case_code', idOrCode).single()
    : await supabase.from('cases').select(select).eq('id', idOrCode).single()

  if (!caseRow) return { error: 'Case not found' as const }

  const svc = (caseRow.case_services as { services?: { name?: string } }[] | null)?.[0]?.services?.name || null
  let clientName = ''
  let phone = ''
  if (caseRow.client_id) {
    const [clientRes, phoneRes] = await Promise.all([
      supabase.from('clients').select('first_name, last_name, contact_email').eq('id', caseRow.client_id).single(),
      supabase.from('contact_numbers').select('country_code, number').eq('client_id', caseRow.client_id).limit(1).maybeSingle(),
    ])
    const c = clientRes.data
    clientName = c ? ([c.first_name, c.last_name].filter(Boolean).join(' ') || c.contact_email || '') : ''
    phone = phoneRes.data ? `${phoneRes.data.country_code || ''} ${phoneRes.data.number}`.trim() : ''
  }

  return {
    caseId: caseRow.id as string,
    clientId: (caseRow.client_id as string | null) ?? null,
    caseCode: (caseRow.case_code as string) || 'Case',
    clientName: clientName || '',
    title: clientName || (caseRow.case_code as string) || 'Case',
    subtitle: [svc, phone].filter(Boolean).join(' · '),
    serviceName: svc || '',
    phone,
  }
}

export async function addCase(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const clientId = formData.get('clientId') as string
  let statusId = formData.get('statusId') as string | null
  const assignedTo = formData.get('assignedTo') as string | null
  const serviceId = formData.get('serviceId') as string | null

  if (!clientId) {
    return { error: 'Client ID is required' }
  }

  // If no status is provided, get the "New" status
  if (!statusId) {
    const { data: newStatus } = await supabase
      .from('status')
      .select('id')
      .eq('name', 'New')
      .single()
    
    if (newStatus) {
      statusId = newStatus.id
    }
  }

  const { data, error } = await supabase
    .from('cases')
    .insert({
      client_id: clientId,
      status_id: statusId,
      assigned_to: assignedTo,
      csr_id: user?.id || null,
    })
    .select(`
      *,
      clients(first_name, last_name)
    `)
    .single()

  if (error) {
    console.error('Error creating case:', error)
    return { error: 'Failed to create case' }
  }

  if (data?.id) {
    // Keep case_assignees in sync with the two role fields (drives notifications)
    const repIds = [...new Set([data.csr_id, data.assigned_to].filter(Boolean) as string[])]
    for (const uid of repIds) {
      await supabase.from('case_assignees').insert({ case_id: data.id, user_id: uid })
    }

    // Initialize the workflow: Pre-sale + Consultation steps, active at Pre-sale
    await ensureSystemSteps(data.id)
    await setInitialStep(data.id)

    // Attach the selected service and copy its step template onto the case
    if (serviceId) {
      await supabase
        .from('case_services')
        .insert({ case_id: data.id, service_id: serviceId })
      await generateStepsForService(data.id, serviceId)
    }

    // setInitialStep ran after the insert — pull the current step onto the returned row
    const { data: refreshed } = await supabase
      .from('cases')
      .select('current_step_id')
      .eq('id', data.id)
      .single()
    if (refreshed) data.current_step_id = refreshed.current_step_id
  }

  revalidatePath('/cases')
  revalidatePath(`/clients/${clientId}`)
  
  return { success: true, caseData: data }
}

export async function updateCase(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const caseId = formData.get('caseId') as string
  const statusId = formData.get('statusId') as string | null
  const assignedTo = formData.get('assignedTo') as string | null
  const csrId = formData.get('csrId') as string | null
  const dueDate = formData.get('dueDate') as string | null

  if (!caseId) {
    return { error: 'Case ID is required' }
  }

  const { data: caseData } = await supabase
    .from('cases')
    .select('case_code, due_date, assigned_to, csr_id, clients(first_name, last_name)')
    .eq('id', caseId)
    .single()

  const client = caseData?.clients as any
  const clientName = client
    ? `${client.first_name || ''} ${client.last_name || ''}`.trim() || 'Unknown'
    : 'Unknown'

  const updateData: any = {}
  if (statusId !== null) updateData.status_id = statusId
  if (assignedTo !== null) updateData.assigned_to = assignedTo || null
  if (csrId !== null) updateData.csr_id = csrId || null
  if (dueDate !== undefined) updateData.due_date = dueDate || null

  const { error } = await supabase
    .from('cases')
    .update(updateData)
    .eq('id', caseId)

  if (error) {
    console.error('Error updating case:', error)
    return { error: 'Failed to update case' }
  }

  // Keep case_assignees in sync with the role fields so they keep
  // getting notifications (logActivityForUsers reads case_assignees).
  const repIds = [updateData.assigned_to, updateData.csr_id].filter(Boolean) as string[]
  for (const uid of repIds) {
    const { data: existing } = await supabase
      .from('case_assignees')
      .select('id')
      .eq('case_id', caseId)
      .eq('user_id', uid)
      .limit(1)
    if (!existing?.length) {
      await supabase.from('case_assignees').insert({ case_id: caseId, user_id: uid })
    }
  }

  revalidatePath('/cases')
  revalidatePath(`/cases/${caseId}`)

  const caseLabel = clientName !== 'Unknown' ? clientName : caseData?.case_code || 'a case'
  const newlyAssigned = [
    assignedTo !== null && assignedTo && assignedTo !== caseData?.assigned_to ? assignedTo : null,
    csrId !== null && csrId && csrId !== caseData?.csr_id ? csrId : null,
  ].filter(Boolean) as string[]
  if (newlyAssigned.length) {
    await notifyUsers(newlyAssigned, {
      kind: 'task',
      title: `Assigned to ${caseLabel}`,
      body: `You were assigned to case ${caseData?.case_code || ''}`.trim(),
      link: `/cases/${caseId}`,
      caseId,
    })
  }

  // Log due date change if it actually changed
  if (caseData && dueDate !== undefined) {
    const newDueDate = dueDate || null
    if (newDueDate !== caseData.due_date) {
      const { data: assignees } = await supabase
        .from('case_assignees')
        .select('user_id')
        .eq('case_id', caseId)

      const assigneeIds = assignees?.map(a => a.user_id) || []
      if (assigneeIds.length > 0) {
        await logActivityForUsers({
          userIds: assigneeIds,
          actorId: user?.id,
          actionType: 'case_due_date_changed',
          entityType: 'case',
          entityId: caseId,
          message: `Due date changed for case ${caseData.case_code || ''}`,
          metadata: {
            case_code: caseData.case_code,
            client_name: clientName,
            old_due_date: caseData.due_date,
            new_due_date: newDueDate,
          }
        })
      }
    }
  }

  return { success: true }
}

export async function deleteCase(caseId: string) {
  const supabase = await createClient()

  const { error } = await supabase
    .from('cases')
    .delete()
    .eq('id', caseId)

  if (error) {
    console.error('Error deleting case:', error)
    return { error: 'Failed to delete case' }
  }

  revalidatePath('/cases')
  
  return { success: true }
}

export async function updateCaseStatus(caseId: string, statusId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  // Get current case info before update
  const { data: caseData } = await supabase
    .from('cases')
    .select(`
      case_code,
      status_id,
      status:status_id(name),
      clients(first_name, last_name)
    `)
    .eq('id', caseId)
    .single()

  // Get new status name
  const { data: newStatus } = await supabase
    .from('status')
    .select('name')
    .eq('id', statusId)
    .single()

  const { error } = await supabase
    .from('cases')
    .update({ status_id: statusId })
    .eq('id', caseId)

  if (error) {
    console.error('Error updating case status:', error)
    return { error: 'Failed to update case status' }
  }

  // Log status change for all assignees
  if (caseData && newStatus) {
    const { data: assignees } = await supabase
      .from('case_assignees')
      .select('user_id')
      .eq('case_id', caseId)

    const assigneeIds = assignees?.map(a => a.user_id) || []
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const client = caseData.clients as any
    const clientName = client 
      ? `${client.first_name || ''} ${client.last_name || ''}`.trim() || 'Unknown'
      : 'Unknown'
    const oldStatusName = (caseData.status as any)?.name || 'Unknown'

    await logActivityForUsers({
      userIds: assigneeIds,
      actorId: user?.id,
      actionType: 'case_status_changed',
      entityType: 'case',
      entityId: caseId,
      message: `Case ${caseData.case_code || ''} moved to "${newStatus.name}"`,
      metadata: {
        case_code: caseData.case_code,
        client_name: clientName,
        old_status: oldStatusName,
        new_status: newStatus.name,
      }
    })
  }

  revalidatePath('/cases')
  revalidatePath(`/cases/${caseId}`)
  revalidatePath('/board/00000000-0000-0000-0000-000000000001')
  
  return { success: true }
}

export async function moveCase(caseId: string, newStatusId: string, newPosition: number) {
  const supabase = await createClient()

  const { error } = await supabase
    .from('cases')
    .update({ 
      status_id: newStatusId,
      position: newPosition
    })
    .eq('id', caseId)

  if (error) {
    console.error('Error moving case:', error)
    return { error: 'Failed to move case' }
  }
  
  return { success: true }
}
