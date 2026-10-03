'use client'

import { Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { MobileBackHeader } from '@/app/mobile/components/MobileBackHeader'
import { SearchContent } from '@/app/mobile/components/SearchContent'

function SearchWithParams() {
  const searchParams = useSearchParams()
  return <SearchContent initialQuery={searchParams.get('q') || ''} />
}

export default function MobileSearchPage() {
  return (
    <div>
      <MobileBackHeader title="Search clients" />
      <Suspense fallback={null}>
        <SearchWithParams />
      </Suspense>
    </div>
  )
}
