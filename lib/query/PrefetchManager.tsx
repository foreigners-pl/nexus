'use client'

import { usePrefetchOnMount } from './usePrefetch'

/**
 * Invisible component that triggers prefetching when mounted.
 * Place this in the dashboard layout to start prefetching immediately.
 */
export function PrefetchManager() {
  usePrefetchOnMount()
  return null
}
