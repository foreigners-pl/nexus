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
  description = 'This action cannot be undone.',
  buttonText,
  onDelete,
  disabled,
}: DangerZoneProps) {
  return (
    <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-5 space-y-3">
      <div>
        <h3 className="text-sm font-semibold text-red-400">{title}</h3>
        <p className="text-xs text-[hsl(var(--color-text-secondary))] mt-0.5">{description}</p>
      </div>
      <Button
        variant="secondary"
        onClick={onDelete}
        disabled={disabled}
        className="w-full sm:w-auto text-red-400 hover:text-red-300 hover:bg-red-500/10 border-red-500/20"
      >
        {buttonText}
      </Button>
    </div>
  )
}
