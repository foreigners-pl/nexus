import { InputHTMLAttributes, forwardRef } from 'react'
import { cn } from '@/lib/utils'

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
}

const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, error, type = 'text', ...props }, ref) => {
    return (
      <div className="w-full">
        {label && (
          <label className="block text-sm font-medium text-[hsl(var(--color-text-secondary))] mb-2">
            {label}
          </label>
        )}
        <input
          type={type}
          className={cn(
            'flex h-10 w-full rounded-xl px-3 py-2',
            'bg-[hsl(var(--color-surface))] backdrop-blur-sm',
            'border border-[hsl(var(--color-border))]',
            'text-[hsl(var(--color-text-primary))] text-sm',
            'placeholder:text-[hsl(var(--color-text-muted))]',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--color-border-hover))]',
            'focus-visible:border-[hsl(var(--color-text-muted))]',
            'focus-visible:bg-[hsl(var(--color-surface-hover))]',
            'disabled:cursor-not-allowed disabled:opacity-50',
            'transition-all duration-300',
            // Date input specific styling
            type === 'date' && '[color-scheme:dark] cursor-pointer',
            type === 'date' && '::-webkit-calendar-picker-indicator:cursor-pointer',
            type === 'date' && '::-webkit-calendar-picker-indicator:opacity-70',
            type === 'date' && '::-webkit-calendar-picker-indicator:hover:opacity-100',
            error && 'border-[hsl(var(--color-error)/0.5)] focus-visible:ring-[hsl(var(--color-error)/0.5)]',
            className
          )}
          ref={ref}
          {...props}
        />
        {error && (
          <p className="mt-1 text-sm text-[hsl(var(--color-error))]">{error}</p>
        )}
      </div>
    )
  }
)

Input.displayName = 'Input'

export { Input }
