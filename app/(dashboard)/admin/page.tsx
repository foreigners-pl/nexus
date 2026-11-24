'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Crown, FileText, Activity, Loader2 } from 'lucide-react'
import { getMyAccess } from '@/app/actions/access'

export default function AdminPage() {
  const [access, setAccess] = useState<Awaited<ReturnType<typeof getMyAccess>> | null>(null)

  useEffect(() => {
    getMyAccess().then(setAccess)
  }, [])

  if (!access) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="w-6 h-6 animate-spin text-[hsl(var(--color-text-secondary))]" />
      </div>
    )
  }

  if (!access.canAdmin) {
    return (
      <div className="max-w-3xl mx-auto px-4 md:px-6 py-6 pb-20">
        <h1 className="text-xl font-bold text-[hsl(var(--color-text-primary))] mb-2">Admin</h1>
        <p className="text-sm text-[hsl(var(--color-text-secondary))]">
          You don't have access to admin tools.
        </p>
      </div>
    )
  }

  const card =
    'flex items-center gap-4 rounded-xl border border-[hsl(var(--color-border))] bg-[hsl(var(--color-surface))] p-4 hover:bg-[hsl(var(--color-surface-hover))] transition-colors'
  const icon = 'w-10 h-10 rounded-xl bg-[hsl(var(--color-primary))]/10 flex items-center justify-center shrink-0'

  return (
    <div className="max-w-3xl mx-auto px-4 md:px-6 py-6 pb-20">
      <h1 className="text-xl font-bold text-[hsl(var(--color-text-primary))] mb-2">Admin</h1>
      <p className="text-sm text-[hsl(var(--color-text-secondary))] mb-6">Quick actions for managing the system.</p>

      <div className="grid gap-3 sm:grid-cols-2">
        {access.canManage && (
          <Link href="/admin/final-boss" className={card}>
            <div className={icon}>
              <Crown className="w-5 h-5 text-[hsl(var(--color-primary))]" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-[hsl(var(--color-text-primary))]">Final boss</p>
              <p className="text-xs text-[hsl(var(--color-text-secondary))] truncate">
                Roles, managers, and hierarchies.
              </p>
            </div>
          </Link>
        )}

        {access.canSeeUsage && (
          <Link href="/admin/usage" className={card}>
            <div className={icon}>
              <Activity className="w-5 h-5 text-[hsl(var(--color-primary))]" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-[hsl(var(--color-text-primary))]">Usage overview</p>
              <p className="text-xs text-[hsl(var(--color-text-secondary))] truncate">
                Last seen and workload per user.
              </p>
            </div>
          </Link>
        )}

        {access.canManage && (
          <Link href="/admin/services" className={card}>
            <div className={icon}>
              <FileText className="w-5 h-5 text-[hsl(var(--color-primary))]" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-[hsl(var(--color-text-primary))]">Services</p>
              <p className="text-xs text-[hsl(var(--color-text-secondary))] truncate">
                View and manage all services.
              </p>
            </div>
          </Link>
        )}
      </div>
    </div>
  )
}
