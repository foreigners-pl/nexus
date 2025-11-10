'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

/**
 * Interface for bulk import data row
 */
interface BulkImportRow {
  category: string
  fullName: string
  contactNumber: string
  contactMethod: string
}

/**
 * Parse full name into first name and last name
 * Everything before the first space is first name, rest is last name
 */
function parseName(fullName: string): { firstName: string; lastName: string } {
  const trimmed = fullName.trim()
  const spaceIndex = trimmed.indexOf(' ')
  
  if (spaceIndex === -1) {
    // No space found, entire string is first name
    return { firstName: trimmed, lastName: '' }
  }
  
  return {
    firstName: trimmed.substring(0, spaceIndex),
    lastName: trimmed.substring(spaceIndex + 1).trim()
  }
}

/**
 * Clean and format phone number
 */
function formatPhoneNumber(phone: string): string {
  // Remove any whitespace and common separators
  return phone.trim().replace(/[\s\-()]/g, '')
}

/**
 * Determine if phone should be marked as WhatsApp based on contact method
 */
function isWhatsAppNumber(contactMethod: string): boolean {
  return contactMethod.toLowerCase().includes('whatsapp')
}

/**
 * Bulk import clients and cases from CSV/table data
 */
export async function bulkImportClientsAndCases(rows: BulkImportRow[]) {
  const supabase = await createClient()
  
  // Get current user for comment attribution
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return { error: 'Not authenticated' }
  }

  // Get the "New" status ID for cases
  const { data: newStatus } = await supabase
    .from('status')
    .select('id')
    .eq('name', 'New')
    .single()

  if (!newStatus) {
    return { error: 'Could not find "New" status. Please create it first.' }
  }

  const results = {
    success: 0,
    failed: 0,
    errors: [] as Array<{ row: number; name: string; error: string }>
  }

  // Process each row
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]
    
    try {
      // Parse name
      const { firstName, lastName } = parseName(row.fullName)
      
      // Format phone number
      const phoneNumber = formatPhoneNumber(row.contactNumber)
      const isWhatsApp = isWhatsAppNumber(row.contactMethod)

      // Create client
      const { data: client, error: clientError } = await supabase
        .from('clients')
        .insert({
          first_name: firstName,
          last_name: lastName || null,
          contact_email: null, // No email in your data
          country_of_origin: null,
          city_in_poland: null
        })
        .select()
        .single()

      if (clientError) {
        results.failed++
        results.errors.push({
          row: i + 1,
          name: row.fullName,
          error: `Failed to create client: ${clientError.message}`
        })
        continue
      }

      // Add phone number
      const { error: phoneError } = await supabase
        .from('contact_numbers')
        .insert({
          client_id: client.id,
          number: phoneNumber,
          is_on_whatsapp: isWhatsApp
        })

      if (phoneError) {
        console.error(`Phone number error for ${row.fullName}:`, phoneError)
        // Don't fail the whole import if phone fails
      }

      // Create case for this client
      const { data: caseData, error: caseError } = await supabase
        .from('cases')
        .insert({
          client_id: client.id,
          status_id: newStatus.id,
          assigned_to: null
        })
        .select()
        .single()

      if (caseError) {
        results.failed++
        results.errors.push({
          row: i + 1,
          name: row.fullName,
          error: `Client created but case failed: ${caseError.message}`
        })
        continue
      }

      // Create default down payment installment
      await supabase
        .from('installments')
        .insert({
          case_id: caseData.id,
          amount: 0,
          position: 1,
          is_down_payment: true,
          automatic_invoice: false
        })

      // Add comment with category and contact method
      const commentText = `${row.category} - ${row.contactMethod}`
      const { error: commentError } = await supabase
        .from('comments')
        .insert({
          case_id: caseData.id,
          user_id: user.id,
          text: commentText
        })

      if (commentError) {
        console.error(`Comment error for ${row.fullName}:`, commentError)
        // Don't fail the whole import if comment fails
      }

      results.success++
    } catch (error) {
      results.failed++
      results.errors.push({
        row: i + 1,
        name: row.fullName,
        error: error instanceof Error ? error.message : 'Unknown error'
      })
    }
  }

  // Revalidate relevant paths
  revalidatePath('/clients')
  revalidatePath('/cases')

  return {
    success: true,
    results
  }
}

/**
 * Parse CSV/TSV data into rows
 */
export function parseImportData(text: string): BulkImportRow[] {
  const lines = text.trim().split('\n')
  
  // Skip header row
  const dataLines = lines.slice(1)
  
  return dataLines.map(line => {
    // Split by tab (TSV format from your table)
    const parts = line.split('\t')
    
    return {
      category: parts[0]?.trim() || '',
      fullName: parts[1]?.trim() || '',
      contactNumber: parts[2]?.trim() || '',
      contactMethod: parts[3]?.trim() || ''
    }
  }).filter(row => row.fullName) // Filter out empty rows
}
