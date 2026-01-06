import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// This route is called by Vercel Cron to keep Supabase alive
// Configured in vercel.json to run every 6 days

export async function GET(request: NextRequest) {
  // Verify the request is from Vercel Cron (optional security)
  const authHeader = request.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET
  
  // If CRON_SECRET is set, verify it
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    // Use service role key to bypass RLS
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )

    // Insert a keep-alive ping
    const { data, error } = await supabase
      .from('keep_alive')
      .insert({
        source: 'vercel_cron',
        metadata: {
          timestamp: new Date().toISOString(),
          userAgent: request.headers.get('user-agent') || 'unknown'
        }
      })
      .select()
      .single()

    if (error) {
      console.error('Keep-alive ping failed:', error)
      return NextResponse.json({ 
        success: false, 
        error: error.message,
        timestamp: new Date().toISOString()
      }, { status: 500 })
    }

    console.log('Keep-alive ping successful:', data)
    return NextResponse.json({ 
      success: true, 
      message: 'Database pinged successfully',
      pinged_at: data.pinged_at,
      timestamp: new Date().toISOString()
    })

  } catch (err) {
    console.error('Keep-alive error:', err)
    return NextResponse.json({ 
      success: false, 
      error: 'Internal server error',
      timestamp: new Date().toISOString()
    }, { status: 500 })
  }
}
