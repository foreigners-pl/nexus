'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/Button'
import { Select } from '@/components/ui/Select'
import { Input } from '@/components/ui/Input'
import { Modal } from '@/components/ui'
import { addServiceToCase, removeServiceFromCase, getAllServices } from '@/app/actions/services'
import type { Service } from '@/types/database'

interface ServiceWithDetails {
  id: string
  custom_price?: number
  services?: Service
}

interface ServicesSectionProps {
  caseId: string
  caseServices: ServiceWithDetails[]
  onUpdate: () => void
}

export function ServicesSection({ caseId, caseServices, onUpdate }: ServicesSectionProps) {
  const [isAddModalOpen, setIsAddModalOpen] = useState(false)
  const [services, setServices] = useState<Service[]>([])
  const [selectedService, setSelectedService] = useState('')
  const [customPrice, setCustomPrice] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (isAddModalOpen && services.length === 0) {
      getAllServices().then(setServices)
    }
  }, [isAddModalOpen])

  // Get the selected service details to check if it needs custom pricing
  const selectedServiceDetails = services.find(s => s.id === selectedService)
  const needsCustomPrice = selectedServiceDetails && !selectedServiceDetails.gross_price

  const handleAdd = async () => {
    if (!selectedService) return
    if (needsCustomPrice && !customPrice) return

    setSubmitting(true)
    const priceValue = needsCustomPrice ? parseFloat(customPrice) : undefined
    const result = await addServiceToCase(caseId, selectedService, priceValue)

    if (!result?.error) {
      setSelectedService('')
      setCustomPrice('')
      setIsAddModalOpen(false)
      onUpdate()
    }
    setSubmitting(false)
  }

  const handleRemove = async (caseServiceId: string) => {
    await removeServiceFromCase(caseServiceId, caseId)
    onUpdate()
  }

  const handleModalClose = () => {
    setIsAddModalOpen(false)
    setSelectedService('')
    setCustomPrice('')
  }

  return (
    <>
      <div>
        {caseServices.length === 0 ? (
          <p className="text-[hsl(var(--color-text-secondary))] text-sm mb-2">No services added yet</p>
        ) : (
          <div className="space-y-2 mb-2">
            {caseServices.map((cs) => {
              const price = cs.custom_price ?? cs.services?.gross_price
              return (
                <div key={cs.id} className="flex items-center justify-between p-2 rounded border border-[hsl(var(--color-border))]">
                  <div>
                    <span className="text-[hsl(var(--color-text-primary))]">{cs.services?.name}</span>
                    <span className="text-xs text-[hsl(var(--color-text-secondary))] ml-2">
                      {price ? `${price.toFixed(2)} PLN` : 'No price'}
                      {cs.custom_price && <span className="ml-1 text-blue-500">(custom)</span>}
                    </span>
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => handleRemove(cs.id)}>Remove</Button>
                </div>
              )
            })}
          </div>
        )}
        <Button size="sm" variant="outline" onClick={() => setIsAddModalOpen(true)} className="w-full">+ Add Service</Button>
      </div>

      <Modal isOpen={isAddModalOpen} onClose={handleModalClose} title="Add Service">
        <div className="space-y-4">
          <Select
            options={services.map(s => ({ id: s.id, label: `${s.name} ${s.gross_price ? `- ${s.gross_price} PLN` : '(Individual pricing)'}` }))}
            value={selectedService}
            onChange={(value) => {
              setSelectedService(value)
              setCustomPrice('')
            }}
            placeholder="Select service..."
            searchPlaceholder="Search services..."
          />
          
          {needsCustomPrice && (
            <div>
              <label className="block text-sm font-medium text-[hsl(var(--color-text-secondary))] mb-1">
                Price for this service
              </label>
              <Input
                type="number"
                step="0.01"
                min="0"
                value={customPrice}
                onChange={(e) => setCustomPrice(e.target.value)}
                placeholder="Enter price in PLN..."
              />
              <p className="text-xs text-[hsl(var(--color-text-secondary))] mt-1">
                This service requires individual pricing
              </p>
            </div>
          )}
          
          <div className="flex justify-end gap-3">
            <Button variant="ghost" onClick={handleModalClose} disabled={submitting}>Cancel</Button>
            <Button 
              onClick={handleAdd} 
              disabled={submitting || !selectedService || (needsCustomPrice && !customPrice)}
            >
              {submitting ? 'Adding...' : 'Add Service'}
            </Button>
          </div>
        </div>
      </Modal>
    </>
  )
}