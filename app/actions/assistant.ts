'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { runBotTurn, getBotHistory, transcribeAudio } from '@/lib/bot/chat'
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
  // Admin client: bot_pending_files has RLS enabled with no policies
  // (server-only table) — a session insert would be silently rejected.
  const valid = (staged || []).filter(f => f.path.startsWith(`staging/${user.id}/`))
  if (valid.length) {
    const supabase = createAdminClient()
    await supabase.from('bot_pending_files').insert(
      valid.map(f => ({ user_id: user.id, path: f.path, name: f.name, size: f.size, type: f.type }))
    )
  }

  const reply = await runBotTurn(user, trimmed, todayStartUtc(tzOffset))
  return { reply }
}

/** Voice message → transcript → normal turn. The audio stays attached to
 *  the user's message row for playback. */
export async function sendAssistantVoice(path: string, mime: string, tzOffset = 0): Promise<{ reply?: string; transcript?: string; error?: string }> {
  const user = await me()
  if (!user) return { error: 'Not signed in' }
  if (!path.startsWith(`staging/${user.id}/`)) return { error: 'Invalid audio' }

  const supabase = createAdminClient()
  const { data: blob, error: dlErr } = await supabase.storage.from('case_attachments').download(path)
  if (dlErr || !blob) return { error: 'Audio upload missing' }

  const base64 = Buffer.from(await blob.arrayBuffer()).toString('base64')
  let transcript = ''
  let extraCalls = 0
  let extraTokens = 0
  try {
    const tr = await transcribeAudio(mime, base64)
    transcript = tr.text
    extraCalls = tr.calls
    extraTokens = tr.tokens
  } catch (e: any) {
    return { error: `Couldn't transcribe (${String(e?.message || e).slice(0, 120)})` }
  }
  if (!transcript) return { error: "Couldn't make out the audio — try again?" }

  const reply = await runBotTurn(user, transcript, todayStartUtc(tzOffset), {
    audioPath: path, extraCalls, extraTokens,
  })
  return { reply, transcript }
}

/** Short-lived playback URL for a staged voice message. */
export async function getAssistantAudioUrl(path: string): Promise<{ url?: string; error?: string }> {
  const user = await me()
  if (!user) return { error: 'Not signed in' }
  if (!path.startsWith(`staging/${user.id}/`)) return { error: 'Invalid audio' }
  const supabase = createAdminClient()
  const { data, error } = await supabase.storage.from('case_attachments').createSignedUrl(path, 3600)
  return error || !data ? { error: 'No audio' } : { url: data.signedUrl }
}

/** Today's session only — older days live under Sessions. */
export async function getAssistantHistory(tzOffset = 0): Promise<{ messages: { role: string; text: string; created_at: string; audio_path: string | null }[] }> {
  const user = await me()
  if (!user) return { messages: [] }
  return { messages: await getBotHistory(user.id, todayStartUtc(tzOffset)) }
}

/** Session list — one entry per local day that has messages. */
export async function getAssistantSessions(tzOffset = 0): Promise<{ sessions: { date: string; count: number; tokens: number }[] }> {
  const user = await me()
  if (!user) return { sessions: [] }
  const supabase = await createClient()
  const { data } = await supabase
    .from('bot_messages')
    .select('created_at, tokens')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(2000)
  const byDay = new Map<string, { count: number; tokens: number }>()
  for (const m of data || []) {
    const key = localDateKey(m.created_at, tzOffset)
    const day = byDay.get(key) || { count: 0, tokens: 0 }
    day.count++
    day.tokens += m.tokens ?? 0
    byDay.set(key, day)
  }
  return { sessions: [...byDay.entries()].map(([date, v]) => ({ date, ...v })) }
}

/** UTC instant of the most recent midnight in Los Angeles (Gemini's quota reset). */
function pacificDayStartUtc(): string {
  const now = Date.now()
  const laNow = new Date(now).toLocaleString('en-US', { timeZone: 'America/Los_Angeles' })
  const offset = now - new Date(laNow).getTime()
  const laTodayUtc = new Date(now - offset)
  laTodayUtc.setUTCHours(0, 0, 0, 0)
  return new Date(laTodayUtc.getTime() + offset).toISOString()
}

/** Today's assistant usage across the whole project vs the free-tier cap. */
export async function getAssistantUsage(): Promise<{ calls: number; tokens: number; messages: number }> {
  const user = await me()
  if (!user) return { calls: 0, tokens: 0, messages: 0 }
  const supabase = await createClient()
  const { data } = await supabase
    .from('bot_messages')
    .select('tokens, calls')
    .eq('role', 'model')
    .gte('created_at', pacificDayStartUtc())
  return {
    calls: (data || []).reduce((s, m) => s + (m.calls ?? 0), 0),
    tokens: (data || []).reduce((s, m) => s + (m.tokens ?? 0), 0),
    messages: (data || []).length,
  }
}

/** One past session's messages, oldest first. */
export async function getAssistantSession(date: string, tzOffset = 0): Promise<{ messages: { role: string; text: string; created_at: string; audio_path: string | null }[] }> {
  const user = await me()
  if (!user) return { messages: [] }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return { messages: [] }
  const supabase = await createClient()
  const { data } = await supabase
    .from('bot_messages')
    .select('role, text, created_at, audio_path')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(500)
  const messages = (data || [])
    .filter(m => localDateKey(m.created_at, tzOffset) === date)
    .reverse()
  return { messages }
}
