'use client'

import Link from 'next/link'
import { FileText } from 'lucide-react'

export default function AdminPage() {
  return (
    <div className="max-w-3xl mx-auto px-4 md:px-6 py-6 pb-20">
      <h1 className="text-xl font-bold text-[hsl(var(--color-text-primary))] mb-2">Admin</h1>
      <p className="text-sm text-[hsl(var(--color-text-secondary))] mb-6">Quick actions for managing the system.</p>

      <div className="grid gap-3 sm:grid-cols-2">
        <Link
          href="/admin/services"
          className="flex items-center gap-4 rounded-xl border border-[hsl(var(--color-border))] bg-[hsl(var(--color-surface))] p-4 hover:bg-[hsl(var(--color-surface-hover))] transition-colors"
        >
          <div className="w-10 h-10 rounded-xl bg-[hsl(var(--color-primary))]/10 flex items-center justify-center shrink-0">
            <FileText className="w-5 h-5 text-[hsl(var(--color-primary))]" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-[hsl(var(--color-text-primary))]">Services</p>
            <p className="text-xs text-[hsl(var(--color-text-secondary))] truncate">
              View and manage all services.
            </p>
          </div>
        </Link>
      </div>
    </div>
  )
}
