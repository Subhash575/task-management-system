import { useDroppable } from '@dnd-kit/core'
import { BoardCard } from './BoardCard'
import { STATUS_DOT } from './taskMeta'

/** One status column. Its droppable id is the status itself. */
export function BoardColumn({ status, tasks, canMove, movingIds, onMove }) {
  const { setNodeRef, isOver } = useDroppable({ id: status })
  const slug = status.toLowerCase().replace(/\s+/g, '-') // ids used in aria-labelledby cannot contain spaces

  return (
    <section
      aria-labelledby={`column-${slug}-name`}
      className="flex w-72 shrink-0 snap-start flex-col gap-3 rounded-xl border bg-slate-50 p-2.5 sm:w-auto sm:min-w-0 sm:flex-1 dark:bg-muted/30"
    >
      <h2 className="flex items-center justify-between px-1 text-sm font-semibold text-slate-900 dark:text-foreground">
        <span className="flex items-center gap-2">
          <span className={`size-2 rounded-full ${STATUS_DOT[status]}`} aria-hidden="true" />
          <span id={`column-${slug}-name`}>{status}</span>
        </span>
        <span
          className="rounded-full border bg-white px-2 py-0.5 text-xs font-medium text-slate-600 dark:bg-background dark:text-slate-300"
          aria-label={`${tasks.length} tasks`}
        >
          {tasks.length}
        </span>
      </h2>
      {/* Highlighted while a card is dragged over it, so the drop target is obvious. */}
      <ul
        ref={setNodeRef}
        aria-label={`${status} tasks`}
        className={`flex min-h-24 flex-1 flex-col gap-2 rounded-lg transition-colors motion-reduce:transition-none ${
          isOver ? 'bg-indigo-50 ring-2 ring-indigo-400/60 dark:bg-indigo-950/40' : ''
        }`}
      >
        {tasks.map((task) => (
          <BoardCard key={task.id} task={task} canMove={canMove(task)} isMoving={movingIds.has(task.id)} onMove={onMove} />
        ))}
        {tasks.length === 0 && (
          <li className="rounded-lg border border-dashed px-1 py-6 text-center text-sm text-slate-500 dark:text-slate-400">
            No tasks
          </li>
        )}
      </ul>
    </section>
  )
}
