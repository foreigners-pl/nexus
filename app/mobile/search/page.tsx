'use client'

import { useState, useEffect, useRef, Suspense } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { searchClients, type ClientSearchResult } from '@/app/actions/search'
import { MobileBackHeader } from '@/app/mobile/components/MobileBackHeader'
import { Search, Phone, Mail, ChevronRight } from 'lucide-react'

function SearchResults() {
  const searchParams = useSearchParams()
  const initialQuery = searchParams.get('q') || ''

  const [query, setQuery] = useState(initialQuery)
  const [results, setResults] = useState<ClientSearchResult[]>([])
  const [searched, setSearched] = useState(false)
  const [searching, setSearching] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)

    const q = query.trim()
    if (q.length < 2) {
      setResults([])
      setSearched(false)
      setSearching(false)
      return
    }

    setSearching(true)
    debounceRef.current = setTimeout(async () => {
      const { results } = await searchClients(q, 50)
      setResults(results)
      setSearched(true)
      setSearching(false)
    }, 300)

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [query])

  return (
    <>
      <div className="relative mb-4">
        <Search className="w-5 h-5 absolute left-3.5 top-1/2 -translate-y-1/2 text-[hsl(var(--color-text-muted))]" />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="First name, last name, or phone…"
          autoFocus={!initialQuery}
          className="w-full h-11 pl-11 pr-4 rounded-xl bg-[hsl(var(--color-surface))] border border-[hsl(var(--color-border))] text-[15px] text-[hsl(var(--color-text-primary))] placeholder:text-[hsl(var(--color-text-muted))] outline-none focus:border-[hsl(var(--color-border-hover))]"
        />
      </div>

      {searched && (
        <p className="text-xs text-[hsl(var(--color-text-secondary))] mb-2 px-1">
          {results.length} result{results.length === 1 ? '' : 's'}
        </p>
      )}

      {searching && results.length === 0 ? (
        <p className="text-sm text-[hsl(var(--color-text-secondary))] py-4 text-center">Searching…</p>
      ) : searched && results.length === 0 ? (
        <p className="text-sm text-[hsl(var(--color-text-secondary))] py-8 text-center">
          No clients match "{query.trim()}"
        </p>
      ) : (
        <ul className="bg-[hsl(var(--color-surface))] border border-[hsl(var(--color-border))] rounded-2xl divide-y divide-[hsl(var(--color-border))] overflow-hidden">
          {results.map((c) => {
            const name = [c.first_name, c.last_name].filter(Boolean).join(' ') || 'Unnamed'
            const phone = c.phones[0]
            return (
              <li key={c.id}>
                <Link
                  href={`/clients/${c.id}`}
                  className="flex items-center gap-3 px-4 py-3.5 active:bg-[hsl(var(--color-surface-hover))]"
                >
                  <div className="w-10 h-10 rounded-full bg-[hsl(var(--color-surface-active))] flex items-center justify-center text-sm font-semibold text-[hsl(var(--color-text-primary))] shrink-0">
                    {(c.first_name?.[0] || c.last_name?.[0] || '?').toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[15px] font-medium text-[hsl(var(--color-text-primary))] truncate">
                      {name}
                    </p>
                    <div className="flex items-center gap-3 mt-0.5">
                      {phone && (
                        <span className="text-xs text-[hsl(var(--color-text-secondary))] flex items-center gap-1 truncate">
                          <Phone className="w-3 h-3 shrink-0" />{phone}
                        </span>
                      )}
                      {c.contact_email && (
                        <span className="text-xs text-[hsl(var(--color-text-secondary))] flex items-center gap-1 truncate">
                          <Mail className="w-3 h-3 shrink-0" />{c.contact_email}
                        </span>
                      )}
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-[hsl(var(--color-text-muted))] shrink-0" />
                </Link>
              </li>
            )
          })}
        </ul>
      )}
    </>
  )
}

export default function MobileSearchPage() {
  return (
    <div>
      <MobileBackHeader title="Search clients" />
      <Suspense fallback={null}>
        <SearchResults />
      </Suspense>
    </div>
  )
}
