'use client'

import { useState, useEffect } from 'react'
import { Modal } from '@/components/ui'
import { Button } from '@/components/ui/Button'
import { createClient } from '@/lib/supabase/client'
import { deleteClient, getClient } from '@/app/actions/clients'
import { useClientCache } from '@/lib/query'
import { ClientHeader } from './components/ClientHeader'
import { ContactInfo } from './components/ContactInfo'
import { LocationInfo } from './components/LocationInfo'
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
  const [client, setClient] = useState<Client | null>(null)
  const [phoneNumbers, setPhoneNumbers] = useState<ContactNumber[]>([])
  const [notes, setNotes] = useState<ClientNote[]>([])
  const [cases, setCases] = useState<CaseWithStatus[]>([])
  const [loading, setLoading] = useState(true)
  const [countryName, setCountryName] = useState<string | null>(null)
  const [cityName, setCityName] = useState<string | null>(null)
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [clientId, setClientId] = useState<string | null>(null)
  const [actualClientId, setActualClientId] = useState<string | null>(null)
  const supabase = createClient()

  // Use cache for instant loading (will be populated by deep prefetch)
  const { getCached, setCached } = useClientCache(actualClientId || '')

  useEffect(() => {
    async function initClientId() {
      const { id } = await params
      setClientId(id)
    }
    initClientId()
  }, [params])

  useEffect(() => {
    if (clientId) {
      // Try cache first for instant display
      tryLoadFromCache()
    }
  }, [clientId])

  async function tryLoadFromCache() {
    if (!clientId) return

    // If it's a UUID (not a client_code), try cache first
    if (!clientId.startsWith('CL')) {
      setActualClientId(clientId)
      const cached = getCached()
      if (cached?.client) {
        console.log('[ClientPage] Using cached client data')
        setClient(cached.client)
        setPhoneNumbers(cached.phoneNumbers || [])
        setNotes(cached.notes || [])
        setCases(cached.cases || [])
        setCountryName(cached.countryName)
        setCityName(cached.cityName)
        setLoading(false)
        // Still refresh in background
        fetchAllData()
        return
      }
    }

    // No cache or client_code - fetch fresh
    fetchAllData()
  }

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

  // Handler for optimistic contact updates
  const handleContactUpdate = async () => {
    if (!client) return
    const { data: phonesData } = await supabase
      .from('contact_numbers')
      .select('*')
      .eq('client_id', client.id)
      .order('number')
    if (phonesData) setPhoneNumbers(phonesData)
  }

  // Handler for location updates
  const handleLocationUpdate = async () => {
    if (!client) return
    const result = await supabase
      .from('clients')
      .select('*')
      .eq('id', client.id)
      .single()
    
    if (result.data) {
      setClient(result.data)
      
      if (result.data.country_of_origin) {
        const { data: countryData } = await supabase
          .from('countries')
          .select('country')
          .eq('id', result.data.country_of_origin)
          .single()
        if (countryData) setCountryName(countryData.country)
      }

      if (result.data.city_in_poland) {
        const { data: cityData } = await supabase
          .from('cities')
          .select('city')
          .eq('id', result.data.city_in_poland)
          .single()
        if (cityData) setCityName(cityData.city)
      }
    }
  }

  async function fetchAllData() {
    if (!clientId) return
    setLoading(true)

    let clientData, clientError
    
    if (clientId.startsWith('CL')) {
      const result = await supabase
        .from('clients')
        .select('*')
        .eq('client_code', clientId)
        .single()
      
      clientData = result.data
      clientError = result.error
    } else {
      const result = await supabase
        .from('clients')
        .select('*')
        .eq('id', clientId)
        .single()
      
      clientData = result.data
      clientError = result.error
    }

    if (clientError || !clientData) {
      console.error('Error fetching client:', clientError)
      setLoading(false)
      return
    }

    setClient(clientData)
    const dbClientId = clientData.id

    const { data: phonesData } = await supabase
      .from('contact_numbers')
      .select('*')
      .eq('client_id', dbClientId)
      .order('number')

    if (phonesData) setPhoneNumbers(phonesData)

    const { data: notesData } = await supabase
      .from('client_notes')
      .select('*')
      .eq('client_id', dbClientId)
      .order('is_pinned', { ascending: false })
      .order('created_at', { ascending: false })

    if (notesData) setNotes(notesData)

    // Fetch cases with services
    const { data: casesData, error: casesError } = await supabase
      .from('cases')
      .select(`
        *,
        status(name),
        case_services:case_services!case_id(
          services(name)
        )
      `)
      .eq('client_id', dbClientId)
      .order('created_at', { ascending: false })

    if (casesError) console.error('Error fetching cases:', casesError)
    if (casesData) setCases(casesData)

    if (clientData.country_of_origin) {
      const { data: countryData } = await supabase
        .from('countries')
        .select('country')
        .eq('id', clientData.country_of_origin)
        .single()
      
      if (countryData) setCountryName(countryData.country)
    }

    if (clientData.city_in_poland) {
      const { data: cityData } = await supabase
        .from('cities')
        .select('city')
        .eq('id', clientData.city_in_poland)
        .single()
      
      if (cityData) setCityName(cityData.city)
    }

    setLoading(false)
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
        onDelete={() => setIsDeleteModalOpen(true)} 
      />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <ContactInfo 
          client={client} 
          phoneNumbers={phoneNumbers} 
          onUpdate={handleContactUpdate} 
        />
        
        <LocationInfo 
          client={client} 
          countryName={countryName} 
          cityName={cityName} 
          onUpdate={handleLocationUpdate} 
        />
      </div>

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
