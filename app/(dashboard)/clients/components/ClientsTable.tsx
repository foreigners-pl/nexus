'use client'

import { useRef, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent } from '@/components/ui'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import type { Client } from '@/types/database'

interface ClientWithPhones extends Client {
  contact_numbers?: Array<{ id: string; number: string; is_on_whatsapp: boolean }>
}

interface ClientsTableProps {
  clients: ClientWithPhones[]
  loading: boolean
  loadingMore: boolean
  onLoadMore: () => void
}

type SortField = 'first_name' | 'last_name' | 'contact_email' | 'created_at' | null
type SortDirection = 'asc' | 'desc'

export function ClientsTable({ clients, loading, loadingMore, onLoadMore }: ClientsTableProps) {
  const [filters, setFilters] = useState({
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
  const tableRef = useRef<HTMLDivElement>(null)
  const datePickerRef = useRef<HTMLDivElement>(null)
  const router = useRouter()

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

  const filteredAndSortedClients = uniqueClients
    .filter((client) => {
      const matchesFirstName = !filters.firstName || client.first_name?.toLowerCase().includes(filters.firstName.toLowerCase())
      const matchesLastName = !filters.lastName || client.last_name?.toLowerCase().includes(filters.lastName.toLowerCase())
      const matchesEmail = !filters.email || client.contact_email?.toLowerCase().includes(filters.email.toLowerCase())
      const matchesPhone = !filters.phone || client.contact_numbers?.some(phone => 
        phone.number.toLowerCase().includes(filters.phone.toLowerCase())
      )
      
      // Date filtering
      const clientDate = new Date(client.created_at)
      clientDate.setHours(0, 0, 0, 0)
      
      let matchesDateFrom = true
      let matchesDateTo = true
      
      if (filters.dateFrom) {
        const fromDate = new Date(filters.dateFrom)
        fromDate.setHours(0, 0, 0, 0)
        matchesDateFrom = clientDate >= fromDate
      }
      
      if (filters.dateTo) {
        const toDate = new Date(filters.dateTo)
        toDate.setHours(23, 59, 59, 999)
        matchesDateTo = clientDate <= toDate
      }

      return matchesFirstName && matchesLastName && matchesEmail && matchesPhone && matchesDateFrom && matchesDateTo
    })
    .sort((a, b) => {
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
        <CardContent className="py-20">
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

  return (
    <Card className="backdrop-blur-xl border border-[hsl(var(--color-border))] shadow-[0_8px_32px_rgb(0_0_0/0.25)] overflow-hidden">
      <CardContent className="p-0">
        <div ref={tableRef} className="overflow-x-auto max-h-[calc(100vh-220px)] overflow-y-auto scrollbar-thin">
          <table className="w-full table-fixed">
            <thead className="sticky top-0 bg-[hsl(var(--color-surface))] z-10 backdrop-blur-xl">
              <tr className="border-b border-[hsl(var(--color-border))]">
                <th className="text-left p-4 text-[hsl(var(--color-text-secondary))] font-medium w-[16%]">
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
                <th className="text-left p-4 text-[hsl(var(--color-text-secondary))] font-medium w-[16%]">
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
                    <div className="relative" ref={datePickerRef}>
                      <button
                        type="button"
                        onClick={() => setShowDatePicker(!showDatePicker)}
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
                      {showDatePicker && (
                        <div className="absolute top-full left-0 mt-2 p-4 bg-[hsl(var(--color-surface))] border border-[hsl(var(--color-border))] rounded-xl shadow-[0_10px_40px_rgb(0_0_0/0.4)] z-50 min-w-[280px]">
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
                        </div>
                      )}
                    </div>
                  </div>
                </th>
                <th className="p-4 text-[hsl(var(--color-text-secondary))] font-medium w-[13%]"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[hsl(var(--color-border)/0.5)]">
              {filteredAndSortedClients.map((client, index) => (
                <tr
                  key={client.id}
                  className="hover:bg-[hsl(var(--color-surface-hover))] transition-all duration-200 group"
                  style={{ animationDelay: `${index * 20}ms` }}
                >
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
                            <span className="font-mono text-sm">{phone.number}</span>
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
                  <td className="p-4 text-center">
                    <Button 
                      variant="primary" 
                      size="sm"
                      onClick={() => router.push(`/clients/${client.client_code || client.id}`)}
                    >
                      <svg className="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </svg>
                      View
                    </Button>
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
  )
}
