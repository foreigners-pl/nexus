import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

/** Receives client-side crash reports from route error boundaries. */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const supabase = createAdminClient()
    await supabase.from('client_errors').insert({
      message: String(body.message ?? '').slice(0, 2000),
      stack: String(body.stack ?? '').slice(0, 6000),
      digest: body.digest ? String(body.digest).slice(0, 100) : null,
      url: String(body.url ?? '').slice(0, 500),
      ua: request.headers.get('user-agent')?.slice(0, 400) ?? null,
    })
  } catch {
    // Never fail — this is a logging endpoint
  }
  return NextResponse.json({ ok: true })
}
