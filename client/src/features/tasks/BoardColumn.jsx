import { useDroppable } from '@dnd-kit/core'
import { BoardCard } from './BoardCard'

/** One status column. Its droppable id is the status itself. */
export function BoardColumn({ status, tasks, canMove, movingIds, onMove }) {
  const { setNodeRef, isOver } = useDroppable({ id: status })
  const slug = status.toLowerCase().replace(/\s+/g, '-') // ids used in aria-labelledby cannot contain spaces

  return (
    <section
      aria-labelledby={`column-${slug}-name`}
      className="flex w-72 shrink-0 snap-start flex-col gap-3 rounded-xl border bg-muted/40 p-3 sm:w-auto sm:min-w-0 sm:flex-1"
    >
      <h2 className="flex items-center justify-between text-sm font-semibold">
        <span id={`column-${slug}-name`}>{status}</span>
        <span className="rounded-full bg-background px-2 py-0.5 text-xs text-muted-foreground" aria-label={`${tasks.length} tasks`}>
          {tasks.length}
        </span>
      </h2>
      <ul
        ref={setNodeRef}
        aria-label={`${status} tasks`}
        className={`flex min-h-24 flex-1 flex-col gap-2 rounded-lg ${isOver ? 'bg-accent/60 ring-2 ring-ring/50' : ''}`}
      >
        {tasks.map((task) => (
          <BoardCard key={task.id} task={task} canMove={canMove(task)} isMoving={movingIds.has(task.id)} onMove={onMove} />
        ))}
        {tasks.length === 0 && <li className="px-1 py-4 text-center text-sm text-muted-foreground">No tasks</li>}
      </ul>
    </section>
  )
}
