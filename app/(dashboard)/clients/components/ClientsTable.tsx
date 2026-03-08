'use client'

import { useRef, useEffect, useState, useCallback } from 'react'
import { createPortal } from 'react-dom'
import Link from 'next/link'
import { Card, CardContent } from '@/components/ui'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import type { Client } from '@/types/database'
import type { ClientFilters } from '../page'

interface ClientWithPhones extends Client {
  contact_numbers?: Array<{ id: string; number: string; country_code?: string; is_on_whatsapp: boolean }>
}

interface ClientsTableProps {
  clients: ClientWithPhones[]
  loading: boolean
  loadingMore: boolean
  isSearching?: boolean
  onLoadMore: () => void
  onSearch: (filters: ClientFilters) => void
}

type SortField = 'first_name' | 'last_name' | 'contact_email' | 'created_at' | null
type SortDirection = 'asc' | 'desc'

// Debounce hook
function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value)

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value)
    }, delay)

    return () => {
      clearTimeout(handler)
    }
  }, [value, delay])

  return debouncedValue
}

// Mobile Client Card Component
function ClientCard({ client }: { client: ClientWithPhones }) {
  const primaryPhone = client.contact_numbers?.[0]
  const phoneDisplay = primaryPhone 
    ? (primaryPhone.country_code ? `${primaryPhone.country_code} ${primaryPhone.number}` : primaryPhone.number)
    : null

  return (
    <Link href={`/clients/${client.client_code || client.id}`}>
      <div className="p-4 bg-[hsl(var(--color-surface))] border border-[hsl(var(--color-border))] rounded-xl hover:bg-[hsl(var(--color-surface-hover))] transition-colors active:scale-[0.98]">
        <div className="flex items-center justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-medium text-[hsl(var(--color-text-primary))] truncate">
                {client.first_name || client.last_name 
                  ? `${client.first_name || ''} ${client.last_name || ''}`.trim()
                  : 'Unnamed Client'}
              </span>
              {primaryPhone?.is_on_whatsapp && (
                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-green-500/15 text-green-400 flex-shrink-0">
                  WA
                </span>
              )}
            </div>
            <div className="flex items-center gap-3 mt-1 text-sm text-[hsl(var(--color-text-secondary))]">
              {phoneDisplay && (
                <span className="font-mono text-xs">{phoneDisplay}</span>
              )}
              {client.contact_email && phoneDisplay && (
                <span className="text-[hsl(var(--color-text-muted))]">•</span>
              )}
              {client.contact_email && (
                <span className="truncate text-xs">{client.contact_email}</span>
              )}
            </div>
          </div>
          <svg className="w-5 h-5 text-[hsl(var(--color-text-muted))] flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </div>
      </div>
    </Link>
  )
}

