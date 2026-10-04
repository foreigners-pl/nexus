'use client'

import { ReactNode } from 'react'
import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import { usePaneBack } from '@/lib/panes'

/**
 * Sticky app-bar used by sub-pages (case Process / Billing / Files, client info).
 * Negative margins bleed it edge-to-edge over the dashboard padding;
 * the negative `top` matches the negative margin so it sticks flush to the top.
 */
export function SubPageHeader({ backHref, title, subtitle, icon, action, titleHref }: {
  backHref: string
  title: string
  subtitle?: string
  icon?: ReactNode
  action?: ReactNode
  /** When set, the title/subtitle block links here (real navigation). */
  titleHref?: string
}) {
  const paneBack = usePaneBack()

  const titleBlock = (
    <>
      <h1 className="text-base font-semibold text-[hsl(var(--color-text-primary))] truncate leading-tight">
        {title}
      </h1>
      {subtitle && (
        <p className="text-xs text-[hsl(var(--color-text-secondary))] truncate leading-tight">
          {subtitle}
        </p>
      )}
    </>
  )
  return (
    <header className="sticky -top-4 md:-top-6 z-40 -mx-4 md:-mx-6 -mt-4 md:-mt-6 mb-6 bg-[hsl(var(--color-surface))]/90 backdrop-blur border-b border-[hsl(var(--color-border))]">
      <div className="px-4 md:px-6 h-14 flex items-center gap-3">
        <Link
          href={backHref}
          onClick={paneBack ? (e) => { e.preventDefault(); paneBack() } : undefined}
          className="w-9 h-9 -ml-1 rounded-full flex items-center justify-center text-[hsl(var(--color-text-secondary))] active:bg-[hsl(var(--color-surface-hover))] shrink-0"
          aria-label="Back"
        >
          <ChevronLeft className="w-6 h-6" />
        </Link>
        {icon && (
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[hsl(var(--color-primary))] to-[hsl(var(--color-primary)/0.7)] flex items-center justify-center shadow-[0_4px_16px_rgb(0_0_0/0.25)] shrink-0">
            {icon}
          </div>
        )}
        {titleHref ? (
          <Link href={titleHref} className="min-w-0 flex-1 rounded-lg -mx-1 px-1 hover:bg-[hsl(var(--color-surface-hover))] active:bg-[hsl(var(--color-surface-hover))] transition-colors">
            {titleBlock}
          </Link>
        ) : (
          <div className="min-w-0 flex-1">
            {titleBlock}
          </div>
        )}
        {action}
      </div>
    </header>
  )
}
