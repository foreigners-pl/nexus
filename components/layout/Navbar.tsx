'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import { logout } from '@/app/actions/auth'
import { Button } from '@/components/ui/Button'

const navItems = [
  { href: '/home', label: 'Home' },
  { href: '/clients', label: 'Clients' },
  { href: '/cases', label: 'Cases' },
  { href: '/settings', label: 'Settings' },
]

export function Navbar() {
  const pathname = usePathname()

  return (
    <nav className="fixed top-0 left-0 h-screen w-64 bg-[hsl(var(--color-sidebar))] border-r border-[hsl(var(--color-border))] flex flex-col">
      {/* Logo/Brand */}
      <div className="p-6 border-b border-[hsl(var(--color-border))]">
        <h1 className="text-2xl font-bold text-[hsl(var(--color-text-primary))]">
          Nexus CRM
        </h1>
      </div>

      {/* Navigation Links */}
      <div className="flex-1 py-6">
        <ul className="space-y-1 px-3">
          {navItems.map((item) => {
            const isActive = pathname === item.href || 
                           (item.href !== '/' && pathname.startsWith(item.href))
            
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={cn(
                    'flex items-center px-4 py-3 rounded-[var(--radius-md)]',
                    'text-sm font-medium transition-colors duration-[var(--transition-base)]',
                    isActive
                      ? 'bg-[hsl(var(--color-sidebar-active))] text-[hsl(var(--color-text-primary))]'
                      : 'text-[hsl(var(--color-text-secondary))] hover:bg-[hsl(var(--color-sidebar-active))] hover:text-[hsl(var(--color-text-primary))]'
                  )}
                >
                  {item.label}
                </Link>
              </li>
            )
          })}
        </ul>
      </div>

      {/* User Section */}
      <div className="p-4 border-t border-[hsl(var(--color-border))] space-y-3">
        <div className="flex items-center gap-3 px-2">
          <div className="h-8 w-8 rounded-full bg-[hsl(var(--color-primary))] flex items-center justify-center text-white font-bold">
            A
          </div>
          <div className="flex-1">
            <p className="text-sm font-medium text-[hsl(var(--color-text-primary))]">
              Admin
            </p>
            <p className="text-xs text-[hsl(var(--color-text-secondary))]">
              Logged in
            </p>
          </div>
        </div>
        <form action={logout} className="px-2">
          <Button 
            type="submit" 
            variant="ghost" 
            size="sm" 
            className="w-full justify-start"
          >
            Logout
          </Button>
        </form>
      </div>
    </nav>
  )
}
