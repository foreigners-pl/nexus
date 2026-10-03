import { MobileTabBar } from '@/components/layout/MobileTabBar'
import { NotificationBell } from '@/components/notifications/NotificationBell'

export default function MobileLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen bg-[hsl(var(--color-background))] flex flex-col">
      {/* Branding header */}
      <header className="sticky top-0 z-40 bg-[hsl(var(--color-surface))]/90 backdrop-blur border-b border-[hsl(var(--color-border))] safe-area-top">
        <div className="max-w-lg mx-auto px-4 h-14 flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-[hsl(var(--color-accent))] flex items-center justify-center text-white font-bold">
            N
          </div>
          <h1 className="text-lg font-bold text-[hsl(var(--color-text-primary))]">
            Nexus CRM
          </h1>
          <div className="ml-auto">
            <NotificationBell />
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-lg mx-auto w-full px-4 pt-4 pb-24">
        {children}
      </main>

      <MobileTabBar />
    </div>
  )
}
