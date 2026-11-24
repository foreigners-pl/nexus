'use client'

import { MobileBackHeader } from '@/components/mobile/MobileBackHeader'
import { MyClientsContent } from '@/components/mobile/MyClientsContent'

export default function MyClientsPage() {
  return (
    <div>
      <MobileBackHeader title="My clients" />
      <MyClientsContent />
    </div>
  )
}
