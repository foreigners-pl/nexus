'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { PageHeader } from '@/components/shared/PageHeader'
import { ClientsTable } from '../components/ClientsTable'
import type { ClientFilters } from '../page'
import type { Client } from '@/types/database'

interface ClientWithPhones extends Client {
  contact_numbers?: Array<{ id: string; number: string; country_code?: string; is_on_whatsapp: boolean }>
}

const CLIENTS_PER_PAGE = 20

export default function MyClientsPage() {
  const [clients, setClients] = useState<ClientWithPhones[]>([])
  const [myClientIds, setMyClientIds] = useState<string[] | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [hasMore, setHasMore] = useState(true)
  const [isSearching, setIsSearching] = useState(false)
  const [activeFilters, setActiveFilters] = useState<ClientFilters | null>(null)
  const supabase = createClient()
  const isMountedRef = useRef(true)

  useEffect(() => {
    isMountedRef.current = true

    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user || !isMountedRef.current) { setLoading(false); return }

      const { data: caseRows } = await supabase
        .from('cases')
        .select('client_id')
        .or(`assigned_to.eq.${user.id},csr_id.eq.${user.id}`)

      const ids = [...new Set((caseRows || []).map((r: any) => r.client_id).filter(Boolean))] as string[]
      if (!isMountedRef.current) return
      setMyClientIds(ids)

      if (ids.length === 0) {
        setClients([])
        setHasMore(false)
        setLoading(false)
        return
      }

      const { data } = await supabase
        .from('clients')
        .select(`*, contact_numbers (id, number, country_code, is_on_whatsapp)`)
        .in('id', ids)
        .order('created_at', { ascending: false })
        .range(0, CLIENTS_PER_PAGE - 1)

      if (!isMountedRef.current) return
      setClients(data || [])
      setHasMore((data?.length || 0) === CLIENTS_PER_PAGE)
      setLoading(false)
    }

    init()
    return () => {
      isMountedRef.current = false
    }
  }, [])

  const fetchClients = async () => {
    if (!myClientIds || myClientIds.length === 0) { setClients([]); setHasMore(false); return }
    setLoading(true)
    const { data, error } = await supabase
      .from('clients')
      .select(`*, contact_numbers (id, number, country_code, is_on_whatsapp)`)
      .in('id', myClientIds)
      .order('created_at', { ascending: false })
      .range(0, CLIENTS_PER_PAGE - 1)

    if (error) {
      console.error('Error fetching clients:', error)
    } else {
      setClients(data || [])
      setHasMore((data?.length || 0) === CLIENTS_PER_PAGE)
    }
    setLoading(false)
  }

  // Database search with filters — scoped to my clients
  const searchClients = useCallback(async (filters: ClientFilters) => {
    const hasFilters = filters.firstName || filters.lastName || filters.email ||
                       filters.phone || filters.dateFrom || filters.dateTo

    if (!hasFilters) {
      setActiveFilters(null)
      fetchClients()
      return
    }
    if (!myClientIds || myClientIds.length === 0) { setClients([]); setHasMore(false); return }

    setIsSearching(true)
    setActiveFilters(filters)

    let query = supabase
      .from('clients')
      .select(`*, contact_numbers (id, number, country_code, is_on_whatsapp)`)
      .in('id', myClientIds)
      .order('created_at', { ascending: false })
      .limit(100)

    if (filters.firstName) {
      query = query.ilike('first_name', `%${filters.firstName}%`)
    }
    if (filters.lastName) {
      query = query.ilike('last_name', `%${filters.lastName}%`)
    }
    if (filters.email) {
      query = query.ilike('contact_email', `%${filters.email}%`)
    }
    if (filters.dateFrom) {
      query = query.gte('created_at', filters.dateFrom)
    }
    if (filters.dateTo) {
      const endDate = new Date(filters.dateTo)
      endDate.setDate(endDate.getDate() + 1)
      query = query.lt('created_at', endDate.toISOString().split('T')[0])
    }

    const { data, error } = await query

    if (error) {
      console.error('Error searching clients:', error)
    } else {
      let results = data || []

      if (filters.phone && results.length > 0) {
        results = results.filter(client =>
          client.contact_numbers?.some((phone: any) => {
            const fullPhone = phone.country_code ? `${phone.country_code} ${phone.number}` : phone.number
            return fullPhone.toLowerCase().includes(filters.phone.toLowerCase())
          })
        )
      }

      if (isMountedRef.current) {
        setClients(results)
        setHasMore(false)
      }
    }

    if (isMountedRef.current) {
      setIsSearching(false)
    }
  }, [supabase, myClientIds])

  const loadMore = async () => {
    if (loadingMore || !hasMore || activeFilters || !myClientIds) return

    setLoadingMore(true)
    const from = clients.length
    const to = from + CLIENTS_PER_PAGE - 1

    const { data, error } = await supabase
      .from('clients')
      .select(`*, contact_numbers (id, number, country_code, is_on_whatsapp)`)
      .in('id', myClientIds)
      .order('created_at', { ascending: false })
      .range(from, to)

    if (error) {
      console.error('Error loading more clients:', error)
    } else {
      setClients([...clients, ...(data || [])])
      setHasMore((data?.length || 0) === CLIENTS_PER_PAGE)
    }
    setLoadingMore(false)
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="My Clients"
        subtitle="Clients on cases you're assigned to"
        icon={
          <svg className="w-6 h-6 text-[hsl(var(--color-primary))]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
          </svg>
        }
      />
      <ClientsTable
        clients={clients}
        loading={loading}
        loadingMore={loadingMore}
        isSearching={isSearching}
        onLoadMore={loadMore}
        onSearch={searchClients}
      />
    </div>
  )
}
