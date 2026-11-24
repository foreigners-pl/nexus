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

export interface StagedFile { path: string; name: string; size: number; type: string }

export async function sendAssistantMessage(text: string, staged?: StagedFile[]): Promise<{ reply?: string; error?: string }> {
  const user = await me()
  if (!user) return { error: 'Not signed in' }
  const trimmed = text.trim()
  if (!trimmed) return { error: 'Empty message' }

  // Register staged uploads — only paths under this user's staging prefix
  // are honoured, so a client can't claim someone else's storage path.
  const valid = (staged || []).filter(f => f.path.startsWith(`staging/${user.id}/`))
  if (valid.length) {
    const supabase = await createClient()
    await supabase.from('bot_pending_files').insert(
      valid.map(f => ({ user_id: user.id, path: f.path, name: f.name, size: f.size, type: f.type }))
    )
  }

  const reply = await runBotTurn(user, trimmed)
  return { reply }
}

export async function getAssistantHistory(): Promise<{ messages: { role: string; text: string; created_at: string }[] }> {
  const user = await me()
  if (!user) return { messages: [] }
  return { messages: await getBotHistory(user.id) }
}
