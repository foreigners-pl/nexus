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

/**
 * Get full client details for prefetching
 */
export async function getClient(id: string) {
  const supabase = await createClient()
  
  // Fetch client with all related data in parallel
  const [clientResult, phonesResult, notesResult, casesResult] = await Promise.all([
    supabase
      .from('clients')
      .select('*, countries:country_of_origin(name), cities:city_in_poland(name)')
      .eq('id', id)
      .single(),
    supabase
      .from('contact_numbers')
      .select('*')
      .eq('client_id', id)
      .order('created_at', { ascending: true }),
    supabase
      .from('client_notes')
      .select('*')
      .eq('client_id', id)
      .order('created_at', { ascending: false }),
    supabase
      .from('cases')
      .select('*, status:status_id(*)')
      .eq('client_id', id)
      .order('created_at', { ascending: false })
  ])

  return {
    client: clientResult.data,
    phoneNumbers: phonesResult.data || [],
    notes: notesResult.data || [],
    cases: casesResult.data || [],
    countryName: clientResult.data?.countries?.name || null,
    cityName: clientResult.data?.cities?.name || null,
    error: clientResult.error?.message
  }
}

/**
 * Find clients that have conflicting data with the given client
 * Conflicts: same phone number, same email, or same first+last name
 */
export async function findConflictingClients(clientId: string) {
  const supabase = await createClient()

  // Get the current client's data
  const { data: client, error: clientError } = await supabase
    .from('clients')
    .select('*, contact_numbers(*)')
    .eq('id', clientId)
    .single()

  if (clientError || !client) {
    return { error: 'Client not found', conflicts: [] }
  }

  const conflicts: {
    client: any
    phoneNumbers: any[]
    conflictReasons: string[]
  }[] = []

  // 1. Check for matching phone numbers
  const phoneNumbers = client.contact_numbers?.map((p: any) => p.number) || []
  if (phoneNumbers.length > 0) {
    const { data: matchingPhones } = await supabase
      .from('contact_numbers')
      .select('client_id, number')
      .in('number', phoneNumbers)
      .neq('client_id', clientId)

    if (matchingPhones && matchingPhones.length > 0) {
      const clientIds = [...new Set(matchingPhones.map(p => p.client_id))]
      for (const id of clientIds) {
        const { data: conflictClient } = await supabase
          .from('clients')
          .select('*, contact_numbers(*)')
          .eq('id', id)
          .single()

        if (conflictClient) {
          const matchedNumbers = matchingPhones
            .filter(p => p.client_id === id)
            .map(p => p.number)
          
          conflicts.push({
            client: conflictClient,
            phoneNumbers: conflictClient.contact_numbers || [],
            conflictReasons: [`Same phone: ${matchedNumbers.join(', ')}`]
          })
        }
      }
    }
  }

  // 2. Check for matching email
  if (client.contact_email) {
    const { data: matchingEmail } = await supabase
      .from('clients')
      .select('*, contact_numbers(*)')
      .eq('contact_email', client.contact_email)
      .neq('id', clientId)

    if (matchingEmail) {
      for (const c of matchingEmail) {
        const existing = conflicts.find(con => con.client.id === c.id)
        if (existing) {
          existing.conflictReasons.push(`Same email: ${client.contact_email}`)
        } else {
          conflicts.push({
            client: c,
            phoneNumbers: c.contact_numbers || [],
            conflictReasons: [`Same email: ${client.contact_email}`]
          })
        }
      }
    }
  }

  // 3. Check for matching first AND last name (both must match)
  if (client.first_name && client.last_name) {
    const { data: matchingName } = await supabase
      .from('clients')
      .select('*, contact_numbers(*)')
      .eq('first_name', client.first_name)
      .eq('last_name', client.last_name)
      .neq('id', clientId)

    if (matchingName) {
      for (const c of matchingName) {
        const existing = conflicts.find(con => con.client.id === c.id)
        if (existing) {
          existing.conflictReasons.push(`Same name: ${client.first_name} ${client.last_name}`)
        } else {
          conflicts.push({
            client: c,
            phoneNumbers: c.contact_numbers || [],
            conflictReasons: [`Same name: ${client.first_name} ${client.last_name}`]
          })
        }
      }
    }
  }

  return { conflicts, currentClient: client }
}

/**
 * Merge two clients - transfers data from secondary to main, then deletes secondary
 */