export function ClientsTable({ clients, loading, loadingMore, isSearching, onLoadMore, onSearch }: ClientsTableProps) {
  const [filters, setFilters] = useState<ClientFilters>({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    dateFrom: '',
    dateTo: '',
  })
  const [sortField, setSortField] = useState<SortField>('created_at')
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc')
  const [showDatePicker, setShowDatePicker] = useState(false)
  const [mounted, setMounted] = useState(false)
  const [datePickerPosition, setDatePickerPosition] = useState({ top: 0, left: 0 })
  const tableRef = useRef<HTMLDivElement>(null)
  const datePickerRef = useRef<HTMLDivElement>(null)
  const dateButtonRef = useRef<HTMLButtonElement>(null)

  // Debounce the filters for database search
  const debouncedFilters = useDebounce(filters, 400)

  // Trigger search when debounced filters change
  useEffect(() => {
    onSearch(debouncedFilters)
  }, [debouncedFilters, onSearch])

  useEffect(() => {
    setMounted(true)
  }, [])

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortDirection('asc')
    }
  }

  const SortIcon = ({ field }: { field: SortField }) => (
    <button
      onClick={() => handleSort(field)}
      className="ml-1.5 p-1 rounded hover:bg-[hsl(var(--color-surface-active))] transition-colors inline-flex items-center"
    >
      {sortField === field ? (
        sortDirection === 'asc' ? (
          <svg className="w-3.5 h-3.5 text-[hsl(var(--color-text-primary))]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
          </svg>
        ) : (
          <svg className="w-3.5 h-3.5 text-[hsl(var(--color-text-primary))]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        )
      ) : (
        <svg className="w-3.5 h-3.5 text-[hsl(var(--color-text-muted))]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
        </svg>
      )}
    </button>
  )

  // Close date picker when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (datePickerRef.current && !datePickerRef.current.contains(event.target as Node)) {
        setShowDatePicker(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  useEffect(() => {
    const handleScroll = () => {
      if (!tableRef.current) return

      const { scrollTop, scrollHeight, clientHeight } = tableRef.current
      if (scrollHeight - scrollTop <= clientHeight * 1.2) {
        onLoadMore()
      }
    }

    const scrollElement = tableRef.current
    if (scrollElement) {
      scrollElement.addEventListener('scroll', handleScroll)
      return () => scrollElement.removeEventListener('scroll', handleScroll)
    }
  }, [onLoadMore])

  // Deduplicate clients by id first
  const uniqueClients = clients.filter((client, index, self) => 
    index === self.findIndex(c => c.id === client.id)
  )

  // Sort clients (filtering is done server-side now)
  const sortedClients = [...uniqueClients].sort((a, b) => {
    if (!sortField) return 0
    
    let aVal: string | number = ''
    let bVal: string | number = ''
    
    if (sortField === 'created_at') {
      aVal = new Date(a.created_at).getTime()
      bVal = new Date(b.created_at).getTime()
    } else {
        aVal = (a[sortField] || '').toLowerCase()
        bVal = (b[sortField] || '').toLowerCase()
      }
      
      if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1
      if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1
      return 0
    })

  if (loading) {
    return (
      <Card className="backdrop-blur-xl border border-[hsl(var(--color-border))] shadow-[0_8px_32px_rgb(0_0_0/0.25)]">
        <CardContent className="py-16">
          <div className="flex flex-col items-center justify-center gap-4">
            <div className="animate-spin rounded-full h-10 w-10 border-2 border-blue-500 border-t-transparent"></div>
            <p className="text-[hsl(var(--color-text-secondary))]">Loading clients...</p>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (clients.length === 0) {
    return (
      <Card className="backdrop-blur-xl border border-[hsl(var(--color-border))] shadow-[0_8px_32px_rgb(0_0_0/0.25)]">
        <CardContent className="py-20 px-4">
          <div className="flex flex-col items-center justify-center gap-4">
            <div className="p-6 rounded-2xl bg-[hsl(var(--color-surface-hover))] border border-[hsl(var(--color-border))]">
              <svg className="w-16 h-16 text-[hsl(var(--color-text-muted))]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
              </svg>
            </div>
            <p className="text-[hsl(var(--color-text-secondary))] text-center">
              No clients yet.<br />Click "Add Client" to get started.
            </p>
          </div>
        </CardContent>
      </Card>
    )
  }

  // Combined search value for mobile
  const mobileSearchValue = filters.firstName || filters.lastName || filters.phone || filters.email

  return (
    <>
      {/* Mobile View */}
      <div className="md:hidden space-y-3">
        {/* Mobile Search */}
        <div className="relative">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[hsl(var(--color-text-muted))]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <Input
            placeholder="Search clients..."
            value={mobileSearchValue}
            onChange={(e) => setFilters({ 
              firstName: e.target.value, 
              lastName: '', 
              email: '', 
              phone: '',
              dateFrom: '',
              dateTo: ''
            })}
            className="pl-10 bg-[hsl(var(--color-surface))]"
          />
        </div>

        {/* Mobile Client List */}
        <div 
          ref={tableRef}
          className="space-y-3 max-h-[calc(100vh-300px)] overflow-y-auto scrollbar-thin"
        >
          {isSearching ? (
            <div className="flex items-center justify-center gap-3 py-8">
              <div className="animate-spin rounded-full h-5 w-5 border-2 border-blue-500 border-t-transparent"></div>
              <span className="text-[hsl(var(--color-text-secondary))]">Searching...</span>
            </div>
          ) : sortedClients.length === 0 ? (
            <div className="py-8 text-center text-[hsl(var(--color-text-secondary))]">
              No clients found matching your search
            </div>
          ) : (
            <>
              {sortedClients.map((client) => (
                <ClientCard key={client.id} client={client} />
              ))}
              {loadingMore && (
                <div className="flex items-center justify-center gap-3 py-6">
                  <div className="animate-spin rounded-full h-5 w-5 border-2 border-[hsl(var(--color-primary))] border-t-transparent"></div>
                  <p className="text-sm text-[hsl(var(--color-text-secondary))]">Loading more...</p>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Desktop View */}
      <Card className="hidden md:block backdrop-blur-xl border border-[hsl(var(--color-border))] shadow-[0_8px_32px_rgb(0_0_0/0.25)] overflow-hidden">
        <CardContent className="p-0">
          <div ref={tableRef} className="overflow-x-auto max-h-[calc(100vh-220px)] overflow-y-auto scrollbar-thin">
            <table className="w-full table-fixed">
            <thead className="sticky top-0 bg-[hsl(var(--color-surface))] z-10 backdrop-blur-xl">
              <tr className="border-b border-[hsl(var(--color-border))]">
                <th className="p-4 text-[hsl(var(--color-text-secondary))] font-medium w-[10%]">
                  <div className="text-xs uppercase tracking-wider text-center">Action</div>
                </th>
                <th className="text-left p-4 text-[hsl(var(--color-text-secondary))] font-medium w-[15%]">
                  <div className="space-y-2">
                    <div className="flex items-center text-xs uppercase tracking-wider">
                      First Name
                      <SortIcon field="first_name" />
                    </div>
                    <Input
                      placeholder="Search..."
                      value={filters.firstName}
                      onChange={(e) => setFilters({ ...filters, firstName: e.target.value })}
                      className="text-sm bg-[hsl(var(--color-surface-hover))]"
                    />
                  </div>
                </th>
                <th className="text-left p-4 text-[hsl(var(--color-text-secondary))] font-medium w-[15%]">
                  <div className="space-y-2">
                    <div className="flex items-center text-xs uppercase tracking-wider">
                      Last Name
                      <SortIcon field="last_name" />
                    </div>
                    <Input
                      placeholder="Search..."
                      value={filters.lastName}
                      onChange={(e) => setFilters({ ...filters, lastName: e.target.value })}
                      className="text-sm bg-[hsl(var(--color-surface-hover))]"
                    />
                  </div>
                </th>
                <th className="text-left p-4 text-[hsl(var(--color-text-secondary))] font-medium w-[18%]">
                  <div className="space-y-2">
                    <div className="flex items-center text-xs uppercase tracking-wider">
                      Phone Number
                      <SortIcon field="first_name" />
                    </div>
                    <Input
                      placeholder="Search..."
                      value={filters.phone}
                      onChange={(e) => setFilters({ ...filters, phone: e.target.value })}
                      className="text-sm bg-[hsl(var(--color-surface-hover))]"
                    />
                  </div>
                </th>
                <th className="text-left p-4 text-[hsl(var(--color-text-secondary))] font-medium w-[22%]">
                  <div className="space-y-2">
                    <div className="flex items-center text-xs uppercase tracking-wider">
                      Email
                      <SortIcon field="contact_email" />
                    </div>
                    <Input
                      placeholder="Search..."
                      value={filters.email}
                      onChange={(e) => setFilters({ ...filters, email: e.target.value })}
                      className="text-sm bg-[hsl(var(--color-surface-hover))]"
                    />
                  </div>
                </th>
                <th className="text-left p-4 text-[hsl(var(--color-text-secondary))] font-medium w-[15%]">
                  <div className="space-y-2">
                    <div className="flex items-center text-xs uppercase tracking-wider">
                      Created
                      <SortIcon field="created_at" />
                    </div>
                    <div className="relative">
                      <button
                        ref={dateButtonRef}
                        type="button"
                        onClick={(e) => {
                          if (showDatePicker) {
                            setShowDatePicker(false)
                          } else {
                            const rect = e.currentTarget.getBoundingClientRect()
                            setDatePickerPosition({
                              top: rect.bottom + window.scrollY + 8,
                              left: rect.left + window.scrollX
                            })
                            setShowDatePicker(true)
                          }
                        }}
                        className="flex h-10 w-full rounded-xl px-3 py-2 bg-[hsl(var(--color-surface-hover))] border border-[hsl(var(--color-border))] text-sm text-left items-center justify-between hover:border-[hsl(var(--color-border-hover))] transition-all"
                      >
                        <span className={filters.dateFrom || filters.dateTo ? 'text-[hsl(var(--color-text-primary))]' : 'text-[hsl(var(--color-text-muted))]'}>
                          {filters.dateFrom || filters.dateTo 
                            ? `${filters.dateFrom || '...'} → ${filters.dateTo || '...'}`
                            : 'Select dates...'}
                        </span>
                        <svg className="w-4 h-4 text-[hsl(var(--color-text-muted))]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                      </button>
                      {mounted && showDatePicker && createPortal(
                        <div 
                          ref={datePickerRef}
                          style={{
                            position: 'fixed',
                            top: datePickerPosition.top,
                            left: datePickerPosition.left,
                            zIndex: 9999
                          }}
                          className="p-4 bg-[hsl(var(--color-surface))] border border-[hsl(var(--color-border))] rounded-xl shadow-[0_10px_40px_rgb(0_0_0/0.4)] min-w-[280px]"
                        >
                          <div className="space-y-3">
                            <div>
                              <label className="block text-xs text-[hsl(var(--color-text-secondary))] mb-1.5">From</label>
                              <Input
                                type="date"
                                value={filters.dateFrom}
                                onChange={(e) => setFilters({ ...filters, dateFrom: e.target.value })}
                                className="text-sm"
                              />
                            </div>
                            <div>
                              <label className="block text-xs text-[hsl(var(--color-text-secondary))] mb-1.5">To</label>
                              <Input
                                type="date"
                                value={filters.dateTo}
                                onChange={(e) => setFilters({ ...filters, dateTo: e.target.value })}
                                className="text-sm"
                              />
                            </div>
                            <div className="flex gap-2 pt-2 border-t border-[hsl(var(--color-border))]">
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                  setFilters({ ...filters, dateFrom: '', dateTo: '' })
                                  setShowDatePicker(false)
                                }}
                                className="flex-1"
                              >
                                Clear
                              </Button>
                              <Button
                                type="button"
                                variant="primary"
                                size="sm"
                                onClick={() => setShowDatePicker(false)}
                                className="flex-1"
                              >
                                Apply
                              </Button>
                            </div>
                          </div>
                        </div>,
                        document.body
                      )}
                    </div>
                  </div>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[hsl(var(--color-border)/0.5)]">
              {isSearching ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center">
                    <div className="flex items-center justify-center gap-3">
                      <div className="animate-spin rounded-full h-5 w-5 border-2 border-blue-500 border-t-transparent"></div>
                      <span className="text-[hsl(var(--color-text-secondary))]">Searching...</span>
                    </div>
                  </td>
                </tr>
              ) : sortedClients.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-[hsl(var(--color-text-secondary))]">
                    No clients found matching your search
                  </td>
                </tr>
              ) : sortedClients.map((client, index) => (
                <tr
                  key={client.id}
                  className="hover:bg-[hsl(var(--color-surface-hover))] transition-all duration-200 group"
                  style={{ animationDelay: `${index * 20}ms` }}
                >
                  <td className="p-4 text-center">
                    <Link href={`/clients/${client.client_code || client.id}`}>
                      <Button 
                        variant="primary" 
                        size="sm"
                      >
                        <svg className="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                        </svg>
                        View
                      </Button>
                    </Link>
                  </td>
                  <td className="p-4">
                    <span className="text-[hsl(var(--color-text-primary))] font-medium">
                      {client.first_name || <span className="text-[hsl(var(--color-text-muted))]">—</span>}
                    </span>
                  </td>
                  <td className="p-4">
                    <span className="text-[hsl(var(--color-text-primary))] font-medium">
                      {client.last_name || <span className="text-[hsl(var(--color-text-muted))]">—</span>}
                    </span>
                  </td>
                  <td className="p-4 text-[hsl(var(--color-text-primary))]">
                    {client.contact_numbers && client.contact_numbers.length > 0 ? (
                      <div className="space-y-1.5">
                        {client.contact_numbers.map((phone) => (
                          <div key={phone.id} className="flex items-center gap-2">
                            <span className="font-mono text-sm">{phone.country_code ? `${phone.country_code} ${phone.number}` : phone.number}</span>
                            {phone.is_on_whatsapp && (
                              <span className="text-xs px-2 py-0.5 rounded-full bg-green-500/15 text-green-400 border border-green-500/20 shadow-[0_0_10px_rgb(34_197_94/0.1)]">
                                WhatsApp
                              </span>
                            )}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <span className="text-[hsl(var(--color-text-muted))]">—</span>
                    )}
                  </td>
                  <td className="p-4">
                    <span className="text-[hsl(var(--color-text-primary))]">
                      {client.contact_email || <span className="text-[hsl(var(--color-text-muted))]">—</span>}
                    </span>
                  </td>
                  <td className="p-4">
                    <span className="text-sm text-[hsl(var(--color-text-secondary))] font-mono">
                      {new Date(client.created_at).toLocaleDateString()}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {loadingMore && (
            <div className="flex items-center justify-center gap-3 py-6 border-t border-[hsl(var(--color-border))]">
              <div className="animate-spin rounded-full h-5 w-5 border-2 border-[hsl(var(--color-primary))] border-t-transparent"></div>
              <p className="text-sm text-[hsl(var(--color-text-secondary))]">Loading more clients...</p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
    </>
  )
}
