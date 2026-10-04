'use client'

import { useState, useEffect, useRef, use } from 'react'
import Link from 'next/link'
import { Modal } from '@/components/ui'
import { User, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { createClient } from '@/lib/supabase/client'
import { deleteClient, getClientPageData } from '@/app/actions/clients'
import { addRecentClient } from '@/lib/recent-clients'
import { useQueryClient } from '@tanstack/react-query'
import { queryKeys } from '@/lib/query'
import { usePaneNavigate } from '@/lib/panes'
import { ClientHeader } from './components/ClientHeader'
import { CasesSection } from './components/CasesSection'
import { NotesSection } from './components/NotesSection'
import type { Client, ContactNumber, ClientNote, Case, Status } from '@/types/database'

interface CaseWithStatus extends Case {
  status?: Status
}

interface ClientPageProps {
  params: Promise<{ id: string }>
}

export default function ClientPage({ params }: ClientPageProps) {
  // Use React 19's use() to synchronously unwrap the params Promise
  const { id: urlId } = use(params)
  const paneNav = usePaneNavigate()

  const [client, setClient] = useState<Client | null>(null)
  const [phoneNumbers, setPhoneNumbers] = useState<ContactNumber[]>([])
  const [notes, setNotes] = useState<ClientNote[]>([])
  const [cases, setCases] = useState<CaseWithStatus[]>([])
  const [loading, setLoading] = useState(true)
  const [countryName, setCountryName] = useState<string | null>(null)
  const [cityName, setCityName] = useState<string | null>(null)
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [resolvedClientId, setResolvedClientId] = useState<string | null>(null)
  const supabase = createClient()
  const isMounted = useRef(true)
  
  // Access query client directly for cache lookup
  const queryClient = useQueryClient()

  // Single effect to initialize and load data
  useEffect(() => {
    isMounted.current = true
    
    async function loadClientData() {
      const cached = queryClient.getQueryData<any>(queryKeys.client(urlId))
      if (cached?.client && isMounted.current) {
        setClient(cached.client)
        setPhoneNumbers(cached.phoneNumbers || [])
        setNotes(cached.notes || [])
        setCases(cached.cases || [])
        setCountryName(cached.countryName)
        setCityName(cached.cityName)
        setResolvedClientId(cached.client.id)
        setLoading(false)
        // Background refresh
        fetchAllData(urlId, false)
        return
      }

      // No cache hit - fetch fresh data
      await fetchAllData(urlId, true)
    }
    
    loadClientData()
    
    return () => {
      isMounted.current = false
    }
  }, [urlId])

  // Refetch the case list when a case pane/page mutates this client's cases
  useEffect(() => {
    if (!resolvedClientId) return
    const handler = async (e: Event) => {
      if ((e as CustomEvent).detail?.clientId !== resolvedClientId) return
      const { data } = await supabase
        .from('cases')
        .select(`*, status(name), csr:users!cases_csr_id_fkey(id, display_name, email), legal:users!cases_assigned_to_fkey(id, display_name, email), case_services:case_services!case_id(services(name))`)
        .eq('client_id', resolvedClientId)
        .order('created_at', { ascending: false })
      if (data) setCases(data)
    }
    window.addEventListener('nexus:client-data-changed', handler)
    return () => window.removeEventListener('nexus:client-data-changed', handler)
  }, [resolvedClientId])

  // Track visit for the mobile "Recent clients" strip
  useEffect(() => {
    if (!client) return
    addRecentClient({
      id: client.id,
      name: [client.first_name, client.last_name].filter(Boolean).join(' ') || client.client_code || 'Client',
      phone: phoneNumbers[0]?.number ?? null,
    })
  }, [client, phoneNumbers])

  // Handler for optimistic case addition
  const handleCaseAdded = (newCase: CaseWithStatus) => {
    setCases(prevCases => [newCase, ...prevCases])
  }

  // Handler for optimistic note updates
  const handleNotesUpdate = async () => {
    if (!client) return
    const { data: notesData } = await supabase
      .from('client_notes')
      .select('*')
      .eq('client_id', client.id)
      .order('is_pinned', { ascending: false })
      .order('created_at', { ascending: false })
    if (notesData) setNotes(notesData)
  }

  async function fetchAllData(clientIdParam: string, showLoading = true) {
    if (!clientIdParam) return
    if (showLoading) setLoading(true)

    const data = await getClientPageData(clientIdParam)
    if (!isMounted.current) return

    if ('error' in data || !data.client) {
      console.error('Error fetching client')
      setLoading(false)
      return
    }

    setClient(data.client as Client)
    setResolvedClientId(data.client.id)
    setPhoneNumbers((data.phoneNumbers as ContactNumber[]) || [])
    setNotes((data.notes as ClientNote[]) || [])
    setCases((data.cases as CaseWithStatus[]) || [])
    setCountryName(data.countryName)
    setCityName(data.cityName)

    // Update cache under both UUID and client_code so any URL variant hits it
    const payload = {
      client: data.client,
      phoneNumbers: data.phoneNumbers || [],
      notes: data.notes || [],
      cases: data.cases || [],
      countryName: data.countryName,
      cityName: data.cityName,
    }
    queryClient.setQueryData(queryKeys.client(data.client.id), payload)
    if (data.client.client_code) {
      queryClient.setQueryData(queryKeys.client(data.client.client_code), payload)
    }

    setLoading(false)
  }

  // Wrapper for onMergeComplete that uses current urlId
  const handleRefresh = () => {
    fetchAllData(urlId, true)
  }

  const handleDeleteClient = async () => {
    if (!client) return
    
    setSubmitting(true)
    const result = await deleteClient(client.id)
    
    if (!result?.error) {
      window.location.href = '/clients'
    } else {
      alert(result.error)
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-200px)]">
        <p className="text-[hsl(var(--color-text-secondary))]">Loading client...</p>
      </div>
    )
  }

  if (!client) {
    return (
      <div className="flex flex-col items-center justify-center h-[calc(100vh-200px)] gap-4">
        <p className="text-[hsl(var(--color-text-secondary))]">Client not found</p>
        <Button onClick={() => window.location.href = '/clients'}>Back to Clients</Button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <ClientHeader 
        client={client}
        phoneNumbers={phoneNumbers}
        onDelete={() => setIsDeleteModalOpen(true)}
        onMergeComplete={handleRefresh}
      />

      {/* Page title */}
      <div>
        <h2 className="text-xl font-bold text-[hsl(var(--color-text-primary))]">
          {[client.first_name, client.last_name].filter(Boolean).join(' ') || client.contact_email || 'Unnamed'}
        </h2>
        <p className="text-sm text-[hsl(var(--color-text-secondary))] mt-0.5">
          {[
            phoneNumbers.length > 0 ? phoneNumbers.map(p => `${p.country_code || ''} ${p.number}`.trim()).join(' · ') : null,
            client.client_code,
          ].filter(Boolean).join(' · ') || '—'}
        </p>
      </div>

      {/* Client information */}
      <Link
        href={`/clients/${client.id}/info`}
        onClick={(e) => { if (paneNav(`/clients/${client.id}/info`)) e.preventDefault() }}
        className="w-full flex items-center gap-3 rounded-xl border border-[hsl(var(--color-border))] bg-[hsl(var(--color-surface))] px-4 py-3.5 hover:bg-[hsl(var(--color-surface-hover))] transition-colors"
      >
        <User className="w-5 h-5 text-[hsl(var(--color-text-secondary))] shrink-0" />
        <div className="min-w-0 flex-1 text-left">
          <p className="text-sm font-semibold text-[hsl(var(--color-text-primary))]">Client information</p>
          <p className="text-xs text-[hsl(var(--color-text-secondary))] mt-0.5">
            Added {new Date(client.created_at).toLocaleDateString()}
          </p>
        </div>
        <ChevronRight className="w-5 h-5 text-[hsl(var(--color-text-muted))] shrink-0" />
      </Link>

      <CasesSection 
        clientId={client.id} 
        cases={cases} 
        onCaseAdded={handleCaseAdded} 
      />

      <NotesSection 
        clientId={client.id} 
        notes={notes} 
        onUpdate={handleNotesUpdate} 
      />

      {/* Mobile Delete Button - shows at bottom on mobile only */}
      <div className="sm:hidden pb-20">
        <Button 
          variant="ghost"
          onClick={() => setIsDeleteModalOpen(true)}
          className="w-full text-red-400 hover:text-red-300 hover:bg-red-500/10 border border-red-500/20"
        >
          <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
          Delete Client
        </Button>
      </div>

      <Modal
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        title="Delete Client"
      >
        <div className="space-y-4">
          <p className="text-[hsl(var(--color-text-primary))]">
            Are you sure you want to delete <strong>{client?.first_name} {client?.last_name}</strong>?
          </p>
          <p className="text-[hsl(var(--color-text-secondary))] text-sm">
            This action cannot be undone. All associated data including notes, phone numbers, cases, and documents will be permanently deleted.
          </p>

          <div className="flex justify-end gap-3 pt-4">
            <Button
              type="button"
              variant="ghost"
              onClick={() => setIsDeleteModalOpen(false)}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button 
              onClick={handleDeleteClient} 
              disabled={submitting}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              {submitting ? 'Deleting...' : 'Delete Client'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
