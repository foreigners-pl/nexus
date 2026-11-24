import { NextRequest, NextResponse } from 'next/server'
import { generateDueMrcInvoices, generateDueAutoInvoices } from '@/app/actions/mrc'
import { sendMorningDigests } from '@/app/actions/digest'

// Vercel cron — runs daily: generates MRC/auto invoices due today, then
// pushes each member a morning digest of their queue.
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET
  const auth = req.headers.get('authorization')
  if (secret && auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const mrc = await generateDueMrcInvoices()
  const auto = await generateDueAutoInvoices()
  const digest = await sendMorningDigests().catch((e: Error) => ({ error: e.message }))
  return NextResponse.json({ ok: true, mrc, auto, digest })
}
