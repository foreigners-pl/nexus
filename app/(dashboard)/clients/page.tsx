'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useClientsCache, useDeepPrefetchClients } from '@/lib/query'
import { ClientsHeader } from './components/ClientsHeader'
import { AddClientModal } from './components/AddClientModal'
import { ClientsTable } from './components/ClientsTable'
import type { Client } from '@/types/database'

interface ClientWithPhones extends Client {
  contact_numbers?: Array<{ id: string; number: string; country_code?: string; is_on_whatsapp: boolean }>
}

export interface ClientFilters {
  firstName: string
  lastName: string
  email: string
  phone: string
  dateFrom: string
  dateTo: string
}

const CLIENTS_PER_PAGE = 20

export default function ClientsPage() {
  const { getCached: getCachedClients, setCached: setCachedClients } = useClientsCache()
  const deepPrefetchClients = useDeepPrefetchClients()
  const [clients, setClients] = useState<ClientWithPhones[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [hasMore, setHasMore] = useState(true)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isSearching, setIsSearching] = useState(false)
  const [activeFilters, setActiveFilters] = useState<ClientFilters | null>(null)
  const supabase = createClient()
  const isMountedRef = useRef(true)

  useEffect(() => {
    isMountedRef.current = true
    
    // Try cache first for instant load
    const cached = getCachedClients()
    if (cached && cached.length > 0) {
      setClients(cached as ClientWithPhones[])
      setHasMore(cached.length >= CLIENTS_PER_PAGE)
      setLoading(false)
      // Deep prefetch: Load full details for top 20 clients
      deepPrefetchClients()
      // Still refresh in background (but only update cache, not state)
      fetchClientsBackground(true)
    } else {
      fetchClients()
    }
    
    return () => {
      isMountedRef.current = false
    }
  }, [])

  const fetchClientsBackground = async (cacheOnly = false) => {
    const { data } = await supabase
      .from('clients')
      .select(`*, contact_numbers (id, number, country_code, is_on_whatsapp)`)
      .order('created_at', { ascending: false })
      .range(0, CLIENTS_PER_PAGE - 1)

    if (data) {
      // Always update cache
      setCachedClients(data)
      // Only update state if not navigating away and not cache-only mode
      if (!cacheOnly && isMountedRef.current) {
        setClients(data)
        setHasMore(data.length === CLIENTS_PER_PAGE)
      }
    }
  }

  const fetchClients = async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('clients')
      .select(`*, contact_numbers (id, number, country_code, is_on_whatsapp)`)
      .order('created_at', { ascending: false })
      .range(0, CLIENTS_PER_PAGE - 1)

    if (error) {
      console.error('Error fetching clients:', error)
    } else {
      setClients(data || [])
      setCachedClients(data || [])
      setHasMore((data?.length || 0) === CLIENTS_PER_PAGE)
      // Deep prefetch after initial load
      setTimeout(() => deepPrefetchClients(), 100)
    }
    setLoading(false)
  }

  // Database search with filters
  const searchClients = useCallback(async (filters: ClientFilters) => {
    const hasFilters = filters.firstName || filters.lastName || filters.email || 
                       filters.phone || filters.dateFrom || filters.dateTo
    
    if (!hasFilters) {
      // No filters - restore original list
      setActiveFilters(null)
      fetchClients()
      return
    }

    setIsSearching(true)
    setActiveFilters(filters)

    let query = supabase
      .from('clients')
      .select(`*, contact_numbers (id, number, country_code, is_on_whatsapp)`)
      .order('created_at', { ascending: false })
      .limit(100) // Limit search results

    // Apply filters
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
      // Add one day to include the entire end date
      const endDate = new Date(filters.dateTo)
      endDate.setDate(endDate.getDate() + 1)
      query = query.lt('created_at', endDate.toISOString().split('T')[0])
    }

    const { data, error } = await query

    if (error) {
      console.error('Error searching clients:', error)
    } else {
      let results = data || []
      
      // Phone search needs post-filtering since it's in a related table
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
        setHasMore(false) // No infinite scroll during search
      }
    }
    
    if (isMountedRef.current) {
      setIsSearching(false)
    }
  }, [supabase])

  const loadMore = async () => {
    // Don't load more if searching or no more to load
    if (loadingMore || !hasMore || activeFilters) return

    setLoadingMore(true)
    const from = clients.length
    const to = from + CLIENTS_PER_PAGE - 1

    const { data, error } = await supabase
      .from('clients')
      .select(`*, contact_numbers (id, number, country_code, is_on_whatsapp)`)
      .order('created_at', { ascending: false })
      .range(from, to)

    if (error) {
      console.error('Error loading more clients:', error)
    } else {
      const newClients = [...clients, ...(data || [])]
      setClients(newClients)
      setCachedClients(newClients)
      setHasMore((data?.length || 0) === CLIENTS_PER_PAGE)
    }
    setLoadingMore(false)
  }

  return (
    <div className="space-y-6">
      <ClientsHeader onAddClick={() => setIsModalOpen(true)} />
      <AddClientModal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        onSuccess={fetchClients}
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
