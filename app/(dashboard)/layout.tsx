import { Navbar } from '@/components/layout/Navbar'

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="h-screen bg-[hsl(var(--color-background))] flex flex-col">
      <Navbar />
      <main className="ml-64 p-8 flex-1 overflow-y-auto">
        {children}
      </main>
    </div>
  )
}
