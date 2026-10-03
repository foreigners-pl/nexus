'use client'

import React, { createContext, useContext, useEffect, useRef, useState } from 'react'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import CasePage from '@/app/(dashboard)/cases/[id]/page'
import CaseProgressPage from '@/app/(dashboard)/cases/[id]/progress/page'
import CaseEntryPage from '@/app/(dashboard)/cases/[id]/progress/[entryId]/page'
import CaseBillingPage from '@/app/(dashboard)/cases/[id]/billing/page'
import InstallmentPage from '@/app/(dashboard)/cases/[id]/billing/[installmentId]/page'
import CaseFilesPage from '@/app/(dashboard)/cases/[id]/files/page'
import ClientPage from '@/app/(dashboard)/clients/[id]/page'
import ClientInfoPage from '@/app/(dashboard)/clients/[id]/info/page'
import { TasksContent } from '@/components/mobile/TasksContent'
import { DeadlinesContent } from '@/components/mobile/DeadlinesContent'
import { SearchContent } from '@/components/mobile/SearchContent'
import { MobileBackHeader } from '@/components/mobile/MobileBackHeader'

/** Routes that render at pane (mobile-like) width on desktop. */
function isPaneRoute(href: string): boolean {
  const path = href.split('?')[0]
  return /^\/cases\/[^/]+(\/progress(\/[^/]+)?|\/billing(\/[^/]+)?|\/files)?$/.test(path)
    || /^\/clients\/[^/]+(\/info)?$/.test(path)
    || /^\/home$/.test(path)
    || /^\/(tasks|deadlines|search)$/.test(path)
}

/** Routes that can render as a side pane instead of a full navigation. */
function renderPaneRoute(href: string): React.ReactNode | null {
  const [path, qs] = href.split('?')
  const searchParams = Promise.resolve(Object.fromEntries(new URLSearchParams(qs || '').entries()))
  let m: RegExpMatchArray | null

  if ((m = path.match(/^\/cases\/([^/]+)\/billing\/([^/]+)$/)))
    return <InstallmentPage params={Promise.resolve({ id: m[1], installmentId: m[2] })} />
  if ((m = path.match(/^\/cases\/([^/]+)\/progress\/([^/]+)$/)))
    return <CaseEntryPage params={Promise.resolve({ id: m[1], entryId: m[2] })} />
  if ((m = path.match(/^\/cases\/([^/]+)\/progress$/)))
    return <CaseProgressPage params={Promise.resolve({ id: m[1] })} searchParams={searchParams} />
  if ((m = path.match(/^\/cases\/([^/]+)\/billing$/)))
    return <CaseBillingPage params={Promise.resolve({ id: m[1] })} />
  if ((m = path.match(/^\/cases\/([^/]+)\/files$/)))
    return <CaseFilesPage params={Promise.resolve({ id: m[1] })} />
  if ((m = path.match(/^\/cases\/([^/]+)$/)))
    return <CasePage params={Promise.resolve({ id: m[1] })} />
  if ((m = path.match(/^\/clients\/([^/]+)\/info$/)))
    return <ClientInfoPage params={Promise.resolve({ id: m[1] })} />
  if ((m = path.match(/^\/clients\/([^/]+)$/)))
    return <ClientPage params={Promise.resolve({ id: m[1] })} />
  if (path === '/tasks') return <TasksContent />
  if (path === '/deadlines') return <DeadlinesContent />
  if (path === '/search') {
    const q = new URLSearchParams(qs || '').get('q') || ''
    return (
      <div>
        <MobileBackHeader title="Search clients" />
        <SearchContent initialQuery={q} />
      </div>
    )
  }
  return null
}

interface PaneApi {
  openPane: (node: React.ReactNode, key: string, atLevel: number) => void
  closeFrom: (index: number) => void
  paneCount: number
}

const PaneContext = createContext<PaneApi | null>(null)

/**
 * Which column level the current component renders at.
 * 0 = the base page, 1 = first pane, 2 = second pane, ...
 */
const PaneLevelContext = createContext(0)

interface Pane { key: string; node: React.ReactNode; closing?: boolean }

