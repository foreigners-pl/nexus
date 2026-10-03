'use client'

import { useState, useEffect } from 'react'
import { Navbar } from '@/components/layout/Navbar'
import { MobileBottomNav } from '@/components/layout/MobileBottomNav'
import { NotificationBell } from '@/components/notifications/NotificationBell'
import { logout } from '@/app/actions/auth'
import { LogOut } from 'lucide-react'
import { NotificationProvider } from '@/lib/notifications/NotificationContext'
import { ChatProvider } from '@/lib/chat/ChatContext'
import { QueryProvider } from '@/lib/query'
import { PaneProvider } from '@/lib/panes'
import MiniChat from '@/app/(dashboard)/chat/components/MiniChat'
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
    <QueryProvider>
      <NotificationProvider>
        <ChatProvider>
          <div className="h-dvh bg-[hsl(var(--color-background))] flex flex-col">
            <Navbar />
            {/* Mobile-only top bar: branding + notification bell */}
            <header className="md:hidden sticky top-0 z-40 bg-[hsl(var(--color-surface))]/90 backdrop-blur border-b border-[hsl(var(--color-border))]">
              <div className="px-4 h-14 flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-[hsl(var(--color-accent))] flex items-center justify-center text-white font-bold">
                  N
                </div>
                <h1 className="text-lg font-bold text-[hsl(var(--color-text-primary))]">
                  Nexus CRM
                </h1>
                <div className="ml-auto flex items-center gap-1">
                  <NotificationBell />
                  <form action={logout}>
                    <button
                      type="submit"
                      className="w-10 h-10 rounded-xl flex items-center justify-center text-[hsl(var(--color-text-secondary))] active:bg-[hsl(var(--color-surface-active))]"
                      aria-label="Log out"
                    >
                      <LogOut className="w-5 h-5" />
                    </button>
                  </form>
                </div>
              </div>
            </header>
            <main className={cn(
              "px-4 py-4 flex-1 overflow-y-auto overflow-x-hidden transition-all duration-300",
              "pb-20", // Extra bottom padding on mobile for bottom nav
              "md:flex md:flex-col md:overflow-hidden md:p-0", // Desktop: pane columns scroll internally, padding lives on the columns
              "ml-0", // No left margin on mobile
              isNavCollapsed ? "md:ml-16" : "md:ml-56" // Left margin on desktop
            )}>
              <PaneProvider>{children}</PaneProvider>
            </main>
            <MobileBottomNav />
            {/* MiniChat hidden for now */}
            {/* <MiniChat /> */}
          </div>
        </ChatProvider>
      </NotificationProvider>
    </QueryProvider>
  )
}
