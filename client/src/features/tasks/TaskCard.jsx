import { Link, useLocation } from 'react-router'
import { AlertTriangle, CalendarDays, Pencil, Trash2, User, UserRound } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { PriorityBadge, StatusBadge } from './TaskBadges'
import { dueDateFormat, isOverdue } from './taskMeta'

/** `onEdit` / `onDelete` are only passed for actions the user is expected to be allowed to do. */
export function TaskCard({ task, onEdit, onDelete }) {
  const location = useLocation()
  const overdue = isOverdue(task)

  return (
    <article className="flex flex-col gap-3 rounded-xl border bg-card p-4 shadow-xs transition-[border-color,box-shadow] hover:border-indigo-200 hover:shadow-sm motion-reduce:transition-none sm:p-5">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
        <h2 className="min-w-0 text-base leading-snug font-semibold break-words text-slate-900 dark:text-foreground">
          {/* `from` lets the detail page's "Back" link return to this exact view (filters, page, or board). */}
          <Link
            to={`/tasks/${task.id}`}
            state={{ from: location.pathname + location.search }}
            className="rounded-sm underline-offset-4 outline-none hover:text-indigo-700 hover:underline focus-visible:ring-[3px] focus-visible:ring-indigo-500/50 dark:hover:text-indigo-300"
          >
            {task.title}
          </Link>
        </h2>
        <div className="flex shrink-0 flex-wrap gap-2">
          <StatusBadge status={task.status} />
          <PriorityBadge priority={task.priority} />
        </div>
      </div>

      {task.description && (
        <p className="line-clamp-2 text-sm leading-relaxed break-words text-slate-600 dark:text-slate-300">
          {task.description}
        </p>
      )}

      {task.labels.length > 0 && (
        <ul aria-label="Labels" className="flex flex-wrap gap-1.5">
          {task.labels.map((label) => (
            <li
              key={label}
              className="rounded-md border border-slate-200 bg-slate-50 px-2 py-0.5 text-xs font-medium text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
            >
              {label}
            </li>
          ))}
        </ul>
      )}

      <dl className="flex flex-col gap-1.5 text-sm text-slate-500 sm:flex-row sm:flex-wrap sm:items-center sm:gap-x-5 dark:text-slate-400">
        <div className="flex items-center gap-1.5">
          <dt className="flex items-center gap-1.5">
            <User className="size-4" aria-hidden="true" />
            Creator
          </dt>
          <dd className="font-medium text-slate-800 dark:text-slate-100">{task.creator?.name ?? 'Unknown'}</dd>
        </div>
        <div className="flex items-center gap-1.5">
          <dt className="flex items-center gap-1.5">
            <UserRound className="size-4" aria-hidden="true" />
            Assignee
          </dt>
          <dd className="font-medium text-slate-800 dark:text-slate-100">{task.assignee?.name ?? 'Unassigned'}</dd>
        </div>
        {task.dueDate && (
          <div className="flex flex-wrap items-center gap-1.5">
            <dt className="flex items-center gap-1.5">
              <CalendarDays className="size-4" aria-hidden="true" />
              Due
            </dt>
            <dd
              className={
                overdue ? 'font-semibold text-red-700 dark:text-red-400' : 'font-medium text-slate-800 dark:text-slate-100'
              }
            >
              <time dateTime={task.dueDate}>{dueDateFormat.format(new Date(task.dueDate))}</time>
            </dd>
            {/* Text, not just colour, so the warning doesn't rely on seeing red. */}
            {overdue && (
              <span className="inline-flex items-center gap-1 rounded-md bg-red-50 px-1.5 py-0.5 text-xs font-semibold text-red-700 dark:bg-red-950 dark:text-red-300">
                <AlertTriangle className="size-3" aria-hidden="true" />
                Overdue
              </span>
            )}
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
            <Button
              variant="outline"
              size="sm"
              onClick={onDelete}
              aria-label={`Delete task: ${task.title}`}
              className="text-red-700 hover:bg-red-50 hover:text-red-800 dark:text-red-400 dark:hover:bg-red-950"
            >
              <Trash2 aria-hidden="true" />
              Delete
            </Button>
          )}
        </div>
      )}
    </article>
  )
}
