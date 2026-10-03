'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { updateClient } from '@/app/actions/clients'
import type { Client } from '@/types/database'

interface IdentificationInfoProps {
  client: Client
  onUpdate: () => void
}

export function IdentificationInfo({ client, onUpdate }: IdentificationInfoProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [pendingChanges, setPendingChanges] = useState({
    passportNumber: client.passport_number || '',
    pesel: client.pesel || '',
    trcCaseNumber: client.trc_case_number || '',
  })

  const handleDone = async () => {
    setSubmitting(true)
    const formData = new FormData()
    formData.set('passportNumber', pendingChanges.passportNumber)
    formData.set('pesel', pendingChanges.pesel)
    formData.set('trcCaseNumber', pendingChanges.trcCaseNumber)
    await updateClient(client.id, formData)
    setIsEditing(false)
    setSubmitting(false)
    onUpdate()
  }

  const fields: { label: string; key: keyof typeof pendingChanges; value: string | undefined }[] = [
    { label: 'Passport number', key: 'passportNumber', value: client.passport_number },
    { label: 'PESEL', key: 'pesel', value: client.pesel },
    { label: 'TRC case number', key: 'trcCaseNumber', value: client.trc_case_number },
  ]

  return (
    <Card className="backdrop-blur-xl bg-[hsl(var(--color-surface))]/80 border-[hsl(var(--color-border))] shadow-[0_8px_32px_rgb(0_0_0/0.25)]">
      <CardHeader>
        <div className="flex justify-between items-center">
          <CardTitle>Identification</CardTitle>
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
