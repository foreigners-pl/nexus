import { NextRequest, NextResponse } from 'next/server'
import { recordAgreementOpen } from '@/lib/agreements'

interface RouteParams {
  params: Promise<{ token: string }>
}

/** Public — records a signing-link open. */
export async function POST(_req: NextRequest, { params }: RouteParams) {
  const { token } = await params
  await recordAgreementOpen(token)
  return NextResponse.json({ success: true })
}
