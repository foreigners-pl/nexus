'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useClientsCache, useDeepPrefetchClients } from '@/lib/query'
import { ClientsHeader } from './components/ClientsHeader'
import { AddClientModal } from './components/AddClientModal'
import { ClientsTable } from './components/ClientsTable'
import type { Client } from '@/types/database'

interface ClientWithPhones extends Client {
  contact_numbers?: Array<{ id: string; number: string; is_on_whatsapp: boolean }>
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
  const supabase = createClient()

  useEffect(() => {
    // Try cache first for instant load
    const cached = getCachedClients()
    if (cached && cached.length > 0) {
      setClients(cached as ClientWithPhones[])
      setHasMore(cached.length >= CLIENTS_PER_PAGE)
      setLoading(false)
      // Deep prefetch: Load full details for top 20 clients
      deepPrefetchClients()
      // Still refresh in background
      fetchClientsBackground()
    } else {
      fetchClients()
    }
  }, [])

  const fetchClientsBackground = async () => {
    const { data } = await supabase
      .from('clients')
      .select(`*, contact_numbers (id, number, is_on_whatsapp)`)
      .order('created_at', { ascending: false })
      .range(0, CLIENTS_PER_PAGE - 1)

    if (data) {
      setClients(data)
      setCachedClients(data)
      setHasMore(data.length === CLIENTS_PER_PAGE)
    }
  }

  const fetchClients = async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('clients')
      .select(`*, contact_numbers (id, number, is_on_whatsapp)`)
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

  const loadMore = async () => {
    if (loadingMore || !hasMore) return

    setLoadingMore(true)
    const from = clients.length
    const to = from + CLIENTS_PER_PAGE - 1

    const { data, error } = await supabase
      .from('clients')
      .select(`*, contact_numbers (id, number, is_on_whatsapp)`)
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
        onLoadMore={loadMore}
      />
    </div>
  )
}
