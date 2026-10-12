import { useDraggable } from '@dnd-kit/core'
import { CalendarDays, GripVertical, Loader2, UserRound } from 'lucide-react'
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select'
import { PriorityBadge } from './TaskBadges'
import { TASK_STATUSES } from './tasks'

// Date-only due dates are stored as midnight UTC, so format in UTC (same as the list view).
const dateFormat = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeZone: 'UTC' })

/**
 * A compact card for the board. `canMove` is only a UI hint (the server decides); when it is false the card
 * is read-only. While `isMoving`, the card is locked so the same task can't be moved twice at once.
 * Two ways to change status: drag the handle, or use the "Move to" select (keyboard, touch and screen reader friendly).
 */
export function BoardCard({ task, canMove, isMoving, onMove }) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, isDragging } = useDraggable({
    id: task.id,
    disabled: !canMove || isMoving,
  })

  const style = transform ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` } : undefined

  return (
    <li
      ref={setNodeRef}
      style={style}
      aria-busy={isMoving || undefined}
      className={`relative flex flex-col gap-2 rounded-lg border bg-card p-3 text-card-foreground shadow-xs ${
        isDragging ? 'z-20 shadow-lg ring-2 ring-ring' : ''
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
            className="-ml-1 touch-none rounded p-0.5 text-muted-foreground hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none disabled:opacity-50"
          >
            <GripVertical className="size-4" aria-hidden="true" />
          </button>
        )}
        <h3 className="min-w-0 flex-1 text-sm leading-snug font-medium break-words">{task.title}</h3>
        {isMoving && <Loader2 className="size-4 shrink-0 animate-spin text-muted-foreground" aria-hidden="true" />}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <PriorityBadge priority={task.priority} />
      </div>

      <dl className="flex flex-col gap-1 text-xs text-muted-foreground">
        <div className="flex items-center gap-1.5">
          <dt className="flex items-center gap-1">
            <UserRound className="size-3.5" aria-hidden="true" />
            <span className="sr-only">Assignee</span>
          </dt>
          <dd className="text-foreground">{task.assignee?.name ?? 'Unassigned'}</dd>
        </div>
        {task.dueDate && (
          <div className="flex items-center gap-1.5">
            <dt className="flex items-center gap-1">
              <CalendarDays className="size-3.5" aria-hidden="true" />
              <span className="sr-only">Due</span>
            </dt>
            <dd className="text-foreground">
              <time dateTime={task.dueDate}>{dateFormat.format(new Date(task.dueDate))}</time>
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
