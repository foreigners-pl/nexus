import { Button } from '@/components/ui/Button'

interface DangerZoneProps {
  title?: string
  description?: string
  buttonText: string
  onDelete: () => void
  disabled?: boolean
}

export function DangerZone({
  title = 'Danger zone',
  description,
  buttonText,
  onDelete,
  disabled,
}: DangerZoneProps) {
  return (
    <div className="pt-6 border-t border-[hsl(var(--color-border))]">
      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-red-400">{title}</h3>
        {description && (
          <p className="text-sm text-[hsl(var(--color-text-secondary))]">{description}</p>
        )}
        <Button
          variant="ghost"
          size="sm"
          onClick={onDelete}
          disabled={disabled}
          className="text-red-400 hover:text-red-300 hover:bg-red-500/10"
        >
          {buttonText}
        </Button>
      </div>
    </div>
  )
}
