'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { runTool, type BotUser } from '@/lib/bot/tools'

/** Mirrors the admin pages' existing posture — any signed-in team member.
 *  Centralised so a future role gate lives in exactly one place. */
async function assertSignedIn(): Promise<boolean> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  return !!user
}

type Target = BotUser & { role_name: string | null }

async function loadTarget(userId: string): Promise<Target | null> {
  if (!/^[0-9a-f-]{36}$/i.test(userId)) return null
  const admin = createAdminClient()
  const { data } = await admin
    .from('users')
    .select('id, display_name, email, role:roles(name)')
    .eq('id', userId)
    .single()
  if (!data) return null
  return {
    id: data.id,
    display_name: data.display_name,
    email: (data as any).email ?? '',
    role_name: (data as any).role?.name ?? null,
  }
}

export async function getViewAsUser(userId: string): Promise<{ id: string; name: string; role: string | null } | null> {
  if (!await assertSignedIn()) return null
  const t = await loadTarget(userId)
  return t ? { id: t.id, name: t.display_name || t.email, role: t.role_name } : null
}

/** The target's Requests + Actions queues — the same buckets the Requests
 *  and Actions pages show (reuses the assistant's read tools). */
export async function getViewAsQueues(userId: string): Promise<{ requests: any; actions: any } | null> {
  if (!await assertSignedIn()) return null
  const t = await loadTarget(userId)
  if (!t) return null
  const admin = createAdminClient()
  const [requests, actions] = await Promise.all([
    runTool(admin, t, 'list_requests', {}),
    runTool(admin, t, 'list_actions', {}),
  ])
  return { requests, actions }
}

/** YYYY-MM-DD of a timestamp in the viewer's local timezone. */
function localDateKey(iso: string, offsetMinutes: number): string {
  return new Date(new Date(iso).getTime() - offsetMinutes * 60000).toISOString().slice(0, 10)
}

/** The target's assistant sessions — one per local day, newest first. */
export async function getViewAsSessions(userId: string, tzOffset = 0): Promise<{ sessions: { date: string; count: number; tokens: number }[] }> {
  if (!await assertSignedIn()) return { sessions: [] }
  const t = await loadTarget(userId)
  if (!t) return { sessions: [] }
  const admin = createAdminClient()
  const { data } = await admin
    .from('bot_messages')
    .select('created_at, tokens')
    .eq('user_id', t.id)
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

/** One of the target's sessions, oldest first — read-only transcript. */
export async function getViewAsSession(userId: string, date: string, tzOffset = 0): Promise<{ messages: { role: string; text: string; created_at: string; audio_path: string | null }[] }> {
  if (!await assertSignedIn()) return { messages: [] }
  const t = await loadTarget(userId)
  if (!t || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return { messages: [] }
  const admin = createAdminClient()
  const { data } = await admin
    .from('bot_messages')
    .select('role, text, created_at, audio_path')
    .eq('user_id', t.id)
    .order('created_at', { ascending: false })
    .limit(500)
  const messages = (data || [])
    .filter(m => localDateKey(m.created_at, tzOffset) === date)
    .reverse()
  return { messages }
}

/** Playback URL for a voice message owned by the target user. */
export async function getViewAsAudioUrl(userId: string, path: string): Promise<{ url?: string; error?: string }> {
  if (!await assertSignedIn()) return { error: 'Not signed in' }
  if (!path.startsWith(`staging/${userId}/`)) return { error: 'Invalid audio' }
  const admin = createAdminClient()
  const { data, error } = await admin.storage.from('case_attachments').createSignedUrl(path, 3600)
  return error || !data ? { error: 'No audio' } : { url: data.signedUrl }
}
