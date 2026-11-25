'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { runTool, type BotUser } from '@/lib/bot/tools'
import { sendPushToUsers } from '@/app/actions/push'

/** Morning digest — one push per member summarising their queue. Runs from
 *  the daily /api/cron/mrc job (the project's single Vercel cron). Reuses the
 *  assistant's read tools so the buckets match what the member sees in-app. */
export async function sendMorningDigests(): Promise<{ sent: number; skipped: number }> {
  const admin = createAdminClient()
  const { data: users } = await admin
    .from('users')
    .select('id, display_name, email')
    .not('display_name', 'in', '("System","test")')

  let sent = 0
  let skipped = 0
  for (const u of users || []) {
    const me: BotUser = { id: u.id, display_name: u.display_name, email: u.email }
    const [req, act] = await Promise.all([
      runTool(admin, me, 'list_requests', {}),
      runTool(admin, me, 'list_actions', {}),
    ])

    const toAnswer = (req?.to_answer || []) as any[]
    const lateReq = toAnswer.filter(q => q.late).length
    const newReq = toAnswer.length - lateReq
    const review = (req?.answered_awaiting_seen || []).length
    const tasks = (req?.tasks || []).length
    const lateAct = (act?.late || []).length
    const upcoming = (act?.upcoming || []).length
    const undated = (act?.undated || []).length
    const neglected = (act?.neglected_cases || []).length
    const total = newReq + lateReq + review + tasks + lateAct + upcoming + undated + neglected
    if (!total) { skipped++; continue }

    const n = (x: number, s: string, p?: string) => x ? `${x} ${x === 1 ? s : (p ?? s + 's')}` : null
    const parts = [
      n(lateReq, 'late request'),
      n(newReq, 'new request'),
      n(review, 'answer to review'),
      n(tasks, 'board task'),
      n(lateAct, 'late action'),
      n(upcoming, 'upcoming action'),
      n(undated, 'undated action'),
      n(neglected, 'neglected case'),
    ].filter(Boolean)
    const body = parts.join(' · ')

    // Chat message too — visible without push, and proves the cron ran.
    await admin.from('bot_messages').insert({
      user_id: u.id,
      role: 'model',
      text: `Morning — your queue: ${body}.`,
    })

    await sendPushToUsers([u.id], {
      title: `Morning — ${total} open`,
      body,
      url: '/home',
    })
    sent++
  }
  return { sent, skipped }
}
