import { useRef, useState } from 'react'
import { DndContext, KeyboardSensor, PointerSensor, useSensor, useSensors } from '@dnd-kit/core'
import { AlertCircle, Info, RefreshCw, X } from 'lucide-react'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { useSession } from '@/features/auth/auth'
import { BoardColumn } from './BoardColumn'
import { statusFromDragEnd } from './boardDrag'
import { TaskEmptyState } from './TaskEmptyState'
import { describeError } from './taskForm'
import { BOARD_MAX_PAGES, BOARD_PAGE_LIMIT, TASK_STATUSES, useBoardTasks, useMoveTask } from './tasks'

function BoardSkeleton() {
  return (
    <div role="status" aria-label="Loading board" className="flex gap-3 overflow-hidden">
      {TASK_STATUSES.map((status) => (
        <div key={status} className="flex w-72 shrink-0 flex-col gap-3 rounded-xl border p-3 sm:w-auto sm:flex-1">
          <Skeleton className="h-5 w-1/2" />
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
        </div>
      ))}
    </div>
  )
}

/** `filters` is `{ priority, scope }`. The board shows exactly the tasks the API returns for them. */
export function TaskBoard({ filters, hasFilters, onClearFilters }) {
  const { data, isPending, isError, isFetching, refetch } = useBoardTasks(filters)
  const { data: currentUser } = useSession()
  const moveTask = useMoveTask()
  const [movingIds, setMovingIds] = useState(() => new Set())
  const [moveError, setMoveError] = useState(null)
  // Updated synchronously, so two quick actions on one task can't both slip through before a re-render.
  const inFlight = useRef(new Set())

  // A small drag distance keeps plain clicks (and the select) working. Keyboard users can also drag from the handle.
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor),
  )

  // Only a UI hint, mirroring the server rule: the creator or the assignee may change the status.
  const canMove = (task) => task.creator?.id === currentUser?.id || task.assignee?.id === currentUser?.id

  async function requestMove(task, status) {
    if (status === task.status || inFlight.current.has(task.id)) return // same column, or a move is already in flight
    inFlight.current.add(task.id)
    setMoveError(null)
    setMovingIds((current) => new Set(current).add(task.id))
    try {
      await moveTask.mutateAsync({ id: task.id, status, previousStatus: task.status })
    } catch (error) {
      // The card has already been put back; explain why without blocking the board.
      setMoveError({ title: task.title, message: describeError(error) })
    } finally {
      inFlight.current.delete(task.id)
      setMovingIds((current) => {
        const next = new Set(current)
        next.delete(task.id)
        return next
      })
    }
  }

  function handleDragEnd(event) {
    const move = statusFromDragEnd(event, data?.tasks ?? [])
    if (move && canMove(move.task)) requestMove(move.task, move.status)
  }

  if (isPending) return <BoardSkeleton />

  if (isError) {
    return (
      <div className="flex flex-col items-start gap-3">
        <p role="alert" className="flex items-center gap-2 text-destructive">
          <AlertCircle className="size-4 shrink-0" aria-hidden="true" />
          Could not load tasks. Check your connection and try again.
        </p>
        <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>
          <RefreshCw className={isFetching ? 'animate-spin' : undefined} aria-hidden="true" />
          Try again
        </Button>
      </div>
    )
  }

  if (data.tasks.length === 0) return <TaskEmptyState filtered={hasFilters} onClear={onClearFilters} />

  const byStatus = Object.fromEntries(TASK_STATUSES.map((status) => [status, []]))
  for (const task of data.tasks) byStatus[task.status]?.push(task)

  return (
    <div className="flex flex-col gap-3" aria-busy={isFetching}>
      {moveError && (
        <Alert variant="destructive" role="alert">
          <AlertCircle aria-hidden="true" />
          <AlertDescription className="flex flex-wrap items-center justify-between gap-2">
            <span>
              Could not move “{moveError.title}”. {moveError.message}
            </span>
            <Button variant="ghost" size="sm" onClick={() => setMoveError(null)}>
              <X aria-hidden="true" />
              Dismiss
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {data.truncated && (
        <Alert role="status">
          <Info aria-hidden="true" />
          <AlertDescription>
            The board shows the first {BOARD_MAX_PAGES * BOARD_PAGE_LIMIT} of {data.total} tasks. Use the filters to
            narrow it down.
          </AlertDescription>
        </Alert>
      )}

      <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
        {/* Narrow screens scroll sideways, one column at a time; wide screens fit all five. */}
        <div
          role="group"
          aria-label="Kanban board"
          className="-mx-4 flex snap-x gap-3 overflow-x-auto px-4 pb-2 sm:mx-0 sm:px-0"
        >
          {TASK_STATUSES.map((status) => (
            <BoardColumn
              key={status}
              status={status}
              tasks={byStatus[status]}
              canMove={canMove}
              movingIds={movingIds}
              onMove={requestMove}
            />
          ))}
        </div>
      </DndContext>
    </div>
  )
}
