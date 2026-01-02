import { HTMLAttributes, forwardRef } from 'react'
import { cn } from '@/lib/utils'

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'glass' | 'glass-subtle'
}

const Card = forwardRef<HTMLDivElement, CardProps>(
  ({ className, variant = 'glass', ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          'rounded-[var(--radius-xl)] p-6',
          'transition-all duration-300',
          variant === 'glass' && [
            'bg-[hsl(var(--color-surface))]',
            'backdrop-blur-xl',
            'border border-[hsl(var(--color-border))]',
            'shadow-[0_8px_32px_rgb(0_0_0/0.25)]',
          ],
          variant === 'glass-subtle' && [
            'bg-[hsl(var(--color-surface)/0.8)]',
            'backdrop-blur-md',
            'border border-[hsl(var(--color-border)/0.5)]',
            'shadow-[0_4px_16px_rgb(0_0_0/0.15)]',
          ],
          variant === 'default' && [
            'bg-[hsl(var(--color-surface))]',
            'border border-[hsl(var(--color-border))]',
            'shadow-[var(--shadow-md)]',
          ],
          className
        )}
        {...props}
      />
    )
  }
)

Card.displayName = 'Card'

const CardHeader = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn('flex flex-col space-y-1.5 mb-4', className)}
        {...props}
      />
    )
  }
)

CardHeader.displayName = 'CardHeader'

const CardTitle = forwardRef<HTMLHeadingElement, HTMLAttributes<HTMLHeadingElement>>(
  ({ className, ...props }, ref) => {
    return (
      <h3
        ref={ref}
        className={cn(
          'text-2xl font-semibold leading-none tracking-tight text-[hsl(var(--color-text-primary))]',
          className
        )}
        {...props}
      />
    )
  }
)

CardTitle.displayName = 'CardTitle'

const CardDescription = forwardRef<HTMLParagraphElement, HTMLAttributes<HTMLParagraphElement>>(
  ({ className, ...props }, ref) => {
    return (
      <p
        ref={ref}
        className={cn('text-sm text-[hsl(var(--color-text-secondary))]', className)}
        {...props}
      />
    )
  }
)

CardDescription.displayName = 'CardDescription'

const CardContent = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => {
    return <div ref={ref} className={cn('', className)} {...props} />
  }
)

CardContent.displayName = 'CardContent'

export { Card, CardHeader, CardTitle, CardDescription, CardContent }
