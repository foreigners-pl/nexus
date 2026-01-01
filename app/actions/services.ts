'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function addServiceToCase(caseId: string, serviceId: string, customPrice?: number) {
  const supabase = await createClient()

  // Get the service details to get the price
  const { data: service, error: serviceError } = await supabase
    .from('services')
    .select('gross_price')
    .eq('id', serviceId)
    .single()

  if (serviceError) {
    console.error('Error fetching service:', serviceError)
    return { error: 'Failed to fetch service details' }
  }

  // Determine the price to use (custom price or service's gross price)
  const priceToUse = customPrice ?? service?.gross_price

  // Add the service to the case
  const { error } = await supabase
    .from('case_services')
    .insert({
      case_id: caseId,
      service_id: serviceId,
      custom_price: customPrice ?? null,
    })

  if (error) {
    console.error('Error adding service to case:', error)
    return { error: 'Failed to add service' }
  }

  // If we have a price (custom or from service), add it to the down payment installment
  if (priceToUse && priceToUse > 0) {
    // Get the down payment installment
    const { data: downPayment, error: dpError } = await supabase
      .from('installments')
      .select('id, amount')
      .eq('case_id', caseId)
      .eq('is_down_payment', true)
      .single()

    if (!dpError && downPayment) {
      // Update the down payment amount
      const currentAmount = downPayment.amount || 0
      const newAmount = currentAmount + priceToUse

      await supabase
        .from('installments')
        .update({ amount: newAmount })
        .eq('id', downPayment.id)
    }
  }

  revalidatePath(`/cases/${caseId}`)
  return { success: true }
}

export async function removeServiceFromCase(caseServiceId: string, caseId: string) {
  const supabase = await createClient()

  // Get the case service to get the service details and custom price
  const { data: caseService, error: csError } = await supabase
    .from('case_services')
    .select('service_id, custom_price, services(gross_price)')
    .eq('id', caseServiceId)
    .single()

  if (csError) {
    console.error('Error fetching case service:', csError)
    return { error: 'Failed to fetch service details' }
  }

  // Delete the case service
  const { error } = await supabase
    .from('case_services')
    .delete()
    .eq('id', caseServiceId)

  if (error) {
    console.error('Error removing service from case:', error)
    return { error: 'Failed to remove service' }
  }

  // If the service had a price (custom or gross), subtract it from the down payment
  const priceToSubtract = caseService?.custom_price ?? (caseService as any)?.services?.gross_price
  if (priceToSubtract && priceToSubtract > 0) {
    // Get the down payment installment
    const { data: downPayment, error: dpError } = await supabase
      .from('installments')
      .select('id, amount')
      .eq('case_id', caseId)
      .eq('is_down_payment', true)
      .single()

    if (!dpError && downPayment) {
      // Update the down payment amount
      const currentAmount = downPayment.amount || 0
      const newAmount = Math.max(0, currentAmount - priceToSubtract)

      await supabase
        .from('installments')
        .update({ amount: newAmount })
        .eq('id', downPayment.id)
    }
  }

  revalidatePath(`/cases/${caseId}`)
  return { success: true }
}

export async function getAllServices() {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('services')
    .select('*')
    .order('name', { ascending: true })

  if (error) {
    console.error('Error fetching services:', error)
    return []
  }

  return data || []
}
