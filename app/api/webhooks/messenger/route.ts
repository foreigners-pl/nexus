import { NextRequest, NextResponse, after } from 'next/server'
import crypto from 'crypto'
import { handleMessengerMessage, sendMessenger } from '@/lib/bot/handle'

/**
 * Facebook Messenger webhook (Meta Graph API).
 * GET  — one-time webhook verification (hub.challenge echo)
 * POST — incoming messages; verified with X-Hub-Signature-256, processed
 *        after the 200 response via after() since Meta expects a fast ack.
 */

const VERIFY_TOKEN = process.env.META_VERIFY_TOKEN
const APP_SECRET = process.env.META_APP_SECRET

export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams
  if (q.get('hub.mode') === 'subscribe' && q.get('hub.verify_token') === VERIFY_TOKEN) {
    return new NextResponse(q.get('hub.challenge'), { status: 200 })
  }
  return NextResponse.json({ error: 'Verification failed' }, { status: 403 })
}

export async function POST(request: NextRequest) {
  const raw = await request.text()

  if (APP_SECRET) {
    const sig = request.headers.get('x-hub-signature-256') || ''
    const expected = 'sha256=' + crypto.createHmac('sha256', APP_SECRET).update(raw).digest('hex')
    if (sig.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) {
      return NextResponse.json({ error: 'Bad signature' }, { status: 403 })
    }
  }

  const body = JSON.parse(raw)
  if (body.object !== 'page') return NextResponse.json({ ok: true })

  for (const entry of body.entry || []) {
    for (const event of entry.messaging || []) {
      const psid: string | undefined = event.sender?.id
      const text: string | undefined = event.message?.text
      // Skip echoes (our own replies), deliveries, reads, attachments-only
      if (!psid || !text || event.message?.is_echo) continue
      after(() => handleMessengerMessage(psid, text).catch(async () => {
        await sendMessenger(psid, 'Something went wrong handling that — try again?').catch(() => {})
      }))
    }
  }

  return NextResponse.json({ ok: true })
}
