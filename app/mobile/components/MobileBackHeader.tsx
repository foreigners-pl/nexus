import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'

export function MobileBackHeader({ title }: { title: string }) {
  return (
    <div className="flex items-center gap-2 mb-4">
      <Link
        href="/mobile"
        className="w-9 h-9 -ml-1 rounded-full flex items-center justify-center text-[hsl(var(--color-text-secondary))] active:bg-[hsl(var(--color-surface-hover))]"
        aria-label="Back to home"
      >
        <ChevronLeft className="w-6 h-6" />
      </Link>
      <h2 className="text-lg font-semibold text-[hsl(var(--color-text-primary))]">{title}</h2>
    </div>
  )
}
