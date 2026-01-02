'use client'

import { useState, useEffect } from 'react'
import { Modal } from '@/components/ui'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { addClient } from '@/app/actions/clients'
import { getAllCountries, getAllCities } from '@/app/actions/locations'
import type { Country, City } from '@/types/database'

interface AddClientModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
}

export function AddClientModal({ isOpen, onClose, onSuccess }: AddClientModalProps) {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [countries, setCountries] = useState<Country[]>([])
  const [cities, setCities] = useState<City[]>([])
  const [phoneNumbers, setPhoneNumbers] = useState<Array<{ number: string; isWhatsapp: boolean }>>([{ number: '', isWhatsapp: false }])
  const [selectedCountry, setSelectedCountry] = useState<string>('')
  const [selectedCity, setSelectedCity] = useState<string>('')

  useEffect(() => {
    if (isOpen && countries.length === 0) {
      getAllCountries().then(setCountries)
      getAllCities().then(setCities)
    }
  }, [isOpen])

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setIsSubmitting(true)
    setError(null)

    const formData = new FormData(e.currentTarget)
    const firstName = formData.get('firstName') as string
    const lastName = formData.get('lastName') as string
    const email = formData.get('email') as string
    const validPhones = phoneNumbers.filter(p => p.number.trim())

    if (!firstName?.trim() && !lastName?.trim() && !email?.trim() && validPhones.length === 0) {
      setError('Please provide at least one of: First Name, Last Name, Email, or Phone Number')
      setIsSubmitting(false)
      return
    }
    
    if (selectedCountry) formData.set('countryId', selectedCountry)
    if (selectedCity) formData.set('cityId', selectedCity)
    if (validPhones.length > 0) {
      formData.set('phoneNumbers', JSON.stringify(validPhones))
    }
    
    const result = await addClient(formData)

    if (result?.error) {
      setError(result.error)
      setIsSubmitting(false)
    } else {
      resetForm()
      onSuccess()
      onClose()
    }
  }

  const resetForm = () => {
    setIsSubmitting(false)
    setError(null)
    setPhoneNumbers([{ number: '', isWhatsapp: false }])
    setSelectedCountry('')
    setSelectedCity('')
  }

  const handleClose = () => {
    resetForm()
    onClose()
  }

  const addPhoneField = () => {
    setPhoneNumbers([...phoneNumbers, { number: '', isWhatsapp: false }])
  }

  const removePhoneField = (index: number) => {
    setPhoneNumbers(phoneNumbers.filter((_, i) => i !== index))
  }

  const updatePhoneNumber = (index: number, number: string) => {
    const updated = [...phoneNumbers]
    updated[index].number = number
    setPhoneNumbers(updated)
  }

  const updatePhoneWhatsApp = (index: number, isWhatsapp: boolean) => {
    const updated = [...phoneNumbers]
    updated[index].isWhatsapp = isWhatsapp
    setPhoneNumbers(updated)
  }

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Add New Client">
      <form onSubmit={handleSubmit} className="space-y-5">
        {error && (
          <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl backdrop-blur-sm shadow-[0_0_20px_rgb(239_68_68/0.1)]">
            <div className="flex items-center gap-3">
              <div className="p-1.5 rounded-lg bg-red-500/20">
                <svg className="w-4 h-4 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <p className="text-sm text-red-400">{error}</p>
            </div>
          </div>
        )}

        {/* Personal Information Section */}
        <div className="space-y-4">
          <div className="flex items-center gap-2 text-sm text-[hsl(var(--color-text-secondary))] uppercase tracking-wider">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
            Personal Information
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Input label="First Name" name="firstName" placeholder="John" />
            <Input label="Last Name" name="lastName" placeholder="Doe" />
          </div>
          <Input label="Email" name="email" type="email" placeholder="john.doe@example.com" />
        </div>

        {/* Phone Numbers Section */}
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-sm text-[hsl(var(--color-text-secondary))] uppercase tracking-wider">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
            </svg>
            Phone Numbers
          </div>
          <div className="space-y-3">
            {phoneNumbers.map((phone, index) => (
              <div key={index} className="flex gap-3 items-start p-3 rounded-xl bg-[hsl(var(--color-surface-hover)/0.5)] border border-[hsl(var(--color-border))]">
                <Input
                  value={phone.number}
                  onChange={(e) => updatePhoneNumber(index, e.target.value)}
                  placeholder="+48 123 456 789"
                  className="flex-1"
                />
                <div className="flex items-center gap-2 pt-2">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={phone.isWhatsapp}
                      onChange={(e) => updatePhoneWhatsApp(index, e.target.checked)}
                      className="w-4 h-4 rounded border-[hsl(var(--color-border))] bg-[hsl(var(--color-surface))] checked:bg-green-500 checked:border-green-500 focus:ring-green-500/30"
                    />
                    <span className="text-sm text-green-400">WhatsApp</span>
                  </label>
                </div>
                {phoneNumbers.length > 1 && (
                  <Button 
                    type="button" 
                    variant="ghost" 
                    size="sm" 
                    onClick={() => removePhoneField(index)} 
                    className="mt-1 hover:bg-red-500/10 hover:text-red-400"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </Button>
                )}
              </div>
            ))}
            <Button 
              type="button" 
              variant="outline" 
              size="sm" 
              onClick={addPhoneField}
              className="w-full border-dashed hover:border-[hsl(var(--color-primary))] hover:text-[hsl(var(--color-primary))]"
            >
              <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Add Phone Number
            </Button>
          </div>
        </div>

        {/* Location Section */}
        <div className="space-y-4">
          <div className="flex items-center gap-2 text-sm text-[hsl(var(--color-text-secondary))] uppercase tracking-wider">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            Location
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-[hsl(var(--color-text-secondary))] mb-2">
                Country of Origin
              </label>
              <Select
                options={countries.map(c => ({ id: c.id, label: c.country }))}
                value={selectedCountry}
                onChange={setSelectedCountry}
                placeholder="Select country..."
                searchPlaceholder="Search countries..."
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-[hsl(var(--color-text-secondary))] mb-2">
                City in Poland
              </label>
              <Select
                options={cities.map(c => ({ id: c.id, label: c.city }))}
                value={selectedCity}
                onChange={setSelectedCity}
                placeholder="Select city..."
                searchPlaceholder="Search cities..."
              />
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-3 pt-4 border-t border-[hsl(var(--color-border))]">
          <Button type="button" variant="ghost" onClick={handleClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button 
            type="submit" 
            disabled={isSubmitting}
            className="shadow-[0_4px_20px_hsl(var(--color-primary)/0.3)] hover:shadow-[0_6px_30px_hsl(var(--color-primary)/0.4)]"
          >
            {isSubmitting ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent mr-2"></div>
                Adding...
              </>
            ) : (
              <>
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Add Client
              </>
            )}
          </Button>
        </div>
      </form>
    </Modal>
  )
}
