'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

export async function addPhoneNumber(clientId: string, number: string, isOnWhatsapp: boolean) {
  const supabase = await createClient()

  const { error } = await supabase
    .from('contact_numbers')
    .insert([{
      client_id: clientId,
      number: number,
      is_on_whatsapp: isOnWhatsapp
    }])

  if (error) {
    return { error: error.message }
  }

  revalidatePath(`/clients/${clientId}`)
  return { success: true }
}

export async function deletePhoneNumber(phoneId: string, clientId: string) {
  const supabase = await createClient()

  const { error } = await supabase
    .from('contact_numbers')
    .delete()
    .eq('id', phoneId)

  if (error) {
    return { error: error.message }
  }

  revalidatePath(`/clients/${clientId}`)
  return { success: true }
}

export async function updatePhoneNumber(phoneId: string, clientId: string, number: string) {
  const supabase = await createClient()

  const { error } = await supabase
    .from('contact_numbers')
    .update({ number })
    .eq('id', phoneId)

  if (error) {
    return { error: error.message }
  }

  revalidatePath(`/clients/${clientId}`)
  return { success: true }
}

export async function updateWhatsAppStatus(phoneId: string, clientId: string, isOnWhatsapp: boolean) {
  const supabase = await createClient()

  const { error } = await supabase
    .from('contact_numbers')
    .update({ is_on_whatsapp: isOnWhatsapp })
    .eq('id', phoneId)

  if (error) {
    return { error: error.message }
  }

  revalidatePath(`/clients/${clientId}`)
  return { success: true }
}
