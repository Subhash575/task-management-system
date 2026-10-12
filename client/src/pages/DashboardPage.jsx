import { AlertCircle, ClipboardList, RefreshCw } from 'lucide-react'
import { Link } from 'react-router'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { StatusBadge } from '@/features/tasks/TaskBadges'
import { useTaskStats } from '@/features/tasks/stats'
import { TASK_STATUSES } from '@/features/tasks/tasks'

const plural = (count) => `${count} ${count === 1 ? 'task' : 'tasks'}`

const cardLink =
  'block rounded-xl focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none'

function StatsSkeleton() {
  return (
    <div role="status" aria-label="Loading statistics" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: 6 }, (_, index) => (
        <div key={index} className="flex flex-col gap-3 rounded-xl border p-6">
          <Skeleton className="h-5 w-1/2" />
          <Skeleton className="h-9 w-1/3" />
        </div>
      ))}
    </div>
  )
}

export function DashboardPage() {
  const { data: stats, isPending, isError, isFetching, refetch } = useTaskStats()

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Dashboard</h1>
        <p className="text-muted-foreground">An overview of the tasks you created or that are assigned to you.</p>
      </div>

      {isPending && <StatsSkeleton />}

      {isError && (
        <div className="flex flex-col items-start gap-3">
          <p role="alert" className="flex items-center gap-2 text-destructive">
            <AlertCircle className="size-4 shrink-0" aria-hidden="true" />
            Could not load statistics. Check your connection and try again.
          </p>
          <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>
            <RefreshCw className={isFetching ? 'animate-spin' : undefined} aria-hidden="true" />
            Try again
          </Button>
        </div>
      )}

      {stats && stats.total === 0 && (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed px-4 py-12 text-center">
          <ClipboardList className="size-8 text-muted-foreground" aria-hidden="true" />
          <h2 className="text-lg font-semibold">No tasks yet</h2>
          <p className="max-w-sm text-sm text-muted-foreground">
            Statistics appear here once you create a task or one is assigned to you.
          </p>
          <Button asChild>
            <Link to="/">Go to tasks</Link>
          </Button>
        </div>
      )}

      {stats && stats.total > 0 && (
        <ul aria-label="Task statistics" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <li className="sm:col-span-2 lg:col-span-3">
            <Link to="/" className={cardLink} aria-label={`All tasks: ${plural(stats.total)}. View all tasks`}>
              <Card className="transition-colors hover:bg-accent/40">
                <CardContent className="flex items-baseline justify-between gap-4">
                  <span className="font-medium">Total tasks</span>
                  <span className="text-4xl font-bold tabular-nums">{stats.total}</span>
                </CardContent>
              </Card>
            </Link>
          </li>
          {TASK_STATUSES.map((status) => (
            <li key={status}>
              <Link
                to={`/?status=${encodeURIComponent(status)}`}
                className={cardLink}
                aria-label={`${status}: ${plural(stats.byStatus[status])}. View ${status} tasks`}
              >
                <Card className="h-full transition-colors hover:bg-accent/40">
                  <CardContent className="flex flex-col gap-3">
                    <StatusBadge status={status} />
                    <span className="text-3xl font-bold tabular-nums">{stats.byStatus[status]}</span>
                  </CardContent>
                </Card>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
