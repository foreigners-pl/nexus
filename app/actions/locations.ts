'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function getAllCountries() {
  const supabase = await createClient()
  
  const { data, error } = await supabase
    .from('countries')
    .select('id, country')
    .order('country', { ascending: true })
  
  if (error) {
    console.error('Error fetching countries:', error)
    return []
  }
  
  return data || []
}

export async function getAllCities() {
  const supabase = await createClient()
  
  const { data, error } = await supabase
    .from('cities')
    .select('id, city')
    .order('city', { ascending: true })
  
  if (error) {
    console.error('Error fetching cities:', error)
    return []
  }
  
  return data || []
}

export async function updateClientLocation(
  clientId: string,
  countryId: string | null,
  cityId: string | null
) {
  const supabase = await createClient()
  
  const { error } = await supabase
    .from('clients')
    .update({
      country_of_origin: countryId,
      city_in_poland: cityId
    })
    .eq('id', clientId)
  
  if (error) {
    console.error('Error updating client location:', error)
    throw error
  }
  
  revalidatePath(`/clients/${clientId}`)
}
