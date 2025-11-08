'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle, Modal } from '@/components/ui'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { createClient } from '@/lib/supabase/client'
import { addNote, deleteNote, togglePinNote } from '@/app/actions/notes'
import { addPhoneNumber, deletePhoneNumber, updatePhoneNumber, updateWhatsAppStatus } from '@/app/actions/phones'
import { updateClient, deleteClient } from '@/app/actions/clients'
import { addCase } from '@/app/actions/cases'
import { getAllCountries, getAllCities, updateClientLocation } from '@/app/actions/locations'
import type { Client, ContactNumber, ClientNote, Country, City, Case, Status, User } from '@/types/database'

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
  const [countries, setCountries] = useState<Country[]>([])
  const [cities, setCities] = useState<City[]>([])
  const [statuses, setStatuses] = useState<Status[]>([])
  const [users, setUsers] = useState<User[]>([])
  const [isEditingLocation, setIsEditingLocation] = useState(false)
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false)
  const [isNoteModalOpen, setIsNoteModalOpen] = useState(false)
  const [isPhoneModalOpen, setIsPhoneModalOpen] = useState(false)
  const [isCaseModalOpen, setIsCaseModalOpen] = useState(false)
  const [isEditLocationModalOpen, setIsEditLocationModalOpen] = useState(false)
  const [isEditingContact, setIsEditingContact] = useState(false)
  const [newNote, setNewNote] = useState('')
  const [newPhone, setNewPhone] = useState('')
  const [isWhatsapp, setIsWhatsapp] = useState(false)
  const [selectedStatus, setSelectedStatus] = useState<string>('')
  const [selectedAssignee, setSelectedAssignee] = useState<string>('')
  const [submitting, setSubmitting] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    fetchAllData()
  }, [params])

  useEffect(() => {
    // Fetch countries and cities when entering location edit mode
    if (isEditingLocation && countries.length === 0) {
      getAllCountries().then(setCountries)
      getAllCities().then(setCities)
    }
  }, [isEditingLocation])

  useEffect(() => {
    // Fetch statuses and users when opening case modal
    if (isCaseModalOpen) {
      if (statuses.length === 0) {
        supabase.from('status').select('*').order('position', { ascending: true }).then(({ data }) => {
          if (data) setStatuses(data)
        })
      }
      if (users.length === 0) {
        supabase.from('users').select('*').order('display_name', { ascending: true }).then(({ data }) => {
          if (data) setUsers(data)
        })
      }
    }
  }, [isCaseModalOpen])

  async function fetchAllData() {
    const { id } = await params
    setLoading(true)

    // Try to fetch client by client_code first, then by UUID
    let clientData, clientError
    
    // Check if it's a client code (starts with CL) or UUID
    if (id.startsWith('CL')) {
      const result = await supabase
        .from('clients')
        .select('*')
        .eq('client_code', id)
        .single()
      
      clientData = result.data
      clientError = result.error
    } else {
      const result = await supabase
        .from('clients')
        .select('*')
        .eq('id', id)
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

    // Use the actual client UUID for related queries
    const clientId = clientData.id

    // Fetch phone numbers
    const { data: phonesData } = await supabase
      .from('contact_numbers')
      .select('*')
      .eq('client_id', clientId)
      .order('number')

    if (phonesData) {
      setPhoneNumbers(phonesData)
    }

    // Fetch notes
    const { data: notesData } = await supabase
      .from('client_notes')
      .select('*')
      .eq('client_id', clientId)
      .order('is_pinned', { ascending: false })
      .order('created_at', { ascending: false })

    if (notesData) {
      setNotes(notesData)
    }

    // Fetch cases
    const { data: casesData } = await supabase
      .from('cases')
      .select('*, status(name)')
      .eq('client_id', clientId)
      .order('created_at', { ascending: false })

    if (casesData) {
      setCases(casesData)
    }

    // Fetch country name if exists
    if (clientData.country_of_origin) {
      const { data: countryData } = await supabase
        .from('countries')
        .select('country')
        .eq('id', clientData.country_of_origin)
        .single()
      
      if (countryData) {
        setCountryName(countryData.country)
      }
    }

    // Fetch city name if exists
    if (clientData.city_in_poland) {
      const { data: cityData } = await supabase
        .from('cities')
        .select('city')
        .eq('id', clientData.city_in_poland)
        .single()
      
      if (cityData) {
        setCityName(cityData.city)
      }
    }

    setLoading(false)
  }

  const handleAddNote = async () => {
    if (!client || !newNote.trim()) return
    
    setSubmitting(true)
    const result = await addNote(client.id, newNote)
    
    if (result.error) {
      alert(result.error)
    } else {
      setNewNote('')
      setIsNoteModalOpen(false)
      fetchAllData()
    }
    setSubmitting(false)
  }

  const handleDeleteNote = async (noteId: string) => {
    if (!client || !confirm('Delete this note?')) return
    
    const result = await deleteNote(noteId, client.id)
    if (!result.error) {
      fetchAllData()
    }
  }

  const handleTogglePin = async (noteId: string, isPinned: boolean) => {
    if (!client) return
    
    const result = await togglePinNote(noteId, client.id, isPinned)
    if (!result.error) {
      fetchAllData()
    }
  }

  const handleAddPhone = async () => {
    if (!client || !newPhone.trim()) return
    
    setSubmitting(true)
    const result = await addPhoneNumber(client.id, newPhone, isWhatsapp)
    
    if (result.error) {
      alert(result.error)
    } else {
      setNewPhone('')
      setIsWhatsapp(false)
      setIsPhoneModalOpen(false)
      fetchAllData()
    }
    setSubmitting(false)
  }

  const handleDeletePhone = async (phoneId: string) => {
    if (!client || !confirm('Delete this phone number?')) return
    
    const result = await deletePhoneNumber(phoneId, client.id)
    if (!result.error) {
      fetchAllData()
    }
  }

  const handleUpdatePhone = async (phoneId: string, number: string) => {
    if (!client) return
    
    const result = await updatePhoneNumber(phoneId, client.id, number)
    if (!result.error) {
      fetchAllData()
    }
  }

  const handleUpdateWhatsApp = async (phoneId: string, isOnWhatsapp: boolean) => {
    if (!client) return
    
    const result = await updateWhatsAppStatus(phoneId, client.id, isOnWhatsapp)
    if (!result.error) {
      fetchAllData()
    }
  }

  const handleAddCase = async () => {
    if (!client) return
    
    setSubmitting(true)
    const formData = new FormData()
    formData.set('clientId', client.id)
    if (selectedStatus) formData.set('statusId', selectedStatus)
    if (selectedAssignee) formData.set('assignedTo', selectedAssignee)
    
    const result = await addCase(formData)
    
    if (result.error) {
      alert(result.error)
    } else {
      setSelectedStatus('')
      setSelectedAssignee('')
      setIsCaseModalOpen(false)
      fetchAllData()
    }
    setSubmitting(false)
  }

  const handleUpdateLocation = async (countryId: string | null, cityId: string | null) => {
    if (!client) return
    
    try {
      await updateClientLocation(client.id, countryId, cityId)
      fetchAllData()
    } catch (error) {
      console.error('Error updating location:', error)
      alert('Failed to update location')
    }
  }

  const handleDeleteClient = async () => {
    if (!client) return
    
    setSubmitting(true)
    const result = await deleteClient(client.id)
    
    if (result.error) {
      alert(result.error)
      setSubmitting(false)
    } else {
      // Redirect to clients list after successful deletion
      router.push('/clients')
    }
  }

  const handleUpdateClient = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!client) return
    
    setSubmitting(true)
    const formData = new FormData(e.currentTarget)
    const result = await updateClient(client.id, formData)
    
    if (result.error) {
      alert(result.error)
    } else {
      setIsEditLocationModalOpen(false)
      fetchAllData()
    }
    setSubmitting(false)
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
        <Button onClick={() => router.push('/clients')}>Back to Clients</Button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-start">
        <div>
          <Button 
            variant="ghost" 
            onClick={() => router.push('/clients')}
            className="mb-4"
          >
            ← Back to Clients
          </Button>
          <h1 className="text-3xl font-bold text-[hsl(var(--color-text-primary))]">
            {client.first_name || client.last_name || client.contact_email || 'Unnamed Client'}
            {client.first_name && client.last_name && ` ${client.last_name}`}
          </h1>
          <div className="mt-2 space-y-1">
            {client.client_code && (
              <p className="text-[hsl(var(--color-text-secondary))] font-mono">
                {client.client_code}
              </p>
            )}
            <p className="text-[hsl(var(--color-text-secondary))]">
              Client since {new Date(client.created_at).toLocaleDateString()}
            </p>
          </div>
        </div>
        <div className="flex gap-3">
          <Button 
            variant="ghost" 
            onClick={() => setIsDeleteModalOpen(true)}
          >
            Delete
          </Button>
        </div>
      </div>

      {/* Client Information */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Contact Information */}
        <Card>
          <CardHeader>
            <div className="flex justify-between items-center">
              <CardTitle>Contact Information</CardTitle>
              {isEditingContact ? (
                <Button 
                  size="sm" 
                  variant="outline"
                  onClick={() => setIsEditingContact(false)}
                >
                  Done
                </Button>
              ) : (
                <Button 
                  size="sm" 
                  variant="ghost"
                  onClick={() => setIsEditingContact(true)}
                >
                  Edit
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-sm font-medium text-[hsl(var(--color-text-secondary))]">
                Full Name
              </label>
              {isEditingContact ? (
                <div className="flex gap-2 mt-1">
                  <Input
                    placeholder="First Name"
                    defaultValue={client.first_name}
                    onBlur={(e) => {
                      if (e.target.value !== client.first_name) {
                        const formData = new FormData()
                        formData.set('firstName', e.target.value)
                        formData.set('lastName', client.last_name || '')
                        formData.set('email', client.contact_email || '')
                        updateClient(client.id, formData).then(() => fetchAllData())
                      }
                    }}
                  />
                  <Input
                    placeholder="Last Name"
                    defaultValue={client.last_name}
                    onBlur={(e) => {
                      if (e.target.value !== client.last_name) {
                        const formData = new FormData()
                        formData.set('firstName', client.first_name || '')
                        formData.set('lastName', e.target.value)
                        formData.set('email', client.contact_email || '')
                        updateClient(client.id, formData).then(() => fetchAllData())
                      }
                    }}
                  />
                </div>
              ) : (
                <p className="text-[hsl(var(--color-text-primary))] mt-1">
                  {client.first_name} {client.last_name}
                </p>
              )}
            </div>

            <div>
              <label className="text-sm font-medium text-[hsl(var(--color-text-secondary))]">
                Email Address
              </label>
              {isEditingContact ? (
                <Input
                  type="email"
                  placeholder="Email"
                  defaultValue={client.contact_email || ''}
                  className="mt-1"
                  onBlur={(e) => {
                    if (e.target.value !== client.contact_email) {
                      const formData = new FormData()
                      formData.set('firstName', client.first_name || '')
                      formData.set('lastName', client.last_name || '')
                      formData.set('email', e.target.value)
                      updateClient(client.id, formData).then(() => fetchAllData())
                    }
                  }}
                />
              ) : (
                <p className="text-[hsl(var(--color-text-primary))] mt-1">
                  {client.contact_email || '-'}
                </p>
              )}
            </div>

            <div>
              <label className="text-sm font-medium text-[hsl(var(--color-text-secondary))]">
                Phone Numbers
              </label>
              <div className="space-y-2 mt-1">
                {phoneNumbers.length === 0 ? (
                  <p className="text-[hsl(var(--color-text-primary))]">-</p>
                ) : (
                  phoneNumbers.map((phone) => (
                    <div key={phone.id} className="flex items-center justify-between gap-2">
                      {isEditingContact ? (
                        <>
                          <div className="flex-1 flex items-center gap-2">
                            <Input
                              defaultValue={phone.number}
                              onBlur={(e) => {
                                if (e.target.value !== phone.number) {
                                  handleUpdatePhone(phone.id, e.target.value)
                                }
                              }}
                              className="flex-1"
                            />
                            <label className="flex items-center gap-2 whitespace-nowrap">
                              <input
                                type="checkbox"
                                defaultChecked={phone.is_on_whatsapp}
                                onChange={(e) => {
                                  handleUpdateWhatsApp(phone.id, e.target.checked)
                                }}
                                className="w-4 h-4 rounded border-[hsl(var(--color-border))]"
                              />
                              <span className="text-sm text-[hsl(var(--color-text-secondary))]">
                                WhatsApp
                              </span>
                            </label>
                          </div>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleDeletePhone(phone.id)}
                          >
                            Delete
                          </Button>
                        </>
                      ) : (
                        <div className="flex items-center gap-2">
                          <p className="text-[hsl(var(--color-text-primary))]">
                            {phone.number}
                          </p>
                          {phone.is_on_whatsapp && (
                            <span className="text-xs bg-green-500/20 text-green-500 px-2 py-0.5 rounded">
                              WhatsApp
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  ))
                )}
                {isEditingContact && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setIsPhoneModalOpen(true)}
                    className="w-full mt-2"
                  >
                    + Add Phone Number
                  </Button>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Location Information */}
        <Card>
          <CardHeader>
            <div className="flex justify-between items-center">
              <CardTitle>Location Information</CardTitle>
              {isEditingLocation ? (
                <Button 
                  size="sm" 
                  variant="outline"
                  onClick={() => setIsEditingLocation(false)}
                >
                  Done
                </Button>
              ) : (
                <Button 
                  size="sm" 
                  variant="ghost"
                  onClick={() => setIsEditingLocation(true)}
                >
                  Edit
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-sm font-medium text-[hsl(var(--color-text-secondary))]">
                Country of Origin
              </label>
              {isEditingLocation ? (
                <div className="mt-1">
                  <Select
                    options={countries.map(c => ({ id: c.id, label: c.country }))}
                    value={client?.country_of_origin || ''}
                    onChange={(countryId) => handleUpdateLocation(countryId, client?.city_in_poland || null)}
                    placeholder="Select country..."
                    searchPlaceholder="Search countries..."
                  />
                </div>
              ) : (
                <p className="text-[hsl(var(--color-text-primary))] mt-1">
                  {countryName || '-'}
                </p>
              )}
            </div>

            <div>
              <label className="text-sm font-medium text-[hsl(var(--color-text-secondary))]">
                City in Poland
              </label>
              {isEditingLocation ? (
                <div className="mt-1">
                  <Select
                    options={cities.map(c => ({ id: c.id, label: c.city }))}
                    value={client?.city_in_poland || ''}
                    onChange={(cityId) => handleUpdateLocation(client?.country_of_origin || null, cityId)}
                    placeholder="Select city..."
                    searchPlaceholder="Search cities..."
                  />
                </div>
              ) : (
                <p className="text-[hsl(var(--color-text-primary))] mt-1">
                  {cityName || '-'}
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Cases Section */}
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <CardTitle>Cases</CardTitle>
            <Button size="sm" onClick={() => setIsCaseModalOpen(true)}>+ Add Case</Button>
          </div>
        </CardHeader>
        <CardContent>
          {cases.length === 0 ? (
            <p className="text-[hsl(var(--color-text-secondary))] text-center py-8">
              No cases yet for this client
            </p>
          ) : (
            <div className="space-y-2">
              {cases.map((caseItem) => (
                <div
                  key={caseItem.id}
                  className="flex items-center justify-between p-3 rounded border border-[hsl(var(--color-border))] hover:bg-[hsl(var(--color-surface-hover))] transition-colors cursor-pointer"
                  onClick={() => router.push(`/cases/${caseItem.case_code || caseItem.id}`)}
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-sm text-[hsl(var(--color-text-primary))]">
                        {caseItem.case_code || 'Case'}
                      </span>
                      {caseItem.status && (
                        <span className="text-xs px-2 py-0.5 rounded bg-[hsl(var(--color-primary))]/10 text-[hsl(var(--color-primary))]">
                          {caseItem.status.name}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-[hsl(var(--color-text-secondary))] mt-1">
                      Created {new Date(caseItem.created_at).toLocaleDateString()}
                    </p>
                  </div>
                  <Button variant="ghost" size="sm">
                    Open
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Documents Section */}
      <Card>
        <CardHeader>
          <CardTitle>Documents</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-[hsl(var(--color-text-secondary))] text-center py-8">
            Documents from cases will appear here
          </p>
        </CardContent>
      </Card>

      {/* Notes Section */}
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <CardTitle>Notes</CardTitle>
            <Button size="sm" onClick={() => setIsNoteModalOpen(true)}>
              + Add Note
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {notes.length === 0 ? (
            <p className="text-[hsl(var(--color-text-secondary))] text-center py-8">
              No notes yet
            </p>
          ) : (
            <div className="space-y-3">
              {notes.map((note) => (
                <div
                  key={note.id}
                  className="p-4 rounded-lg bg-[hsl(var(--color-surface-hover))] border border-[hsl(var(--color-border))]"
                >
                  <div className="flex justify-between items-start gap-4">
                    <div className="flex-1">
                      <p className="text-[hsl(var(--color-text-primary))] whitespace-pre-wrap">
                        {note.note}
                      </p>
                      <p className="text-xs text-[hsl(var(--color-text-secondary))] mt-2">
                        {new Date(note.created_at).toLocaleString()}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleTogglePin(note.id, note.is_pinned || false)}
                      >
                        {note.is_pinned ? 'Unpin' : 'Pin'}
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleDeleteNote(note.id)}
                      >
                        Delete
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add Note Modal */}
      <Modal
        isOpen={isNoteModalOpen}
        onClose={() => {
          setIsNoteModalOpen(false)
          setNewNote('')
        }}
        title="Add Note"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-[hsl(var(--color-text-secondary))] mb-2">
              Note
            </label>
            <textarea
              value={newNote}
              onChange={(e) => setNewNote(e.target.value)}
              placeholder="Enter note..."
              className="w-full h-32 px-3 py-2 rounded-lg bg-[hsl(var(--color-input-bg))] border border-[hsl(var(--color-input-border))] text-[hsl(var(--color-text-primary))] placeholder:text-[hsl(var(--color-text-muted))] focus:outline-none focus:ring-2 focus:ring-[hsl(var(--color-input-focus))] resize-none"
            />
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <Button
              type="button"
              variant="ghost"
              onClick={() => setIsNoteModalOpen(false)}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button onClick={handleAddNote} disabled={submitting || !newNote.trim()}>
              {submitting ? 'Adding...' : 'Add Note'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Add Phone Modal - Placeholder */}
      <Modal
        isOpen={isPhoneModalOpen}
        onClose={() => {
          setIsPhoneModalOpen(false)
          setNewPhone('')
          setIsWhatsapp(false)
        }}
        title="Add Phone Number"
      >
        <div className="space-y-4">
          <Input
            label="Phone Number"
            value={newPhone}
            onChange={(e) => setNewPhone(e.target.value)}
            placeholder="+48 123 456 789"
          />

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="whatsapp"
              checked={isWhatsapp}
              onChange={(e) => setIsWhatsapp(e.target.checked)}
              className="w-4 h-4 rounded border-[hsl(var(--color-border))]"
            />
            <label htmlFor="whatsapp" className="text-sm text-[hsl(var(--color-text-primary))]">
              Available on WhatsApp
            </label>
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <Button
              type="button"
              variant="ghost"
              onClick={() => setIsPhoneModalOpen(false)}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button onClick={handleAddPhone} disabled={submitting || !newPhone.trim()}>
              {submitting ? 'Adding...' : 'Add Phone'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Edit Location Modal */}
      <Modal
        isOpen={isEditLocationModalOpen}
        onClose={() => setIsEditLocationModalOpen(false)}
        title="Edit Location Information"
      >
        <p className="text-[hsl(var(--color-text-secondary))]">
          Location editing coming soon...
        </p>
      </Modal>

      {/* Delete Confirmation Modal */}
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

      {/* Add Case Modal */}
      <Modal
        isOpen={isCaseModalOpen}
        onClose={() => {
          setIsCaseModalOpen(false)
          setSelectedStatus('')
          setSelectedAssignee('')
        }}
        title="Add New Case"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-[hsl(var(--color-text-secondary))] mb-2">
              Status
            </label>
            <Select
              options={statuses.map(s => ({ id: s.id, label: s.name }))}
              value={selectedStatus}
              onChange={setSelectedStatus}
              placeholder="Select status..."
              searchPlaceholder="Search statuses..."
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-[hsl(var(--color-text-secondary))] mb-2">
              Assign To
            </label>
            <Select
              options={users.map(u => ({ 
                id: u.id, 
                label: u.display_name || u.email 
              }))}
              value={selectedAssignee}
              onChange={setSelectedAssignee}
              placeholder="Select user..."
              searchPlaceholder="Search users..."
            />
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <Button
              type="button"
              variant="ghost"
              onClick={() => setIsCaseModalOpen(false)}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button onClick={handleAddCase} disabled={submitting}>
              {submitting ? 'Creating...' : 'Create Case'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
