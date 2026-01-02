import { ButtonHTMLAttributes, forwardRef } from 'react'
import { cn } from '@/lib/utils'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger'
  size?: 'sm' | 'md' | 'lg'
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', size = 'md', ...props }, ref) => {
    return (
      <button
        className={cn(
          // Base styles
          'inline-flex items-center justify-center rounded-xl font-medium cursor-pointer',
          'transition-all duration-300',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2',
          'disabled:pointer-events-none disabled:opacity-50',
          
          // Variants
          {
            'bg-[hsl(var(--color-primary))] text-[hsl(var(--color-primary-foreground))] hover:bg-[hsl(var(--color-primary-hover))] shadow-[0_2px_12px_hsl(var(--color-primary)/0.3)] hover:shadow-[0_4px_16px_hsl(var(--color-primary)/0.4)] hover:scale-[1.02]':
              variant === 'primary',
            'bg-[hsl(var(--color-surface-hover))] backdrop-blur-sm border border-[hsl(var(--color-border))] text-[hsl(var(--color-text-primary))] hover:bg-[hsl(var(--color-surface-active))] hover:scale-[1.02]':
              variant === 'secondary',
            'border border-[hsl(var(--color-border))] bg-transparent hover:bg-[hsl(var(--color-surface-hover))] hover:scale-[1.02]':
              variant === 'outline',
            'hover:bg-[hsl(var(--color-surface-hover))] text-[hsl(var(--color-text-secondary))] hover:scale-[1.02]':
              variant === 'ghost',
            'bg-[hsl(var(--color-error))] text-white hover:opacity-90 shadow-[0_2px_12px_hsl(var(--color-error)/0.3)] hover:shadow-[0_4px_16px_hsl(var(--color-error)/0.4)] hover:scale-[1.02]':
              variant === 'danger',
          },
          
          // Sizes
          {
            'h-8 px-3 text-sm': size === 'sm',
            'h-10 px-4': size === 'md',
            'h-12 px-6 text-lg': size === 'lg',
          },
          
          className
        )}
        ref={ref}
        {...props}
      />
    )
  }
)

Button.displayName = 'Button'

export { Button }
