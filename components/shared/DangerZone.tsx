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
        {description && (
          <p className="text-sm text-[hsl(var(--color-text-secondary))]">{description}</p>
        )}
        <Button
          onClick={onDelete}
          disabled={disabled}
          className="bg-red-600 hover:bg-red-700 text-white"
        >
          {buttonText}
        </Button>
      </div>
    </div>
  )
}
