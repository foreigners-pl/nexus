import { NextRequest, NextResponse } from 'next/server'
import { generateDueMrcInvoices, generateDueAutoInvoices } from '@/app/actions/mrc'

// Vercel cron — runs daily, generates MRC invoices due today.
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET
  const auth = req.headers.get('authorization')
  if (secret && auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const mrc = await generateDueMrcInvoices()
  const auto = await generateDueAutoInvoices()
  return NextResponse.json({ ok: true, mrc, auto })
}
