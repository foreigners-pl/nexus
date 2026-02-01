'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle, Modal } from '@/components/ui'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { updateClient } from '@/app/actions/clients'
import { addPhoneNumber, deletePhoneNumber, updatePhoneNumber, updateWhatsAppStatus } from '@/app/actions/phones'
import type { Client, ContactNumber } from '@/types/database'

interface ContactInfoProps {
  client: Client
  phoneNumbers: ContactNumber[]
  onUpdate: () => void
}

export function ContactInfo({ client, phoneNumbers, onUpdate }: ContactInfoProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [isPhoneModalOpen, setIsPhoneModalOpen] = useState(false)
  const [newPhone, setNewPhone] = useState('')
  const [newCountryCode, setNewCountryCode] = useState('+48')
  const [isWhatsapp, setIsWhatsapp] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  
  // Track pending changes
  const [pendingChanges, setPendingChanges] = useState({
    firstName: client.first_name || '',
    lastName: client.last_name || '',
    email: client.contact_email || '',
    phones: new Map<string, { number: string; countryCode: string; whatsapp: boolean }>()
  })

  const handleDone = async () => {
    setSubmitting(true)
    
    // Update client info if changed
    if (pendingChanges.firstName !== client.first_name || 
        pendingChanges.lastName !== client.last_name || 
        pendingChanges.email !== client.contact_email) {
      const formData = new FormData()
      formData.set('firstName', pendingChanges.firstName)
      formData.set('lastName', pendingChanges.lastName)
      formData.set('email', pendingChanges.email)
      await updateClient(client.id, formData)
    }
    
    // Update phone numbers if changed
    for (const [phoneId, data] of pendingChanges.phones) {
      const originalPhone = phoneNumbers.find(p => p.id === phoneId)
      if (originalPhone) {
        if (data.number !== originalPhone.number || data.countryCode !== (originalPhone.country_code || '')) {
          await updatePhoneNumber(phoneId, client.id, data.number, data.countryCode || undefined)
        }
        if (data.whatsapp !== originalPhone.is_on_whatsapp) {
          await updateWhatsAppStatus(phoneId, client.id, data.whatsapp)
        }
      }
    }
    
    setIsEditing(false)
    setPendingChanges({
      firstName: client.first_name || '',
      lastName: client.last_name || '',
      email: client.contact_email || '',
      phones: new Map()
    })
    setSubmitting(false)
    onUpdate()
  }

  const handleAddPhone = async () => {
    if (!newPhone.trim()) return
    
    setSubmitting(true)
    const result = await addPhoneNumber(client.id, newPhone, isWhatsapp, newCountryCode || undefined)
    
    if (!result?.error) {
      setNewPhone('')
      setNewCountryCode('+48')
      setIsWhatsapp(false)
      setIsPhoneModalOpen(false)
      onUpdate()
    }
    setSubmitting(false)
  }

  const handleDeletePhone = async (phoneId: string) => {
    await deletePhoneNumber(phoneId, client.id)
    onUpdate()
  }

  // Format phone display with country code
  const formatPhoneDisplay = (phone: ContactNumber) => {
    if (phone.country_code) {
      return `${phone.country_code} ${phone.number}`
    }
    return phone.number
  }

  return (
    <>
      <Card className="backdrop-blur-xl bg-[hsl(var(--color-surface))]/80 border-[hsl(var(--color-border))] shadow-[0_8px_32px_rgb(0_0_0/0.25)]">
        <CardHeader>
          <div className="flex justify-between items-center">
            <CardTitle>Contact Information</CardTitle>
            <Button 
              size="sm" 
              variant={isEditing ? 'outline' : 'ghost'} 
              onClick={isEditing ? handleDone : () => setIsEditing(true)}
              disabled={submitting}
            >
              {isEditing ? (submitting ? 'Saving...' : 'Done') : 'Edit'}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="text-sm font-medium text-[hsl(var(--color-text-secondary))]">Full Name</label>
            {isEditing ? (
              <div className="flex gap-2 mt-1">
                <Input
                  placeholder="First Name"
                  value={pendingChanges.firstName}
                  onChange={(e) => setPendingChanges({...pendingChanges, firstName: e.target.value})}
                />
                <Input
                  placeholder="Last Name"
                  value={pendingChanges.lastName}
                  onChange={(e) => setPendingChanges({...pendingChanges, lastName: e.target.value})}
                />
              </div>
            ) : (
              <p className="text-[hsl(var(--color-text-primary))] mt-1">{client.first_name} {client.last_name}</p>
            )}
          </div>

          <div>
            <label className="text-sm font-medium text-[hsl(var(--color-text-secondary))]">Email Address</label>
            {isEditing ? (
              <Input
                type="email"
                placeholder="Email"
                value={pendingChanges.email}
                className="mt-1"
                onChange={(e) => setPendingChanges({...pendingChanges, email: e.target.value})}
              />
            ) : (
              <p className="text-[hsl(var(--color-text-primary))] mt-1">{client.contact_email || '-'}</p>
            )}
          </div>

          <div>
            <label className="text-sm font-medium text-[hsl(var(--color-text-secondary))]">Phone Numbers</label>
            <div className="space-y-2 mt-1">
              {phoneNumbers.length === 0 ? (
                <p className="text-[hsl(var(--color-text-primary))]">-</p>
              ) : (
                phoneNumbers.map((phone) => {
                  const pendingPhone = pendingChanges.phones.get(phone.id) || { 
                    number: phone.number, 
                    countryCode: phone.country_code || '',
                    whatsapp: phone.is_on_whatsapp 
                  }
                  
                  return (
                    <div key={phone.id} className="flex items-center justify-between gap-2">
                      {isEditing ? (
                        <>
                          <div className="flex-1 flex items-center gap-2">
                            <Input
                              value={pendingPhone.countryCode}
                              onChange={(e) => {
                                const newPhones = new Map(pendingChanges.phones)
                                newPhones.set(phone.id, { ...pendingPhone, countryCode: e.target.value })
                                setPendingChanges({...pendingChanges, phones: newPhones})
                              }}
                              placeholder="+48"
                              className="w-20"
                            />
                            <Input
                              value={pendingPhone.number}
                              onChange={(e) => {
                                const newPhones = new Map(pendingChanges.phones)
                                newPhones.set(phone.id, { ...pendingPhone, number: e.target.value })
                                setPendingChanges({...pendingChanges, phones: newPhones})
                              }}
                              className="flex-1"
                              placeholder="Phone number"
                            />
                            <label className="flex items-center gap-2 whitespace-nowrap">
                              <input
                                type="checkbox"
                                checked={pendingPhone.whatsapp}
                                onChange={(e) => {
                                  const newPhones = new Map(pendingChanges.phones)
                                  newPhones.set(phone.id, { ...pendingPhone, whatsapp: e.target.checked })
                                  setPendingChanges({...pendingChanges, phones: newPhones})
                                }}
                                className="w-4 h-4 rounded border-[hsl(var(--color-border))]"
                              />
                              <span className="text-sm text-[hsl(var(--color-text-secondary))]">WhatsApp</span>
                            </label>
                          </div>
                          <Button size="sm" variant="ghost" onClick={() => handleDeletePhone(phone.id)}>Delete</Button>
                        </>
                      ) : (
                        <div className="flex items-center gap-2">
                          <p className="text-[hsl(var(--color-text-primary))]">{formatPhoneDisplay(phone)}</p>
                          {phone.is_on_whatsapp && (
                            <span className="text-xs bg-green-500/20 text-green-500 px-2 py-0.5 rounded">WhatsApp</span>
                          )}
                        </div>
                      )}
                    </div>
                  )
                })
              )}
              {isEditing && (
                <Button size="sm" variant="outline" onClick={() => setIsPhoneModalOpen(true)} className="w-full mt-2">
                  + Add Phone Number
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      <Modal isOpen={isPhoneModalOpen} onClose={() => setIsPhoneModalOpen(false)} title="Add Phone Number">
        <div className="space-y-4">
          <div className="flex gap-2">
            <Input 
              label="Country Code" 
              value={newCountryCode} 
              onChange={(e) => setNewCountryCode(e.target.value)} 
              placeholder="+48" 
              className="w-24"
            />
            <Input 
              label="Phone Number" 
              value={newPhone} 
              onChange={(e) => setNewPhone(e.target.value)} 
              placeholder="123 456 789" 
              className="flex-1"
            />
          </div>
          <div className="flex items-center gap-2">
            <input type="checkbox" checked={isWhatsapp} onChange={(e) => setIsWhatsapp(e.target.checked)} className="w-4 h-4 rounded border-[hsl(var(--color-border))]" />
            <label className="text-sm text-[hsl(var(--color-text-primary))]">Available on WhatsApp</label>
          </div>
          <div className="flex justify-end gap-3 pt-4">
            <Button variant="ghost" onClick={() => setIsPhoneModalOpen(false)} disabled={submitting}>Cancel</Button>
            <Button onClick={handleAddPhone} disabled={submitting || !newPhone.trim()}>{submitting ? 'Adding...' : 'Add Phone'}</Button>
          </div>
        </div>
      </Modal>
    </>
  )
}