export function PaneProvider({ children }: { children: React.ReactNode }) {
  const [panes, setPanes] = useState<Pane[]>([])
  const lastPaneRef = useRef<HTMLDivElement>(null)
  const pathname = usePathname()
  const prevPathname = useRef(pathname)
  const baseIsPane = isPaneRoute(pathname)

  // A real navigation on the base page dismisses all open panes
  useEffect(() => {
    if (pathname !== prevPathname.current) {
      prevPathname.current = pathname
      setPanes([])
    }
  }, [pathname])

  const openPane = (node: React.ReactNode, key: string, atLevel: number) => {
    setPanes(prev => {
      // Same pane already open at this level — just truncate anything deeper
      if (prev[atLevel]?.key === key)
        return prev.slice(0, atLevel + 1).map((p, i) => i === atLevel ? { key, node, closing: false } : p)
      return [...prev.slice(0, atLevel).filter(p => !p.closing), { key, node }]
    })
  }

  const closeFrom = (index: number) => {
    let closingKeys: string[] = []
    setPanes(prev => {
      closingKeys = prev.slice(index).map(p => p.key)
      return prev.map((p, i) => i >= index ? { ...p, closing: true } : p)
    })
    // Let the slide-out animation play before unmounting
    setTimeout(() => {
      setPanes(prev => prev.filter(p => !closingKeys.includes(p.key)))
    }, 320)
  }

  // Scroll the newest column into view
  useEffect(() => {
    lastPaneRef.current?.scrollIntoView({ behavior: 'smooth', inline: 'end', block: 'nearest' })
  }, [panes.length])

  return (
    <PaneContext.Provider value={{ openPane, closeFrom, paneCount: panes.length }}>
      <div className="md:flex md:flex-1 md:min-h-0 md:overflow-x-auto">
        <div className={cn(
          'md:h-full md:overflow-y-auto md:px-6 md:py-6 md:relative md:bg-[hsl(var(--color-background))] md:border-r md:border-[hsl(var(--color-border))]',
          baseIsPane
            ? 'md:w-[440px] xl:w-[500px] md:shrink-0'
            : 'md:flex-1 md:min-w-[380px]',
        )}
          style={{ zIndex: 10 }}
        >
          <PaneLevelContext.Provider value={0}>
            {children}
          </PaneLevelContext.Provider>
        </div>
        {panes.map((pane, i) => (
          <div
            key={`${i}:${pane.key}`}
            ref={i === panes.length - 1 ? lastPaneRef : undefined}
            style={{ zIndex: 10 - (i + 1) }}
            className={cn(
              'hidden md:block relative w-[440px] xl:w-[500px] shrink-0 h-full overflow-y-auto overflow-x-hidden border-r border-[hsl(var(--color-border))] p-6 bg-[hsl(var(--color-background))]',
              pane.closing
                ? 'transition-all duration-300 ease-in opacity-0 !w-0 !p-0 !border-r-0'
                : 'animate-pane-in',
            )}
          >
            <PaneLevelContext.Provider value={i + 1}>
              {pane.node}
            </PaneLevelContext.Provider>
          </div>
        ))}
      </div>
    </PaneContext.Provider>
  )
}

/**
 * Props to spread on a <Link>. On desktop it opens the href as a pane
 * to the right; on mobile (or for unknown routes) normal navigation runs.
 */
export function usePaneLink(href: string) {
  const level = useContext(PaneLevelContext)
  const ctx = useContext(PaneContext)
  return {
    href,
    onClick: (e: React.MouseEvent) => {
      if (!ctx || typeof window === 'undefined' || window.innerWidth < 768) return
      const node = renderPaneRoute(href)
      if (!node) return
      e.preventDefault()
      ctx.openPane(node, href, level)
    },
  }
}

/**
 * For onClick handlers that call router.push — returns true if it opened a
 * pane (caller should skip the push), false to proceed with navigation.
 */
export function usePaneNavigate() {
  const level = useContext(PaneLevelContext)
  const ctx = useContext(PaneContext)
  return (href: string): boolean => {
    if (!ctx || typeof window === 'undefined' || window.innerWidth < 768) return false
    const node = renderPaneRoute(href)
    if (!node) return false
    ctx.openPane(node, href, level)
    return true
  }
}

/**
 * Back-button behavior: inside a pane it closes that pane (and any deeper),
 * at the base page it returns null and normal navigation should run.
 */
export function usePaneBack() {
  const level = useContext(PaneLevelContext)
  const ctx = useContext(PaneContext)
  if (!ctx || level === 0) return null
  return () => ctx.closeFrom(level - 1)
}
