'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

export async function addClient(formData: FormData) {
  const supabase = await createClient()

  const firstName = (formData.get('firstName') as string)?.trim() || null
  const lastName = (formData.get('lastName') as string)?.trim() || null
  const email = (formData.get('email') as string)?.trim() || null

  const data = {
    first_name: firstName,
    last_name: lastName,
    contact_email: email,
    country_of_origin: formData.get('countryId') as string | null,
    city_in_poland: formData.get('cityId') as string | null,
  }

  // Insert client
  const { data: clientData, error } = await supabase
    .from('clients')
    .insert([data])
    .select()
    .single()

  if (error) {
    return { error: error.message }
  }

  // Insert phone numbers if provided
  const phoneNumbersJson = formData.get('phoneNumbers') as string
  if (phoneNumbersJson && clientData) {
    try {
      const phoneNumbers = JSON.parse(phoneNumbersJson)
      const phoneInserts = phoneNumbers.map((phone: { number: string; isWhatsapp: boolean }) => ({
        client_id: clientData.id,
        number: phone.number,
        is_on_whatsapp: phone.isWhatsapp
      }))

      const { error: phoneError } = await supabase
        .from('contact_numbers')
        .insert(phoneInserts)

      if (phoneError) {
        console.error('Error adding phone numbers:', phoneError)
        // Don't fail the whole operation if phones fail
      }
    } catch (e) {
      console.error('Error parsing phone numbers:', e)
    }
  }

  revalidatePath('/clients')
  return { success: true }
}

export async function updateClient(id: string, formData: FormData) {
  const supabase = await createClient()

  const data = {
    first_name: formData.get('firstName') as string,
    last_name: formData.get('lastName') as string,
    contact_email: formData.get('email') as string,
  }

  const { error } = await supabase
    .from('clients')
    .update(data)
    .eq('id', id)

  if (error) {
    return { error: error.message }
  }

  revalidatePath('/clients')
  revalidatePath(`/clients/${id}`)
  return { success: true }
}

export async function deleteClient(id: string) {
  const supabase = await createClient()

  const { error } = await supabase
    .from('clients')
    .delete()
    .eq('id', id)

  if (error) {
    return { error: error.message }
  }

  revalidatePath('/clients')
  return { success: true }
}
