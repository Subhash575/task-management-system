import { useState } from 'react'
import { AlertCircle, CheckCircle2, Plus, RefreshCw } from 'lucide-react'
import { NavLink } from 'react-router'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { useSession } from '@/features/auth/auth'
import { CreateTaskDialog } from '@/features/tasks/CreateTaskDialog'
import { DeleteTaskDialog } from '@/features/tasks/DeleteTaskDialog'
import { EditTaskDialog } from '@/features/tasks/EditTaskDialog'
import { TaskBoard } from '@/features/tasks/TaskBoard'
import { TaskCard } from '@/features/tasks/TaskCard'
import { TaskEmptyState } from '@/features/tasks/TaskEmptyState'
import { TaskFilters } from '@/features/tasks/TaskFilters'
import { TaskPagination } from '@/features/tasks/TaskPagination'
import { INITIAL_FILTERS, useTasks } from '@/features/tasks/tasks'

function TaskListSkeleton() {
  return (
    <div role="status" aria-label="Loading tasks" className="flex flex-col gap-3">
      {Array.from({ length: 3 }, (_, index) => (
        <div key={index} className="flex flex-col gap-3 rounded-xl border p-4">
          <Skeleton className="h-5 w-2/3" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-1/3" />
        </div>
      ))}
    </div>
  )
}

/** `view` is "list" (the default, at /) or "board" (the Kanban board, at /board). */
export function TasksPage({ view = 'list' }) {
  const isBoard = view === 'board'
  const [filters, setFilters] = useState(INITIAL_FILTERS)
  const [createOpen, setCreateOpen] = useState(false)
  // The latest action result: { kind: 'created' | 'updated' | 'deleted', title }.
  const [notice, setNotice] = useState(null)
  const [editingTask, setEditingTask] = useState(null)
  const [deletingTask, setDeletingTask] = useState(null)
  const { data: currentUser } = useSession()
  const { data, isPending, isError, isFetching, isPlaceholderData, refetch } = useTasks(filters, { enabled: !isBoard })

  // Safety net: if the current page no longer exists (e.g. tasks were deleted elsewhere), go to the last one.
  // React allows adjusting state while rendering when it is guarded like this; no effect is needed.
  if (data && !isPlaceholderData && data.tasks.length === 0 && filters.page > 1) {
    setFilters((current) => ({ ...current, page: Math.max(1, data.pagination.totalPages) }))
  }

  // Changing a filter always returns to page 1, since the old page number may not exist any more.
  const changeFilters = (changes) => setFilters((current) => ({ ...current, ...changes, page: 1 }))
  const clearFilters = () => setFilters(INITIAL_FILTERS)
  const changePage = (page) => setFilters((current) => ({ ...current, page }))

  const hasFilters = Boolean(filters.status || filters.priority || filters.scope)
  // New tasks are listed newest first, so they show on page 1 of an unfiltered list.
  // The board has no pages and no status filter, so only priority and scope can hide a new task there.
  const isViewNarrowed = isBoard ? Boolean(filters.priority || filters.scope) : hasFilters || filters.page > 1
  const showNewestTasks = () => {
    setFilters(INITIAL_FILTERS)
    setNotice(null)
  }

  function handleDeleted(task) {
    setDeletingTask(null)
    setNotice({ kind: 'deleted', title: task.title })
    // Deleting the only task on the last page would leave an empty page, so step back one page.
    if (data?.tasks.length === 1 && filters.page > 1) changePage(filters.page - 1)
  }

  // Backend authorization is authoritative; these only decide which actions to offer.
  // Creators may edit and delete. Assignees may change only the status and cannot delete.
  const actionsFor = (task) => {
    const isCreator = task.creator?.id === currentUser?.id
    const isAssignee = task.assignee?.id === currentUser?.id
    return {
      onEdit: isCreator || isAssignee ? () => setEditingTask(task) : undefined,
      onDelete: isCreator ? () => setDeletingTask(task) : undefined,
    }
  }
  const editingAsAssigneeOnly = editingTask ? editingTask.creator?.id !== currentUser?.id : false

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Tasks</h1>
          <p className="text-muted-foreground">Tasks you created or that are assigned to you.</p>
        </div>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus aria-hidden="true" />
          Create Task
        </Button>
      </div>

      <nav aria-label="Task views" className="inline-flex w-fit rounded-lg border bg-muted/40 p-1">
        {[
          { to: '/', label: 'List', end: true },
          { to: '/board', label: 'Board' },
        ].map(({ to, label, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              `rounded-md px-3 py-1 text-sm font-medium focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none ${
                isActive ? 'bg-background shadow-xs' : 'text-muted-foreground hover:text-foreground'
              }`
            }
          >
            {label}
          </NavLink>
        ))}
      </nav>

      {notice && (
        <Alert role="status">
          <CheckCircle2 aria-hidden="true" />
          <AlertDescription className="flex flex-wrap items-center gap-x-3 gap-y-2">
            <span>
              Task “{notice.title}” was {notice.kind}.
              {notice.kind === 'created' && isViewNarrowed && ' It may not appear in the current view.'}
            </span>
            {notice.kind === 'created' && isViewNarrowed && (
              <Button variant="outline" size="sm" onClick={showNewestTasks}>
                Show newest tasks
              </Button>
            )}
            <Button variant="ghost" size="sm" onClick={() => setNotice(null)}>
              Dismiss
            </Button>
          </AlertDescription>
        </Alert>
      )}

      <CreateTaskDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreated={(task) => {
          setNotice({ kind: 'created', title: task.title })
          setCreateOpen(false)
        }}
      />

      <EditTaskDialog
        task={editingTask}
        statusOnly={editingAsAssigneeOnly}
        onClose={() => setEditingTask(null)}
        onUpdated={(task) => {
          setNotice({ kind: 'updated', title: task.title })
          setEditingTask(null)
        }}
      />

      <DeleteTaskDialog task={deletingTask} onClose={() => setDeletingTask(null)} onDeleted={handleDeleted} />

      <TaskFilters filters={filters} onChange={changeFilters} onClear={clearFilters} hideStatus={isBoard} />

      {isBoard && (
        <TaskBoard
          filters={{ priority: filters.priority, scope: filters.scope }}
          hasFilters={Boolean(filters.priority || filters.scope)}
          onClearFilters={clearFilters}
        />
      )}

      {!isBoard && (
      <section aria-label="Task list" aria-busy={isFetching} className="flex flex-col gap-4">
        {isPending && <TaskListSkeleton />}

        {isError && (
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
        )}

        {data && data.tasks.length === 0 && filters.page === 1 && <TaskEmptyState filtered={hasFilters} onClear={clearFilters} />}

        {data && data.tasks.length > 0 && (
          <>
            <ul className={isPlaceholderData ? 'flex flex-col gap-3 opacity-60' : 'flex flex-col gap-3'}>
              {data.tasks.map((task) => (
                <li key={task.id}>
                  <TaskCard task={task} {...actionsFor(task)} />
                </li>
              ))}
            </ul>
            <TaskPagination pagination={data.pagination} onPageChange={changePage} disabled={isPlaceholderData} />
          </>
        )}
      </section>
      )}
    </div>
  )
}
