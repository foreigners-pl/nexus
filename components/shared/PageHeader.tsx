import { ReactNode } from 'react'
import { Button } from '@/components/ui/Button'

interface PageHeaderProps {
  title: string
  subtitle?: string
  icon?: ReactNode
  action?: {
    label: string
    onClick: () => void
    icon?: ReactNode
  }
}

export function PageHeader({ title, subtitle, icon, action }: PageHeaderProps) {
  return (
    <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-6">
      <div className="flex items-center gap-3 sm:gap-4">
        {icon && (
          <div className="p-2.5 sm:p-3 rounded-xl sm:rounded-2xl bg-[hsl(var(--color-primary))]/20 backdrop-blur-sm border border-[hsl(var(--color-primary))]/30 shadow-[0_0_20px_hsl(var(--color-primary)/0.2)]">
            {icon}
          </div>
        )}
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-[hsl(var(--color-text-primary))]">
            {title}
          </h1>
          {subtitle && (
            <p className="text-xs sm:text-sm text-[hsl(var(--color-text-secondary))] mt-0.5 hidden sm:block">
              {subtitle}
            </p>
          )}
        </div>
      </div>
      {action && (
        <Button 
          onClick={action.onClick}
          size="sm"
          className="shadow-[0_4px_20px_hsl(var(--color-primary)/0.3)] hover:shadow-[0_6px_30px_hsl(var(--color-primary)/0.4)] transition-all duration-300 sm:size-default"
        >
          {action.icon}
          <span className="sm:inline">{action.label}</span>
        </Button>
      )}
    </div>
  )
}