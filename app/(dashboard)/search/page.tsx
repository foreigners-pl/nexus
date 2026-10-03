'use client'

import { Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { MobileBackHeader } from '@/components/mobile/MobileBackHeader'
import { SearchContent } from '@/components/mobile/SearchContent'

function SearchWithParams() {
  const searchParams = useSearchParams()
  return <SearchContent initialQuery={searchParams.get('q') || ''} />
}

export default function SearchPage() {
  return (
    <div>
      <MobileBackHeader title="Search clients" />
      <Suspense fallback={null}>
        <SearchWithParams />
      </Suspense>
    </div>
  )
}
