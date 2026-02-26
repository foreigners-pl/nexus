'use client'

import { useEffect } from 'react'
import { useRouter, usePathname } from 'next/navigation'

const CASES_BOARD_ID = '00000000-0000-0000-0000-000000000001'

export default function BoardPage() {
  const router = useRouter()
  const pathname = usePathname()

  useEffect(() => {
    // Only redirect if we're exactly on /board (not already on a board page)
    // This prevents any edge case where this redirect might fire incorrectly
    if (pathname === '/board') {
      router.replace(`/board/${CASES_BOARD_ID}`)
    }
  }, [pathname, router])

  return (
    <div className="flex items-center justify-center h-full p-4">
      <div className="text-center">
        <h2 className="text-2xl font-bold text-[hsl(var(--color-text-primary))] mb-2">
          Welcome to Boards
        </h2>
        <p className="text-[hsl(var(--color-text-secondary))]">
          Select a board from the sidebar to get started
        </p>
      </div>
    </div>
  )
}
