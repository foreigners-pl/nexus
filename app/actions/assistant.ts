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

/** UTC instant of the start of the user's current local day. */
function todayStartUtc(offsetMinutes: number): string {
  const localNow = Date.now() - offsetMinutes * 60000
  const dayStart = Math.floor(localNow / 86400000) * 86400000
  return new Date(dayStart + offsetMinutes * 60000).toISOString()
}

/** YYYY-MM-DD of a timestamp in the user's local timezone. */
function localDateKey(iso: string, offsetMinutes: number): string {
  return new Date(new Date(iso).getTime() - offsetMinutes * 60000).toISOString().slice(0, 10)
}

export async function sendAssistantMessage(text: string, staged?: StagedFile[], tzOffset = 0): Promise<{ reply?: string; error?: string }> {
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

  const reply = await runBotTurn(user, trimmed, todayStartUtc(tzOffset))
  return { reply }
}

/** Today's session only — older days live under Sessions. */
export async function getAssistantHistory(tzOffset = 0): Promise<{ messages: { role: string; text: string; created_at: string }[] }> {
  const user = await me()
  if (!user) return { messages: [] }
  return { messages: await getBotHistory(user.id, todayStartUtc(tzOffset)) }
}

/** Session list — one entry per local day that has messages. */
export async function getAssistantSessions(tzOffset = 0): Promise<{ sessions: { date: string; count: number }[] }> {
  const user = await me()
  if (!user) return { sessions: [] }
  const supabase = await createClient()
  const { data } = await supabase
    .from('bot_messages')
    .select('created_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(2000)
  const byDay = new Map<string, number>()
  for (const m of data || []) {
    const key = localDateKey(m.created_at, tzOffset)
    byDay.set(key, (byDay.get(key) || 0) + 1)
  }
  return { sessions: [...byDay.entries()].map(([date, count]) => ({ date, count })) }
}

/** One past session's messages, oldest first. */
export async function getAssistantSession(date: string, tzOffset = 0): Promise<{ messages: { role: string; text: string; created_at: string }[] }> {
  const user = await me()
  if (!user) return { messages: [] }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return { messages: [] }
  const supabase = await createClient()
  const { data } = await supabase
    .from('bot_messages')
    .select('role, text, created_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(500)
  const messages = (data || [])
    .filter(m => localDateKey(m.created_at, tzOffset) === date)
    .reverse()
  return { messages }
}
