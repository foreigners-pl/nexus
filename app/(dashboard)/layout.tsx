'use client'

import { useState, useEffect } from 'react'
import { Navbar } from '@/components/layout/Navbar'
import { cn } from '@/lib/utils'

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const [isNavCollapsed, setIsNavCollapsed] = useState(false)

  useEffect(() => {
    // Load initial state from localStorage
    const saved = localStorage.getItem('navbar-collapsed')
    if (saved !== null) {
      setIsNavCollapsed(saved === 'true')
    }

    // Listen for navbar toggle events
    const handleToggle = (e: CustomEvent<{ collapsed: boolean }>) => {
      setIsNavCollapsed(e.detail.collapsed)
    }

    window.addEventListener('navbar-toggle', handleToggle as EventListener)
    return () => window.removeEventListener('navbar-toggle', handleToggle as EventListener)
  }, [])

  return (
    <div className="h-screen bg-[hsl(var(--color-background))] flex flex-col">
      <Navbar />
      <main className={cn(
        "p-8 flex-1 overflow-y-auto transition-all duration-300",
        isNavCollapsed ? "ml-16" : "ml-64"
      )}>
        {children}
      </main>
    </div>
  )
}
