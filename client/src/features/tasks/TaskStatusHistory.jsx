import { ArrowRight } from 'lucide-react'
import { dateTimeFormat } from './dateFormat'
import { StatusBadge } from './TaskBadges'

/** The task's status changes, oldest first, exactly as the API returns them. */
export function TaskStatusHistory({ history }) {
  if (history.length === 0) {
    return <p className="text-sm text-muted-foreground">No status changes yet.</p>
  }

  return (
    <ol aria-label="Status history" className="flex flex-col gap-3">
      {history.map((entry) => (
        <li key={entry.id} className="flex flex-col gap-1 border-l-2 pl-3 sm:flex-row sm:items-center sm:gap-4">
          <span className="flex flex-wrap items-center gap-2">
            <StatusBadge status={entry.from} />
            <ArrowRight className="size-4 text-muted-foreground" aria-hidden="true" />
            <span className="sr-only">changed to</span>
            <StatusBadge status={entry.to} />
          </span>
          <span className="text-sm text-muted-foreground">
            by <span className="text-foreground">{entry.changedBy?.name ?? 'Unknown user'}</span> ·{' '}
            <time dateTime={entry.changedAt}>{dateTimeFormat.format(new Date(entry.changedAt))}</time>
          </span>
        </li>
      ))}
    </ol>
  )
}
