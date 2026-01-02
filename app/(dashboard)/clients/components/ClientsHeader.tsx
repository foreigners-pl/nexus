'use client'

import { Button } from '@/components/ui/Button'

interface ClientsHeaderProps {
  onAddClick: () => void
}

export function ClientsHeader({ onAddClick }: ClientsHeaderProps) {
  return (
    <div className="flex justify-between items-center">
      <div className="flex items-center gap-4">
        {/* Icon with glass effect */}
        <div className="p-3 rounded-2xl bg-[hsl(var(--color-primary))]/20 backdrop-blur-sm border border-[hsl(var(--color-primary))]/30 shadow-[0_0_20px_hsl(var(--color-primary)/0.2)]">
          <svg className="w-8 h-8 text-[hsl(var(--color-primary))]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
          </svg>
        </div>
        <div>
          <h1 className="text-3xl font-bold text-[hsl(var(--color-text-primary))]">
            Clients
          </h1>
          <p className="text-[hsl(var(--color-text-secondary))] mt-1">
            Manage your clients and their information
          </p>
        </div>
      </div>
      <Button 
        onClick={onAddClick}
        className="shadow-[0_4px_20px_hsl(var(--color-primary)/0.3)] hover:shadow-[0_6px_30px_hsl(var(--color-primary)/0.4)] transition-all duration-300"
      >
        <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
        </svg>
        Add Client
      </Button>
    </div>
  )
}
