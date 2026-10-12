import { useDraggable } from '@dnd-kit/core'
import { AlertTriangle, CalendarDays, GripVertical, Loader2, UserRound } from 'lucide-react'
import { Link, useLocation } from 'react-router'
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select'
import { PriorityBadge } from './TaskBadges'
import { dueDateFormat, isOverdue } from './taskMeta'
import { TASK_STATUSES } from './tasks'

/**
 * A compact card for the board. `canMove` is only a UI hint (the server decides); when it is false the card
 * is read-only. While `isMoving`, the card is locked so the same task can't be moved twice at once.
 * Two ways to change status: drag the handle, or use the "Move to" select (keyboard, touch and screen reader friendly).
 */
export function BoardCard({ task, canMove, isMoving, onMove }) {
  const location = useLocation()
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, isDragging } = useDraggable({
    id: task.id,
    disabled: !canMove || isMoving,
  })
  const overdue = isOverdue(task)

  const style = transform ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` } : undefined

  return (
    <li
      ref={setNodeRef}
      style={style}
      aria-busy={isMoving || undefined}
      className={`relative flex flex-col gap-2.5 rounded-lg border bg-card p-3 text-card-foreground shadow-xs transition-[border-color,box-shadow] focus-within:border-indigo-300 motion-reduce:transition-none ${
        isDragging
          ? 'z-20 border-indigo-400 shadow-lg ring-2 ring-indigo-500/40'
          : 'hover:border-indigo-200 hover:shadow-sm'
      } ${isMoving ? 'opacity-60' : ''}`}
    >
      <div className="flex items-start gap-2">
        {canMove && (
          <button
            type="button"
            ref={setActivatorNodeRef}
            {...listeners}
            {...attributes}
            disabled={isMoving}
            aria-label={`Drag task: ${task.title}`}
            className="-ml-1 cursor-grab touch-none rounded p-0.5 text-slate-400 outline-none hover:bg-slate-100 hover:text-slate-700 focus-visible:ring-[3px] focus-visible:ring-indigo-500/50 active:cursor-grabbing disabled:opacity-50 dark:hover:bg-slate-800"
          >
            <GripVertical className="size-4" aria-hidden="true" />
          </button>
        )}
        <h3 className="min-w-0 flex-1 text-sm leading-snug font-semibold break-words text-slate-900 dark:text-foreground">
          {/* Only the drag handle starts a drag, so this link still works normally. */}
          <Link
            to={`/tasks/${task.id}`}
            state={{ from: location.pathname + location.search }}
            className="rounded-sm underline-offset-4 outline-none hover:text-indigo-700 hover:underline focus-visible:ring-[3px] focus-visible:ring-indigo-500/50 dark:hover:text-indigo-300"
          >
            {task.title}
          </Link>
        </h3>
        {isMoving && <Loader2 className="size-4 shrink-0 animate-spin text-muted-foreground" aria-hidden="true" />}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <PriorityBadge priority={task.priority} />
        {overdue && (
          <span className="inline-flex items-center gap-1 rounded-md bg-red-50 px-1.5 py-0.5 text-xs font-semibold text-red-700 dark:bg-red-950 dark:text-red-300">
            <AlertTriangle className="size-3" aria-hidden="true" />
            Overdue
          </span>
        )}
      </div>

      {task.labels.length > 0 && (
        <ul aria-label="Labels" className="flex flex-wrap gap-1">
          {task.labels.map((label) => (
            <li
              key={label}
              title={label}
              className="max-w-full truncate rounded-md border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-xs font-medium text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
            >
              {label}
            </li>
          ))}
        </ul>
      )}

      <dl className="flex flex-col gap-1 text-xs text-slate-500 dark:text-slate-400">
        <div className="flex min-w-0 items-center gap-1.5">
          <dt className="flex items-center gap-1">
            <UserRound className="size-3.5" aria-hidden="true" />
            <span className="sr-only">Assignee</span>
          </dt>
          <dd className="min-w-0 truncate font-medium text-slate-800 dark:text-slate-100">
            {task.assignee?.name ?? 'Unassigned'}
          </dd>
        </div>
        {task.dueDate && (
          <div className="flex items-center gap-1.5">
            <dt className="flex items-center gap-1">
              <CalendarDays className="size-3.5" aria-hidden="true" />
              <span className="sr-only">Due</span>
            </dt>
            <dd
              className={
                overdue ? 'font-semibold text-red-700 dark:text-red-400' : 'font-medium text-slate-800 dark:text-slate-100'
              }
            >
              <time dateTime={task.dueDate}>{dueDateFormat.format(new Date(task.dueDate))}</time>
            </dd>
          </div>
        )}
      </dl>

      {canMove && (
        <NativeSelect
          size="sm"
          value={task.status}
          disabled={isMoving}
          onChange={(event) => onMove(task, event.target.value)}
          aria-label={`Move “${task.title}” to status`}
          className="w-full"
        >
          {TASK_STATUSES.map((status) => (
            <NativeSelectOption key={status} value={status}>
              {status}
            </NativeSelectOption>
          ))}
        </NativeSelect>
      )}
    </li>
  )
}
