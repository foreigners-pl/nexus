'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { updateClient } from '@/app/actions/clients'
import type { Client } from '@/types/database'

interface BillingInfoProps {
  client: Client
  onUpdate: () => void
}

// Billing identity — prefills the "Bill to" block on invoices
export function BillingInfo({ client, onUpdate }: BillingInfoProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [pendingChanges, setPendingChanges] = useState({
    billingCompany: client.billing_company || '',
    nip: client.nip || '',
    billingAddress: client.billing_address || '',
  })

  const handleDone = async () => {
    setSubmitting(true)
    const formData = new FormData()
    formData.set('billingCompany', pendingChanges.billingCompany)
    formData.set('nip', pendingChanges.nip)
    formData.set('billingAddress', pendingChanges.billingAddress)
    await updateClient(client.id, formData)
    setIsEditing(false)
    setSubmitting(false)
    onUpdate()
  }

  const fields: { label: string; key: keyof typeof pendingChanges; value: string | undefined }[] = [
    { label: 'Company name', key: 'billingCompany', value: client.billing_company },
    { label: 'Company NIP', key: 'nip', value: client.nip },
    { label: 'Billing address', key: 'billingAddress', value: client.billing_address },
  ]

  return (
    <Card className="backdrop-blur-xl bg-[hsl(var(--color-surface))]/80 border-[hsl(var(--color-border))] shadow-[0_8px_32px_rgb(0_0_0/0.25)]">
      <CardHeader>
        <div className="flex justify-between items-center">
          <CardTitle>Billing</CardTitle>
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
        {fields.map(field => (
          <div key={field.key}>
            <label className="text-sm font-medium text-[hsl(var(--color-text-secondary))]">{field.label}</label>
            {isEditing ? (
              <Input
                className="mt-1"
                placeholder={field.label}
                value={pendingChanges[field.key]}
                onChange={(e) => setPendingChanges({ ...pendingChanges, [field.key]: e.target.value })}
              />
            ) : (
              <p className="text-[hsl(var(--color-text-primary))] mt-1">{field.value || '-'}</p>
            )}
          </div>
        ))}
      </CardContent>
    </Card>
  )
}
