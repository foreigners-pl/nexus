'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { runTool, type BotUser } from '@/lib/bot/tools'
import { sendPushToUsers } from '@/app/actions/push'

/** Morning digest — one push per member summarising their queue. Runs from
 *  the daily /api/cron/mrc job (the project's single Vercel cron). Reuses the
 *  assistant's read tools so the buckets match what the member sees in-app. */
export async function sendMorningDigests(onlyUserId?: string): Promise<{ sent: number; skipped: number; errors: string[] }> {
  const admin = createAdminClient()
  const { data: allUsers } = await admin
    .from('users')
    .select('id, display_name, email')
  const users = (allUsers || []).filter(u =>
    onlyUserId ? u.id === onlyUserId
               : u.display_name !== 'System' && u.display_name !== 'test',
  )

  let sent = 0
  let skipped = 0
  const errors: string[] = []
  for (const u of users) {
    try {
      const me: BotUser = { id: u.id, display_name: u.display_name, email: u.email }
      const [req, act] = await Promise.all([
        runTool(admin, me, 'list_requests', {}),
        runTool(admin, me, 'list_actions', {}),
      ])

      const toAnswer = (req?.to_answer || []) as any[]
      const review = (req?.answered_awaiting_seen || []) as any[]
      const tasks = (req?.tasks || []) as any[]
      const lateAct = (act?.late || []) as any[]
      const upcoming = (act?.upcoming || []) as any[]
      const undated = (act?.undated || []) as any[]
      const neglected = (act?.neglected_cases || []) as any[]
      const total = toAnswer.length + review.length + tasks.length + lateAct.length + upcoming.length + undated.length + neglected.length
      if (!total) { skipped++; continue }

      const n = (x: number, s: string, p?: string) => x ? `${x} ${x === 1 ? s : (p ?? s + 's')}` : null
      const body = [
        n(toAnswer.filter(q => q.late).length, 'late request'),
        n(toAnswer.filter(q => !q.late).length, 'new request'),
        n(review.length, 'answer to review'),
        n(tasks.length, 'board task'),
        n(lateAct.length, 'late action'),
        n(upcoming.length, 'upcoming action'),
        n(undated.length, 'undated action'),
        n(neglected.length, 'neglected case'),
      ].filter(Boolean).join(' · ')

      // Bullet list matching how the assistant reports the queue —
      // linked case first, then what it needs.
      const link = (label: string | null, caseId: string | null) =>
        label && caseId ? `[${label}](/cases/${caseId}/progress)` : 'a case'
      const bullets: string[] = [
        ...toAnswer.map(q => `• Request on ${link(q.case, q.case_id)}: ${q.about || 'needs your answer'}${q.late ? ' — waiting over a day' : ''}`),
        ...review.map(q => `• Answer on ${link(q.case, q.case_id)}: ${q.about || 'answered'} — mark it seen`),
        ...tasks.map(t => `• Task on ${t.board || 'board'}: ${t.title}${t.due ? ` (due ${t.due})` : ''}`),
        ...[...lateAct, ...upcoming, ...undated].map(a => `• Action on ${link(a.case, a.case_id)}: ${a.what}${a.due ? ` (due ${a.due})` : ''}`),
        ...neglected.map(c => `• Neglected case: ${link(c.case, c.case_id)} has no open actions`),
      ]
      const chatText = `Morning — your queue:\n${bullets.slice(0, 8).join('\n')}${bullets.length > 8 ? `\n…and ${bullets.length - 8} more` : ''}`

      // Chat message too — visible without push, and proves the cron ran.
      await admin.from('bot_messages').insert({
        user_id: u.id,
        role: 'model',
        text: chatText,
      })

      // In-app notification row so it shows on the notifications page too.
      await admin.from('user_alerts').insert({
        user_id: u.id,
        kind: 'deadline',
        title: `Morning — ${total} open`,
        body,
        link: '/assistant',
        actor_id: null,
        case_id: null,
      })

      await sendPushToUsers([u.id], {
        title: `Morning — ${total} open`,
        body,
        url: '/home',
      })
      sent++
    } catch (e: any) {
      errors.push(`${u.display_name}: ${e?.message || e}`)
    }
  }
  return { sent, skipped, errors }
}
