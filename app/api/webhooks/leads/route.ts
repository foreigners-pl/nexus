import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Use service role for webhook (bypasses RLS)
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// Webhook secret to verify requests are from your website
const WEBHOOK_SECRET = process.env.CRM_WEBHOOK_SECRET

interface LeadSubmission {
  full_name: string
  email?: string
  phone_country_code?: string
  phone?: string
  description?: string
  source?: string
  privacy_accepted?: boolean
  tracking?: {
    ip?: string
    city?: string
    country?: string
    userAgent?: string
    referrer?: string
    utm_campaign?: string
    utm_source?: string
    utm_medium?: string
  }
}

export async function POST(request: NextRequest) {
  try {
    console.log("CRM webhook called for ANY submission at /api/webhooks/leads");
    const authHeader = request.headers.get('authorization');
    console.log("Authorization header:", authHeader ? "Present" : "Missing");

    if (WEBHOOK_SECRET && authHeader !== `Bearer ${WEBHOOK_SECRET}`) {
      console.log("Webhook auth failed - expected Bearer token");
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const body: LeadSubmission = await request.json();
    console.log("CRM webhook received body:", JSON.stringify(body, null, 2));
    console.log("Phone data specifically:", {
      phone_country_code: body.phone_country_code,
      phone: body.phone
    });

    // Validate required fields
    if (!body.full_name) {
      return NextResponse.json(
        { error: 'full_name is required' },
        { status: 400 }
      )
    }


    // Store the submission
    const { data, error } = await supabase
      .from('form_submissions')
      .insert({
        full_name: body.full_name,
        email: body.email || null,
        phone_country_code: body.phone_country_code || null,
        phone: body.phone || null,
        description: body.description || null,
        source: body.source || null,
        privacy_accepted: body.privacy_accepted || false,
        ip_address: body.tracking?.ip || null,
        city: body.tracking?.city || null,
        country: body.tracking?.country || null,
        user_agent: body.tracking?.userAgent || null,
        referrer: body.tracking?.referrer || null,
        utm_campaign: body.tracking?.utm_campaign || null,
        utm_source: body.tracking?.utm_source || null,
        utm_medium: body.tracking?.utm_medium || null,
        raw_payload: body, // Store full payload for reference
        status: 'new',
      })
      .select('id')
      .single();

    if (error) {
      console.error('Error storing form submission:', error);
      return NextResponse.json(
        { error: 'Failed to store submission' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      submission_id: data.id,
      message: 'Form submission received'
    });

  } catch (error) {
    console.error('Webhook error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// Allow OPTIONS for CORS preflight
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  })
}
