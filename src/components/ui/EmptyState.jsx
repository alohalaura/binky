import { Card } from './Card'
import { Button } from './Button'
import { RabbitIcon } from '../icons/RabbitIcon'

export function EmptyState({
  title,
  description,
  actionLabel,
  onAction,
  icon = 'rabbit',
  className = '',
}) {
  const showAction = Boolean(actionLabel && onAction)

  return (
    <Card className={className}>
      <div className="flex h-full flex-col items-center justify-center py-10 text-center">
        <div className="text-lavender">
          {icon === 'rabbit' ? <RabbitIcon className="h-12 w-12" title="Rabbit" /> : null}
        </div>
        <div className="mt-3 text-sm font-semibold text-text-dark">{title}</div>
        {description ? (
          <div className="mt-1 max-w-md text-sm text-text-mid">{description}</div>
        ) : null}
        {showAction ? (
          <div className="mt-5">
            <Button type="button" onClick={onAction}>
              {actionLabel}
            </Button>
          </div>
        ) : null}
      </div>
    </Card>
  )
}

