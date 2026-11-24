'use server'

import { createClient } from '@/lib/supabase/server'
import { runBotTurn, getBotHistory } from '@/lib/bot/chat'
import type { BotUser } from '@/lib/bot/tools'

async function me(): Promise<BotUser | null> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data } = await supabase
    .from('users')
    .select('id, display_name, email')
    .eq('id', user.id)
    .single()
  return (data as BotUser | null) ?? null
}

export async function sendAssistantMessage(text: string): Promise<{ reply?: string; error?: string }> {
  const user = await me()
  if (!user) return { error: 'Not signed in' }
  const trimmed = text.trim()
  if (!trimmed) return { error: 'Empty message' }
  const reply = await runBotTurn(user, trimmed)
  return { reply }
}

export async function getAssistantHistory(): Promise<{ messages: { role: string; text: string; created_at: string }[] }> {
  const user = await me()
  if (!user) return { messages: [] }
  return { messages: await getBotHistory(user.id) }
}