export async function mergeClients(mainClientId: string, secondaryClientId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return { error: 'Not authenticated' }
  }

  // Get both clients with their data
  const [mainResult, secondaryResult] = await Promise.all([
    supabase
      .from('clients')
      .select('*, contact_numbers(*)')
      .eq('id', mainClientId)
      .single(),
    supabase
      .from('clients')
      .select('*, contact_numbers(*)')
      .eq('id', secondaryClientId)
      .single()
  ])

  const mainClient = mainResult.data
  const secondaryClient = secondaryResult.data

  if (!mainClient || !secondaryClient) {
    return { error: 'One or both clients not found' }
  }

  // Build merge comment with secondary client's details before deletion
  const secondaryDetails = [
    `🔀 **Merged with client record**`,
    ``,
    `The following client record was merged into this one:`,
    `- **Client Code:** ${secondaryClient.client_code || 'N/A'}`,
    `- **Name:** ${[secondaryClient.first_name, secondaryClient.last_name].filter(Boolean).join(' ') || 'N/A'}`,
    `- **Email:** ${secondaryClient.contact_email || 'N/A'}`,
    `- **Phone(s):** ${secondaryClient.contact_numbers?.map((p: any) => p.number).join(', ') || 'N/A'}`,
    `- **Created:** ${new Date(secondaryClient.created_at).toLocaleDateString()}`,
  ]

  // 1. Update main client with missing fields from secondary
  const updates: Record<string, any> = {}
  
  if (!mainClient.first_name && secondaryClient.first_name) {
    updates.first_name = secondaryClient.first_name
    secondaryDetails.push(`- Transferred first name: ${secondaryClient.first_name}`)
  }
  if (!mainClient.last_name && secondaryClient.last_name) {
    updates.last_name = secondaryClient.last_name
    secondaryDetails.push(`- Transferred last name: ${secondaryClient.last_name}`)
  }
  if (!mainClient.contact_email && secondaryClient.contact_email) {
    updates.contact_email = secondaryClient.contact_email
    secondaryDetails.push(`- Transferred email: ${secondaryClient.contact_email}`)
  }
  if (!mainClient.country_of_origin && secondaryClient.country_of_origin) {
    updates.country_of_origin = secondaryClient.country_of_origin
    secondaryDetails.push(`- Transferred country`)
  }
  if (!mainClient.city_in_poland && secondaryClient.city_in_poland) {
    updates.city_in_poland = secondaryClient.city_in_poland
    secondaryDetails.push(`- Transferred city`)
  }
  if (!mainClient.stripe_customer_id && secondaryClient.stripe_customer_id) {
    updates.stripe_customer_id = secondaryClient.stripe_customer_id
  }

  if (Object.keys(updates).length > 0) {
    await supabase
      .from('clients')
      .update(updates)
      .eq('id', mainClientId)
  }

  // 2. Transfer phone numbers that don't exist on main
  const mainPhones = mainClient.contact_numbers?.map((p: any) => p.number) || []
  const phonesToTransfer = secondaryClient.contact_numbers?.filter(
    (p: any) => !mainPhones.includes(p.number)
  ) || []

  if (phonesToTransfer.length > 0) {
    for (const phone of phonesToTransfer) {
      await supabase
        .from('contact_numbers')
        .update({ client_id: mainClientId })
        .eq('id', phone.id)
      secondaryDetails.push(`- Transferred phone: ${phone.number}`)
    }
  }

  // 3. Transfer cases from secondary to main
  const { data: secondaryCases } = await supabase
    .from('cases')
    .select('id, case_code')
    .eq('client_id', secondaryClientId)

  if (secondaryCases && secondaryCases.length > 0) {
    await supabase
      .from('cases')
      .update({ client_id: mainClientId })
      .eq('client_id', secondaryClientId)
    secondaryDetails.push(`- Transferred ${secondaryCases.length} case(s): ${secondaryCases.map(c => c.case_code).join(', ')}`)
  }

  // 4. Transfer client notes from secondary to main
  const { data: secondaryNotes } = await supabase
    .from('client_notes')
    .select('id')
    .eq('client_id', secondaryClientId)

  if (secondaryNotes && secondaryNotes.length > 0) {
    await supabase
      .from('client_notes')
      .update({ client_id: mainClientId })
      .eq('client_id', secondaryClientId)
    secondaryDetails.push(`- Transferred ${secondaryNotes.length} note(s)`)
  }

  // 5. Transfer client documents from secondary to main
  const { data: secondaryDocs } = await supabase
    .from('client_documents')
    .select('id')
    .eq('client_id', secondaryClientId)

  if (secondaryDocs && secondaryDocs.length > 0) {
    await supabase
      .from('client_documents')
      .update({ client_id: mainClientId })
      .eq('client_id', secondaryClientId)
    secondaryDetails.push(`- Transferred ${secondaryDocs.length} document(s)`)
  }

  // 6. Update form_submissions that pointed to secondary
  await supabase
    .from('form_submissions')
    .update({ client_id: mainClientId })
    .eq('client_id', secondaryClientId)

  // 7. Add merge note to main client
  await supabase
    .from('client_notes')
    .insert({
      client_id: mainClientId,
      user_id: user.id,
      note: secondaryDetails.join('\n'),
    })

  // 8. Delete remaining phone numbers on secondary (duplicates)
  await supabase
    .from('contact_numbers')
    .delete()
    .eq('client_id', secondaryClientId)

  // 9. Delete secondary client
  const { error: deleteError } = await supabase
    .from('clients')
    .delete()
    .eq('id', secondaryClientId)

  if (deleteError) {
    console.error('Error deleting secondary client:', deleteError)
    return { error: 'Merge completed but failed to delete secondary client' }
  }

  revalidatePath('/clients')
  revalidatePath(`/clients/${mainClientId}`)

  return { success: true }
}
