'use client'

import { useEffect } from 'react'

/** Route error boundary for the progress page. Shows the real error (so a
 *  phone user can read/screenshot it) and reports it for debugging. */
export default function ProgressError({ error, reset }: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    fetch('/api/client-error', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: error.message,
        stack: error.stack,
        digest: error.digest,
        url: window.location.href,
      }),
    }).catch(() => {})
  }, [error])

  return (
    <div className="px-4 py-10 space-y-4">
      <p className="text-sm font-semibold text-red-400">This page crashed</p>
      <p className="text-xs text-[hsl(var(--color-text-secondary))] break-words font-mono">
        {error.message || 'Unknown error'}
      </p>
      {error.digest && (
        <p className="text-[10px] text-[hsl(var(--color-text-muted))] font-mono">digest: {error.digest}</p>
      )}
      <button
        onClick={() => window.location.reload()}
        className="rounded-xl bg-[hsl(var(--color-primary))] text-white text-sm font-medium px-4 py-2.5"
      >
        Reload page
      </button>
    </div>
  )
}
