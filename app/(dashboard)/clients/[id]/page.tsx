'use client'

import { useState, useEffect, useRef, use } from 'react'
import { Modal } from '@/components/ui'
import { Button } from '@/components/ui/Button'
import { createClient } from '@/lib/supabase/client'
import { deleteClient, getClient } from '@/app/actions/clients'
import { useQueryClient } from '@tanstack/react-query'
import { queryKeys } from '@/lib/query'
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
  // Use React 19's use() to synchronously unwrap the params Promise
  const { id: urlId } = use(params)
  
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
      // Check if urlId is a client_code (starts with CL) or a UUID
      const isClientCode = urlId.startsWith('CL')
      
      // Try cache first for UUIDs only (client_codes aren't cached by ID)
      if (!isClientCode) {
        const cached = queryClient.getQueryData<any>(queryKeys.client(urlId))
        if (cached?.client && isMounted.current) {
          console.log('[ClientPage] Using cached client data for', urlId)
          setClient(cached.client)
          setPhoneNumbers(cached.phoneNumbers || [])
          setNotes(cached.notes || [])
          setCases(cached.cases || [])
          setCountryName(cached.countryName)
          setCityName(cached.cityName)
          setResolvedClientId(urlId)
          setLoading(false)
          // Background refresh
          fetchAllData(urlId, false)
          return
        }
      }
      
      // No cache hit - fetch fresh data
      await fetchAllData(urlId, true)
    }
    
    loadClientData()
    
    return () => {
      isMounted.current = false
    }
  }, [urlId])

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

  async function fetchAllData(clientIdParam: string, showLoading = true) {
    if (!clientIdParam) return
    if (showLoading) setLoading(true)

    let clientData, clientError
    
    if (clientIdParam.startsWith('CL')) {
      const result = await supabase
        .from('clients')
        .select('*')
        .eq('client_code', clientIdParam)
        .single()
      
      clientData = result.data
      clientError = result.error
    } else {
      const result = await supabase
        .from('clients')
        .select('*')
        .eq('id', clientIdParam)
        .single()
      
      clientData = result.data
      clientError = result.error
    }

    if (!isMounted.current) return
    
    if (clientError || !clientData) {
      console.error('Error fetching client:', clientError)
      setLoading(false)
      return
    }

    setClient(clientData)
    setResolvedClientId(clientData.id)
    const dbClientId = clientData.id

    const { data: phonesData } = await supabase
      .from('contact_numbers')
      .select('*')
      .eq('client_id', dbClientId)
      .order('number')

    if (!isMounted.current) return
    if (phonesData) setPhoneNumbers(phonesData)

    const { data: notesData } = await supabase
      .from('client_notes')
      .select('*')
      .eq('client_id', dbClientId)
      .order('is_pinned', { ascending: false })
      .order('created_at', { ascending: false })

    if (!isMounted.current) return
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

    if (!isMounted.current) return
    if (casesError) console.error('Error fetching cases:', casesError)
    if (casesData) setCases(casesData)

    let resolvedCountryName: string | null = null
    let resolvedCityName: string | null = null

    if (clientData.country_of_origin) {
      const { data: countryData } = await supabase
        .from('countries')
        .select('country')
        .eq('id', clientData.country_of_origin)
        .single()
      
      if (!isMounted.current) return
      if (countryData) {
        resolvedCountryName = countryData.country
        setCountryName(countryData.country)
      }
    }

    if (clientData.city_in_poland) {
      const { data: cityData } = await supabase
        .from('cities')
        .select('city')
        .eq('id', clientData.city_in_poland)
        .single()
      
      if (!isMounted.current) return
      if (cityData) {
        resolvedCityName = cityData.city
        setCityName(cityData.city)
      }
    }

    // Update cache for future visits
    queryClient.setQueryData(queryKeys.client(dbClientId), {
      client: clientData,
      phoneNumbers: phonesData || [],
      notes: notesData || [],
      cases: casesData || [],
      countryName: resolvedCountryName,
      cityName: resolvedCityName
    })

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
