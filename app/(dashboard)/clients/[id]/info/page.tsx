'use client'

import { use, useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { SubPageHeader } from '@/components/shared/SubPageHeader'
import { ContactInfo } from '../components/ContactInfo'
import { IdentificationInfo } from '../components/IdentificationInfo'
import { LocationInfo } from '../components/LocationInfo'
import { Loader2, User } from 'lucide-react'
import type { Client, ContactNumber } from '@/types/database'

interface ClientInfoPageProps {
  params: Promise<{ id: string }>
}

export default function ClientInfoPage({ params }: ClientInfoPageProps) {
  const { id: urlId } = use(params)
  const [client, setClient] = useState<Client | null>(null)
  const [phoneNumbers, setPhoneNumbers] = useState<ContactNumber[]>([])
  const [countryName, setCountryName] = useState<string | null>(null)
  const [cityName, setCityName] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const isMounted = useRef(true)
  const supabase = createClient()

  useEffect(() => {
    isMounted.current = true
    load()
    return () => { isMounted.current = false }
  }, [urlId])

  const load = async () => {
    const result = urlId.startsWith('CL')
      ? await supabase.from('clients').select('*').eq('client_code', urlId).single()
      : await supabase.from('clients').select('*').eq('id', urlId).single()
    if (!isMounted.current) return
    const clientData = result.data
    if (!clientData) { setLoading(false); return }
    setClient(clientData)

    const { data: phonesData } = await supabase
      .from('contact_numbers')
      .select('*')
      .eq('client_id', clientData.id)
      .order('number')
    if (!isMounted.current) return
    setPhoneNumbers(phonesData || [])

    if (clientData.country_of_origin) {
      const { data: c } = await supabase.from('countries').select('country').eq('id', clientData.country_of_origin).single()
      if (c) setCountryName(c.country)
    }
    if (clientData.city_in_poland) {
      const { data: c } = await supabase.from('cities').select('city').eq('id', clientData.city_in_poland).single()
      if (c) setCityName(c.city)
    }
    setLoading(false)
  }

  const handleContactUpdate = async () => {
    if (!client) return
    const { data } = await supabase
      .from('contact_numbers').select('*').eq('client_id', client.id).order('number')
    if (data) setPhoneNumbers(data)
  }

  const handleLocationUpdate = () => load()

  if (loading) {
    return (
      <div className="flex justify-center py-16 text-[hsl(var(--color-text-secondary))]">
        <Loader2 className="w-6 h-6 animate-spin" />
      </div>
    )
  }
  if (!client) return <div className="flex items-center justify-center min-h-screen"><p>Client not found</p></div>

  const clientName = [client.first_name, client.last_name].filter(Boolean).join(' ') || client.contact_email || 'Client'
  const phone = phoneNumbers[0] ? `${phoneNumbers[0].country_code || ''} ${phoneNumbers[0].number}`.trim() : ''
  const subtitle = [clientName, phone].filter(Boolean).join(' · ')

  return (
    <div className="max-w-3xl mx-auto pb-20">
      <SubPageHeader backHref={`/clients/${urlId}`} title="Client information" subtitle={subtitle} icon={<User className="w-4 h-4 text-white" />} />
      <div className="space-y-6">
        <ContactInfo client={client} phoneNumbers={phoneNumbers} onUpdate={handleContactUpdate} />
        <IdentificationInfo client={client} onUpdate={handleLocationUpdate} />
        <LocationInfo client={client} countryName={countryName} cityName={cityName} onUpdate={handleLocationUpdate} />
      </div>
    </div>
  )
}
