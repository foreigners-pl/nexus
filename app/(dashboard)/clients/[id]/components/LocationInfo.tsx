'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui'
import { Button } from '@/components/ui/Button'
import { Select } from '@/components/ui/Select'
import { getAllCountries, getAllCities, updateClientLocation } from '@/app/actions/locations'
import type { Client, Country, City } from '@/types/database'

interface LocationInfoProps {
  client: Client
  countryName: string | null
  cityName: string | null
  onUpdate: () => void
}

export function LocationInfo({ client, countryName, cityName, onUpdate }: LocationInfoProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [countries, setCountries] = useState<Country[]>([])
  const [cities, setCities] = useState<City[]>([])

  useEffect(() => {
    if (isEditing && countries.length === 0) {
      getAllCountries().then(setCountries)
      getAllCities().then(setCities)
    }
  }, [isEditing])

  const handleUpdateLocation = async (countryId: string | null, cityId: string | null) => {
    await updateClientLocation(client.id, countryId, cityId)
    onUpdate()
  }

  return (
    <Card className="backdrop-blur-xl bg-[hsl(var(--color-surface))]/80 border-[hsl(var(--color-border))] shadow-[0_8px_32px_rgb(0_0_0/0.25)]">
      <CardHeader>
        <div className="flex justify-between items-center">
          <CardTitle>Location Information</CardTitle>
          <Button size="sm" variant={isEditing ? 'outline' : 'ghost'} onClick={() => setIsEditing(!isEditing)}>
            {isEditing ? 'Done' : 'Edit'}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <label className="text-sm font-medium text-[hsl(var(--color-text-secondary))]">Country of Origin</label>
          {isEditing ? (
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
            <p className="text-[hsl(var(--color-text-primary))] mt-1">{countryName || '-'}</p>
          )}
        </div>

        <div>
          <label className="text-sm font-medium text-[hsl(var(--color-text-secondary))]">City in Poland</label>
          {isEditing ? (
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
            <p className="text-[hsl(var(--color-text-primary))] mt-1">{cityName || '-'}</p>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
