'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import { logout } from '@/app/actions/auth'
import { Button } from '@/components/ui/Button'
import { createClient } from '@/lib/supabase/client'
import type { User } from '@/types/database'

// Icons as simple SVG components
const icons = {
  home: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
    </svg>
  ),
  clients: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
    </svg>
  ),
  cases: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
    </svg>
  ),
  board: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2" />
    </svg>
  ),
  wiki: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
    </svg>
  ),
  settings: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  ),
  collapse: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
    </svg>
  ),
  expand: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 5l7 7-7 7M5 5l7 7-7 7" />
    </svg>
  ),
  logout: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
    </svg>
  ),
}

const navItems = [
  { href: '/home', label: 'Home', icon: 'home' as keyof typeof icons },
  { href: '/clients', label: 'Clients', icon: 'clients' as keyof typeof icons },
  { href: '/cases', label: 'Cases', icon: 'cases' as keyof typeof icons },
  { href: '/board', label: 'Board', icon: 'board' as keyof typeof icons },
  { href: '/wiki', label: 'Wiki', icon: 'wiki' as keyof typeof icons },
  { href: '/settings', label: 'Settings', icon: 'settings' as keyof typeof icons },
]

export function Navbar() {
  const pathname = usePathname()
  const [currentUser, setCurrentUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [isCollapsed, setIsCollapsed] = useState(false)

  useEffect(() => {
    // Load collapsed state from localStorage
    const saved = localStorage.getItem('navbar-collapsed')
    if (saved !== null) {
      setIsCollapsed(saved === 'true')
    }
  }, [])

  useEffect(() => {
    async function loadUser() {
      const supabase = createClient()
      const { data: { user: authUser } } = await supabase.auth.getUser()
      
      if (authUser) {
        // Fetch user profile from public.users table
        const { data: profile } = await supabase
          .from('users')
          .select('*')
          .eq('id', authUser.id)
          .single()
        
        if (profile) {
          setCurrentUser(profile)
        }
      }
      setLoading(false)
    }
    
    loadUser()
  }, [])

  const toggleCollapse = () => {
    const newState = !isCollapsed
    setIsCollapsed(newState)
    localStorage.setItem('navbar-collapsed', String(newState))
    // Dispatch event so layout can adjust
    window.dispatchEvent(new CustomEvent('navbar-toggle', { detail: { collapsed: newState } }))
  }

  return (
    <nav className={cn(
      "fixed top-0 left-0 h-screen bg-[hsl(var(--color-surface))] border-r border-[hsl(var(--color-border))] flex flex-col transition-all duration-300 overflow-hidden",
      isCollapsed ? "w-16" : "w-56"
    )}>
      {/* Logo/Brand */}
      <div className={cn(
        "border-b border-[hsl(var(--color-border))] flex items-center",
        isCollapsed ? "p-4 justify-center" : "p-6"
      )}>
        {isCollapsed ? (
          <span className="text-2xl font-bold text-[hsl(var(--color-text-primary))]">N</span>
        ) : (
          <h1 className="text-xl font-bold text-[hsl(var(--color-text-primary))] whitespace-nowrap">
            Nexus CRM
          </h1>
        )}
      </div>

      {/* Navigation Links */}
      <div className="flex-1 py-6">
        <ul className={cn("space-y-1", isCollapsed ? "px-2" : "px-3")}>
          {navItems.map((item) => {
            const isActive = pathname === item.href || 
                           (item.href !== '/' && pathname.startsWith(item.href))
            
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  title={isCollapsed ? item.label : undefined}
                  className={cn(
                    'flex items-center rounded-lg cursor-pointer',
                    'text-sm font-medium transition-all duration-200',
                    isCollapsed ? 'px-3 py-3 justify-center' : 'px-4 py-3 gap-3',
                    isActive
                      ? 'bg-[hsl(var(--color-surface-hover))] text-[hsl(var(--color-text-primary))]'
                      : 'text-[hsl(var(--color-text-secondary))] hover:bg-[hsl(var(--color-surface-hover))] hover:text-[hsl(var(--color-text-primary))]'
                  )}
                >
                  <span className="flex-shrink-0">{icons[item.icon]}</span>
                  {!isCollapsed && <span className="whitespace-nowrap">{item.label}</span>}
                </Link>
              </li>
            )
          })}
        </ul>
      </div>

      {/* Collapse Toggle Button */}
      <div className={cn("px-3 pb-2", isCollapsed && "px-2")}>
        <button
          onClick={toggleCollapse}
          title={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          className={cn(
            "flex items-center rounded-lg w-full cursor-pointer",
            "text-sm font-medium transition-all duration-200",
            "text-[hsl(var(--color-text-secondary))] hover:bg-[hsl(var(--color-surface-hover))] hover:text-[hsl(var(--color-text-primary))]",
            isCollapsed ? "px-3 py-3 justify-center" : "px-4 py-3 gap-3"
          )}
        >
          <span className="flex-shrink-0">{isCollapsed ? icons.expand : icons.collapse}</span>
          {!isCollapsed && <span className="whitespace-nowrap">Collapse</span>}
        </button>
      </div>

      {/* User Section */}
      <div className={cn(
        "border-t border-[hsl(var(--color-border))] space-y-3",
        isCollapsed ? "p-2" : "p-4"
      )}>
        <div className={cn(
          "flex items-center",
          isCollapsed ? "justify-center" : "gap-3 px-2"
        )}>
          <div className="h-8 w-8 rounded-full bg-[hsl(var(--color-primary))] flex items-center justify-center text-white font-bold flex-shrink-0">
            {loading ? '...' : (currentUser?.display_name?.[0] || currentUser?.email?.[0] || '?').toUpperCase()}
          </div>
          {!isCollapsed && (
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-[hsl(var(--color-text-primary))] truncate whitespace-nowrap">
                {loading ? 'Loading...' : currentUser?.display_name || currentUser?.email || 'User'}
              </p>
              <p className="text-xs text-[hsl(var(--color-text-secondary))] whitespace-nowrap">
                Logged in
              </p>
            </div>
          )}
        </div>
        <form action={logout} className={isCollapsed ? "" : "px-2"}>
          <Button 
            type="submit" 
            variant="ghost" 
            size="sm" 
            title={isCollapsed ? "Logout" : undefined}
            className={cn(
              "w-full",
              isCollapsed ? "justify-center px-0" : "justify-start gap-3"
            )}
          >
            <span className="flex-shrink-0">{icons.logout}</span>
            {!isCollapsed && <span className="whitespace-nowrap">Logout</span>}
          </Button>
        </form>
      </div>
    </nav>
  )
}
