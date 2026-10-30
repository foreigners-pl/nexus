import { NextRequest, NextResponse } from 'next/server'
import { fetchSigningData, signAgreement } from '@/lib/agreements'

interface RouteParams {
  params: Promise<{ token: string }>
}

/** Public — returns the agreement data for the signing page. */
export async function GET(_req: NextRequest, { params }: RouteParams) {
  const { token } = await params
  const data = await fetchSigningData(token)
  if (!data) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(data)
}

/** Public — stores the client signature. */
export async function POST(req: NextRequest, { params }: RouteParams) {
  const { token } = await params
  const body = await req.json().catch(() => null)
  if (!body) return NextResponse.json({ error: 'Invalid body' }, { status: 400 })

  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || req.headers.get('x-real-ip')
  const userAgent = req.headers.get('user-agent')

  const result = await signAgreement(
    token,
    {
      name: body.name,
      email: body.email,
      pesel: body.pesel,
      idNumber: body.idNumber,
      signatureData: body.signatureData,
    },
    { ip, userAgent }
  )

  if (result.error) return NextResponse.json({ error: result.error }, { status: 400 })
  return NextResponse.json({ success: true })
}
