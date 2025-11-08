'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

export async function addNote(clientId: string, note: string) {
  const supabase = await createClient()

  // Get current user (optional - for future use)
  const { data: { user } } = await supabase.auth.getUser()

  const { error } = await supabase
    .from('client_notes')
    .insert([{
      client_id: clientId,
      user_id: user?.id || null, // Make it nullable for now
      note: note
    }])

  if (error) {
    return { error: error.message }
  }

  revalidatePath(`/clients/${clientId}`)
  return { success: true }
}

export async function deleteNote(noteId: string, clientId: string) {
  const supabase = await createClient()

  const { error } = await supabase
    .from('client_notes')
    .delete()
    .eq('id', noteId)

  if (error) {
    return { error: error.message }
  }

  revalidatePath(`/clients/${clientId}`)
  return { success: true }
}

export async function togglePinNote(noteId: string, clientId: string, isPinned: boolean) {
  const supabase = await createClient()

  const { error } = await supabase
    .from('client_notes')
    .update({ is_pinned: !isPinned })
    .eq('id', noteId)

  if (error) {
    return { error: error.message }
  }

  revalidatePath(`/clients/${clientId}`)
  return { success: true }
}
