'use server'

import { createClient } from '@/lib/supabase/server'

export interface ClientSearchResult {
  id: string
  first_name: string | null
  last_name: string | null
  contact_email: string | null
  phones: string[]
}

interface ClientRow {
  id: string
  first_name: string | null
  last_name: string | null
  contact_email: string | null
  contact_numbers: { number: string }[] | null
}

const CLIENT_SELECT = 'id, first_name, last_name, contact_email, contact_numbers(number)'

/**
 * Search clients by first name, last name, email, or phone number.
 * Used by the mobile search panel (limit 5) and the full results page (limit 50).
 */
export async function searchClients(query: string, limit = 5): Promise<{ results: ClientSearchResult[]; error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return { results: [], error: 'Not authenticated' }

  const q = query.trim()
  if (!q) return { results: [] }

  const pattern = `%${q}%`
  const digits = q.replace(/\D/g, '')
  const digitPattern = digits.length >= 3 ? `%${digits}%` : null

  // Clients matching on name or email
  const clientOr = [
    `first_name.ilike.${pattern}`,
    `last_name.ilike.${pattern}`,
    `contact_email.ilike.${pattern}`,
  ].join(',')

  const { data: byClient, error } = await supabase
    .from('clients')
    .select(CLIENT_SELECT)
    .or(clientOr)
    .limit(limit)

  if (error) return { results: [], error: error.message }

  // Clients matching via the contact_numbers table.
  // Normalize digits so "+48 600-123-456" still finds a number stored as
  // "48600123456", and the last 9 digits catch numbers stored without a
  // country code prefix.
  const phonePatterns = [...new Set(
    [digits, digits.slice(-9)]
      .filter(d => d.length >= 3)
      .map(d => `%${d}%`)
  )]
  const { data: phoneMatches } = phonePatterns.length > 0
    ? await supabase
        .from('contact_numbers')
        .select('client_id')
        .or(phonePatterns.map(p => `number.ilike.${p}`).join(','))
        .limit(limit)
    : { data: null }

  let byPhone: ClientRow[] = []
  const phoneClientIds = [...new Set((phoneMatches || []).map(p => p.client_id))]
    .filter(id => !(byClient || []).some(c => c.id === id))

  if (phoneClientIds.length > 0) {
    const { data } = await supabase
      .from('clients')
      .select(CLIENT_SELECT)
      .in('id', phoneClientIds)
      .limit(limit)
    byPhone = (data || []) as ClientRow[]
  }

  const merged = [...(byClient || []), ...byPhone].slice(0, limit) as ClientRow[]

  return {
    results: merged.map(c => ({
      id: c.id,
      first_name: c.first_name,
      last_name: c.last_name,
      contact_email: c.contact_email,
      phones: (c.contact_numbers || []).map(p => p.number),
    }))
  }
}
