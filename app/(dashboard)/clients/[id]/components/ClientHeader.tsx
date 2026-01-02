'use client'

import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/Button'
import type { Client } from '@/types/database'

interface ClientHeaderProps {
  client: Client
  onDelete: () => void
}

export function ClientHeader({ client, onDelete }: ClientHeaderProps) {
  const router = useRouter()

  return (
    <div className="flex justify-between items-center">
      <div className="flex items-center gap-4">
        {/* Glass Icon */}
        <div className="relative">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[hsl(var(--color-primary))] to-[hsl(var(--color-primary)/0.7)] flex items-center justify-center shadow-[0_8px_32px_rgb(0_0_0/0.3)]">
            <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
          </div>
          {/* Glow effect */}
          <div className="absolute inset-0 rounded-2xl bg-[hsl(var(--color-primary))] blur-xl opacity-30 -z-10"></div>
        </div>
        
        <div>
          <div className="flex items-center gap-3 mb-1">
            <Button 
              variant="ghost" 
              size="sm"
              onClick={() => router.push('/clients')}
              className="text-[hsl(var(--color-text-secondary))] hover:text-[hsl(var(--color-text-primary))]"
            >
              ← Back to Clients
            </Button>
          </div>
          <h1 className="text-2xl font-semibold text-[hsl(var(--color-text-primary))]">
            {client.first_name || client.last_name || client.contact_email || 'Unnamed Client'}
            {client.first_name && client.last_name && ` ${client.last_name}`}
          </h1>
          <div className="flex items-center gap-3 mt-1">
            {client.client_code && (
              <span className="text-sm text-[hsl(var(--color-text-secondary))] font-mono bg-[hsl(var(--color-surface-hover))] px-2 py-0.5 rounded">
                {client.client_code}
              </span>
            )}
            <span className="text-sm text-[hsl(var(--color-text-muted))]">
              Client since {new Date(client.created_at).toLocaleDateString()}
            </span>
          </div>
        </div>
      </div>
      
      <Button 
        variant="ghost" 
        onClick={onDelete}
        className="text-red-400 hover:text-red-300 hover:bg-red-500/10"
      >
        Delete Client
      </Button>
    </div>
  )
}
