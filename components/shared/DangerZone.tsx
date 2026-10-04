import { Button } from '@/components/ui/Button'

interface DangerZoneProps {
  title?: string
  buttonText: string
  onDelete: () => void
  disabled?: boolean
}

export function DangerZone({
  title = 'Danger zone',
  buttonText,
  onDelete,
  disabled,
}: DangerZoneProps) {
  return (
    <div className="pt-6 border-t border-[hsl(var(--color-border))]">
      <h3 className="text-sm font-semibold text-red-400 mb-3">{title}</h3>
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
  )
}
