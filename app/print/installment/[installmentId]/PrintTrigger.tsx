'use client'

import { useEffect } from 'react'

export function PrintTrigger() {
  useEffect(() => {
    const t = setTimeout(() => window.print(), 400)
    return () => clearTimeout(t)
  }, [])
  return null
}
