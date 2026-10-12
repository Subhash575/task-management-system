import { CalendarDays, Pencil, Trash2, User, UserRound } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { PriorityBadge, StatusBadge } from './TaskBadges'

// Date-only due dates are stored as midnight UTC, so format in UTC to avoid showing the previous day.
const dateFormat = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeZone: 'UTC' })

/** `onEdit` / `onDelete` are only passed for actions the user is expected to be allowed to do. */
export function TaskCard({ task, onEdit, onDelete }) {
  return (
    <Card className="gap-3 py-4">
      <CardContent className="flex flex-col gap-3 px-4 sm:px-6">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <h2 className="text-base leading-snug font-semibold break-words">{task.title}</h2>
          <div className="flex shrink-0 flex-wrap gap-2">
            <StatusBadge status={task.status} />
            <PriorityBadge priority={task.priority} />
          </div>
        </div>

        {task.description && (
          <p className="line-clamp-2 text-sm break-words text-muted-foreground">{task.description}</p>
        )}

        {task.labels.length > 0 && (
          <ul aria-label="Labels" className="flex flex-wrap gap-1.5">
            {task.labels.map((label) => (
              <li key={label}>
                <Badge variant="outline">{label}</Badge>
              </li>
            ))}
          </ul>
        )}

        <dl className="flex flex-col gap-1 text-sm text-muted-foreground sm:flex-row sm:flex-wrap sm:gap-x-6">
          <div className="flex items-center gap-1.5">
            <dt className="flex items-center gap-1.5">
              <User className="size-4" aria-hidden="true" />
              Creator
            </dt>
            <dd className="text-foreground">{task.creator?.name ?? 'Unknown'}</dd>
          </div>
          <div className="flex items-center gap-1.5">
            <dt className="flex items-center gap-1.5">
              <UserRound className="size-4" aria-hidden="true" />
              Assignee
            </dt>
            <dd className="text-foreground">{task.assignee?.name ?? 'Unassigned'}</dd>
          </div>
          {task.dueDate && (
            <div className="flex items-center gap-1.5">
              <dt className="flex items-center gap-1.5">
                <CalendarDays className="size-4" aria-hidden="true" />
                Due
              </dt>
              <dd className="text-foreground">
                <time dateTime={task.dueDate}>{dateFormat.format(new Date(task.dueDate))}</time>
              </dd>
            </div>
          )}
        </dl>

        {(onEdit || onDelete) && (
          <div className="flex gap-2 border-t pt-3">
            {onEdit && (
              <Button variant="outline" size="sm" onClick={onEdit} aria-label={`Edit task: ${task.title}`}>
                <Pencil aria-hidden="true" />
                Edit
              </Button>
            )}
            {onDelete && (
              <Button variant="outline" size="sm" onClick={onDelete} aria-label={`Delete task: ${task.title}`}>
                <Trash2 aria-hidden="true" />
                Delete
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
