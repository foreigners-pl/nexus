'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { getServices } from '@/app/actions/admin'
import type { Service } from '@/types/database'
import { FileText, Plus } from 'lucide-react'

export default function ServicesListPage() {
  const [services, setServices] = useState<Service[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getServices().then(data => {
      setServices(data)
      setLoading(false)
    })
  }, [])

  return (
    <div className="max-w-3xl mx-auto px-4 md:px-6 py-6 pb-20">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-[hsl(var(--color-text-primary))] mb-1">Services</h1>
          <p className="text-sm text-[hsl(var(--color-text-secondary))]">Select a service to edit or create a new one.</p>
        </div>
        <Link
          href="/admin/services/new"
          className="inline-flex items-center gap-2 rounded-xl bg-[hsl(var(--color-primary))] px-4 py-2 text-sm font-medium text-white hover:bg-[hsl(var(--color-primary))]/90 transition-colors"
        >
          <Plus className="w-4 h-4" />
          New service
        </Link>
      </div>

      {loading ? (
        <div className="text-sm text-[hsl(var(--color-text-secondary))]">Loading…</div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {services.map(service => (
            <Link
              key={service.id}
              href={`/admin/services/${service.id}`}
              className="flex items-center gap-4 rounded-xl border border-[hsl(var(--color-border))] bg-[hsl(var(--color-surface))] p-4 hover:bg-[hsl(var(--color-surface-hover))] transition-colors"
            >
              <div className="w-10 h-10 rounded-xl bg-[hsl(var(--color-primary))]/10 flex items-center justify-center shrink-0">
                <FileText className="w-5 h-5 text-[hsl(var(--color-primary))]" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-[hsl(var(--color-text-primary))] truncate">{service.name}</p>
                {service.gross_price !== null && service.gross_price !== undefined && (
                  <p className="text-xs text-[hsl(var(--color-text-secondary))]">{Number(service.gross_price).toLocaleString()} PLN</p>
                )}
              </div>
            </Link>
          ))}
        </div>
      )}

      {!loading && services.length === 0 && (
        <p className="text-sm text-[hsl(var(--color-text-secondary))] mt-4">No services yet.</p>
      )}
    </div>
  )
}
