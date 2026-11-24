'use server'

import { createClient } from '@/lib/supabase/server'

/** Messenger bot link status for the current user. */
export async function getMessengerStatus() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const { data } = await supabase
    .from('users')
    .select('messenger_psid, messenger_code, messenger_code_at')
    .eq('id', user.id)
    .single()

  const codeValid = data?.messenger_code_at && new Date(data.messenger_code_at).getTime() > Date.now() - 15 * 60 * 1000
  return {
    linked: !!data?.messenger_psid,
    code: codeValid ? data.messenger_code : null,
  }
}

/** Generate a 6-char link code (valid 15 min) the user sends to the bot. */
export async function generateMessengerCode() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const code = Math.random().toString(36).slice(2, 8).toUpperCase().replace(/[^A-Z0-9]/g, 'X')
  const { error } = await supabase
    .from('users')
    .update({ messenger_code: code, messenger_code_at: new Date().toISOString() })
    .eq('id', user.id)
  if (error) return { error: 'Failed to generate code' }
  return { code }
}

export async function disconnectMessenger() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const { error } = await supabase
    .from('users')
    .update({ messenger_psid: null, messenger_code: null, messenger_code_at: null })
    .eq('id', user.id)
  if (error) return { error: 'Failed to disconnect' }
  return { success: true }
}
