'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function getCompanySettings() {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('company_settings')
    .select('*')
    .limit(1)
    .maybeSingle()

  if (error) {
    console.error('Error fetching company settings:', error)
    return { error: 'Failed to fetch company settings' }
  }
  return { settings: data }
}

export async function updateCompanySettings(fields: {
  company_name?: string
  address?: string
  tax_id?: string
  email?: string
  phone?: string
  bank_name?: string
  bank_account?: string
  swift?: string
}) {
  const supabase = await createClient()

  const { data: existing } = await supabase
    .from('company_settings')
    .select('id')
    .limit(1)
    .maybeSingle()

  const query = existing
    ? supabase.from('company_settings').update({ ...fields, updated_at: new Date().toISOString() }).eq('id', existing.id)
    : supabase.from('company_settings').insert(fields)

  const { error } = await query
  if (error) {
    console.error('Error saving company settings:', error)
    return { error: 'Failed to save company settings' }
  }
  revalidatePath('/settings')
  return { success: true }
}
