'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import { useNotifications } from '@/lib/notifications/NotificationContext'
import { useChat } from '@/lib/chat/ChatContext'
import { getMyAccess } from '@/app/actions/access'
import { logout } from '@/app/actions/auth'

// Icons - same as Navbar but slightly smaller for mobile
const icons = {
  home: (
    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
    </svg>
  ),
  clients: (
    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
    </svg>
  ),
  board: (
    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2" />
    </svg>
  ),
  chat: (
    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
    </svg>
  ),
  wiki: (
    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
    </svg>
  ),
  settings: (
    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  ),
  admin: (
    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
    </svg>
  ),
  more: (
    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h.01M12 12h.01M19 12h.01M6 12a1 1 0 11-2 0 1 1 0 012 0zm7 0a1 1 0 11-2 0 1 1 0 012 0zm7 0a1 1 0 11-2 0 1 1 0 012 0z" />
    </svg>
  ),
  logout: (
    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
    </svg>
  ),
}

const navItems = [
  { href: '/home', label: 'Home', icon: 'home' as keyof typeof icons },
  { href: '/clients/mine', label: 'Clients', icon: 'clients' as keyof typeof icons },
  { href: '/wiki', label: 'Wiki', icon: 'wiki' as keyof typeof icons },
]

// Under "More" — less-used destinations plus sign out.
const moreItems = [
  { href: '/clients', label: 'All clients', icon: 'clients' as keyof typeof icons },
  { href: '/board', label: 'Board', icon: 'board' as keyof typeof icons },
  { href: '/chat', label: 'Chat', icon: 'chat' as keyof typeof icons },
  { href: '/admin', label: 'Admin', icon: 'admin' as keyof typeof icons },
]

export function MobileBottomNav() {
  const pathname = usePathname()
  const [canAdmin, setCanAdmin] = useState(false)
  const [moreOpen, setMoreOpen] = useState(false)
  useEffect(() => { getMyAccess().then(a => setCanAdmin(a.canAdmin)) }, [])
  useEffect(() => { setMoreOpen(false) }, [pathname])
  const items = moreItems.filter(i => i.href !== '/admin' || canAdmin)

  // Get notification count - wrapped in try/catch in case context is not available
  let notificationCount = 0
  try {
    const notifications = useNotifications()
    notificationCount = notifications.unreadCount
  } catch {
    // Context not available yet
  }

  // Get chat unread count
  let chatUnreadCount = 0
  try {
    const chat = useChat()
    chatUnreadCount = chat.unreadCount
  } catch {
    // Context not available yet
  }

  const moreActive = !pathname.startsWith('/clients/mine') &&
    items.some(i => pathname === i.href || pathname.startsWith(i.href))

  return (
    <>
      {/* More sheet — floats just above the nav bar */}
      {moreOpen && (
        <>
          <div className="fixed inset-0 z-40 md:hidden" onClick={() => setMoreOpen(false)} />
          <div className="fixed inset-x-4 bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-50 md:hidden rounded-2xl bg-[hsl(var(--color-surface))] border border-[hsl(var(--color-border))] shadow-2xl shadow-black/50 overflow-hidden">
            {items.map(item => (
              <Link
                key={item.href}
                href={item.href}
                className="flex items-center gap-3 px-4 py-3.5 text-sm font-medium text-[hsl(var(--color-text-primary))] active:bg-[hsl(var(--color-surface-hover))] border-b border-[hsl(var(--color-border))]"
              >
                <span className="relative text-[hsl(var(--color-text-secondary))] [&>svg]:w-5 [&>svg]:h-5">
                  {icons[item.icon]}
                  {item.href === '/chat' && chatUnreadCount > 0 && (
                    <span className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-red-500 text-white text-[8px] font-bold rounded-full flex items-center justify-center">
                      {chatUnreadCount > 9 ? '9+' : chatUnreadCount}
                    </span>
                  )}
                </span>
                {item.label}
              </Link>
            ))}
            <form action={logout}>
              <button
                type="submit"
                className="w-full flex items-center gap-3 px-4 py-3.5 text-sm font-medium text-red-400 active:bg-[hsl(var(--color-surface-hover))]"
              >
                <span className="[&>svg]:w-5 [&>svg]:h-5">{icons.logout}</span>
                Log out
              </button>
            </form>
          </div>
        </>
      )}

      <nav className="md:hidden shrink-0 bg-[hsl(var(--color-surface))] border-t border-[hsl(var(--color-border))] safe-area-bottom">
        <div className="flex items-center justify-around h-16">
          {navItems.map((item) => {
            const isActive = pathname === item.href ||
                           (item.href !== '/' && pathname.startsWith(item.href))
            const showBadge = item.href === '/home' && notificationCount > 0

            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'flex flex-col items-center justify-center px-3 py-2 min-w-[64px] relative',
                  'text-xs font-medium transition-colors',
                  isActive
                    ? 'text-[hsl(var(--color-primary))]'
                    : 'text-[hsl(var(--color-text-secondary))]'
                )}
              >
                <span className="relative">
                  {icons[item.icon]}
                  {showBadge && (
                    <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center">
                      {notificationCount > 9 ? '9+' : notificationCount}
                    </span>
                  )}
                </span>
                <span className="mt-1">{item.label}</span>
              </Link>
            )
          })}
          <button
            onClick={() => setMoreOpen(o => !o)}
            className={cn(
              'flex flex-col items-center justify-center px-3 py-2 min-w-[64px] relative',
              'text-xs font-medium transition-colors',
              moreOpen || moreActive
                ? 'text-[hsl(var(--color-primary))]'
                : 'text-[hsl(var(--color-text-secondary))]'
            )}
          >
            <span className="relative">
              {icons.more}
              {chatUnreadCount > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center">
                  {chatUnreadCount > 9 ? '9+' : chatUnreadCount}
                </span>
              )}
            </span>
            <span className="mt-1">More</span>
          </button>
        </div>
      </nav>
    </>
  )
}
