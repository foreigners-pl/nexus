'use client'

import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import { usePaneBack } from '@/lib/panes'

export function MobileBackHeader({ title }: { title: string }) {
  const paneBack = usePaneBack()

  const back = paneBack ? (
    <button
      onClick={paneBack}
      className="w-9 h-9 -ml-1 rounded-full flex items-center justify-center text-[hsl(var(--color-text-secondary))] active:bg-[hsl(var(--color-surface-hover))]"
      aria-label="Back"
    >
      <ChevronLeft className="w-6 h-6" />
    </button>
  ) : (
    <Link
      href="/mobile"
      className="w-9 h-9 -ml-1 rounded-full flex items-center justify-center text-[hsl(var(--color-text-secondary))] active:bg-[hsl(var(--color-surface-hover))]"
      aria-label="Back to home"
    >
      <ChevronLeft className="w-6 h-6" />
    </Link>
  )

  return (
    <div className="flex items-center gap-2 mb-4">
      {back}
      <h2 className="text-lg font-semibold text-[hsl(var(--color-text-primary))]">{title}</h2>
    </div>
  )
}
