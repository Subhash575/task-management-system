import { useState } from 'react'
import { AlertCircle, ClipboardList, Plus, RefreshCw } from 'lucide-react'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { TaskCard } from '@/features/tasks/TaskCard'
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

function EmptyState({ filtered, onClear }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed px-4 py-12 text-center">
      <ClipboardList className="size-8 text-muted-foreground" aria-hidden="true" />
      <h2 className="text-lg font-semibold">{filtered ? 'No tasks match these filters' : 'No tasks yet'}</h2>
      <p className="max-w-sm text-sm text-muted-foreground">
        {filtered
          ? 'Try changing or clearing the filters to see more tasks.'
          : 'Tasks you create or that are assigned to you will show up here.'}
      </p>
      {filtered && (
        <Button variant="outline" size="sm" onClick={onClear}>
          Clear filters
        </Button>
      )}
    </div>
  )
}

export function TasksPage() {
  const [filters, setFilters] = useState(INITIAL_FILTERS)
  const [showCreateNotice, setShowCreateNotice] = useState(false)
  const { data, isPending, isError, isFetching, isPlaceholderData, refetch } = useTasks(filters)

  // Changing a filter always returns to page 1, since the old page number may not exist any more.
  const changeFilters = (changes) => setFilters((current) => ({ ...current, ...changes, page: 1 }))
  const clearFilters = () => setFilters(INITIAL_FILTERS)
  const changePage = (page) => setFilters((current) => ({ ...current, page }))

  const hasFilters = Boolean(filters.status || filters.priority || filters.scope)

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Tasks</h1>
          <p className="text-muted-foreground">Tasks you created or that are assigned to you.</p>
        </div>
        {/* Integration point: the create-task form will replace this notice in the next milestone. */}
        <Button onClick={() => setShowCreateNotice(true)} aria-expanded={showCreateNotice}>
          <Plus aria-hidden="true" />
          Create Task
        </Button>
      </div>

      {showCreateNotice && (
        <Alert role="status">
          <AlertDescription>Creating tasks is coming in the next step. This button is a placeholder for now.</AlertDescription>
        </Alert>
      )}

      <TaskFilters filters={filters} onChange={changeFilters} onClear={clearFilters} />

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

        {data && data.tasks.length === 0 && <EmptyState filtered={hasFilters} onClear={clearFilters} />}

        {data && data.tasks.length > 0 && (
          <>
            <ul className={isPlaceholderData ? 'flex flex-col gap-3 opacity-60' : 'flex flex-col gap-3'}>
              {data.tasks.map((task) => (
                <li key={task.id}>
                  <TaskCard task={task} />
                </li>
              ))}
            </ul>
            <TaskPagination pagination={data.pagination} onPageChange={changePage} disabled={isPlaceholderData} />
          </>
        )}
      </section>
    </div>
  )
}
