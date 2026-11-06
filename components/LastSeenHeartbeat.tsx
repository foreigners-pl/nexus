'use client'

import { useEffect } from 'react'
import { touchLastSeen } from '@/app/actions/admin'

/** Pings the server to bump the user's last_seen_at every 5 minutes. */
export function LastSeenHeartbeat() {
  useEffect(() => {
    touchLastSeen()
    const t = setInterval(() => { touchLastSeen() }, 5 * 60 * 1000)
    return () => clearInterval(t)
  }, [])
  return null
}
