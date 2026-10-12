import { AlertCircle, CheckCircle2, ChevronRight, CircleDashed, Eye, Layers, Lightbulb, ListChecks, Loader, RefreshCw } from 'lucide-react'
import { Link } from 'react-router'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { useTaskStats } from '@/features/tasks/stats'
import { TASK_STATUSES } from '@/features/tasks/tasks'

const plural = (count) => `${count} ${count === 1 ? 'task' : 'tasks'}`

// Icon chip colours match the status badges used on the list, board and detail pages.
const STATUS_ICONS = {
  Idea: { icon: Lightbulb, chip: 'bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-300' },
  'To Do': { icon: CircleDashed, chip: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300' },
  'In Progress': { icon: Loader, chip: 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300' },
  'In Review': { icon: Eye, chip: 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300' },
  Completed: { icon: CheckCircle2, chip: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300' },
}
const TOTAL_ICON = {
  icon: Layers,
  chip: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300',
}

const GRID = 'grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3'
const CARD = 'rounded-xl border bg-card p-5 shadow-sm'

function IconChip({ icon: Icon, chip }) {
  return (
    <span className={`flex size-9 items-center justify-center rounded-lg ${chip}`}>
      <Icon className="size-[18px]" aria-hidden="true" />
    </span>
  )
}

/** One clickable statistic. Same size for every card; `featured` only adds a restrained indigo emphasis. */
function StatCard({ to, label, count, ariaLabel, icon, featured = false }) {
  return (
    <Link
      to={to}
      aria-label={ariaLabel}
      className={`group flex min-h-32 flex-col justify-between gap-4 ${CARD} transition-[border-color,box-shadow] outline-none hover:shadow-md focus-visible:ring-[3px] focus-visible:ring-indigo-500/50 motion-reduce:transition-none ${
        featured
          ? 'border-indigo-200 ring-1 ring-indigo-100 hover:border-indigo-300 dark:border-indigo-900 dark:ring-indigo-950'
          : 'hover:border-slate-300 dark:hover:border-slate-600'
      }`}
    >
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm font-medium text-slate-600 dark:text-slate-300">{label}</span>
        <IconChip {...icon} />
      </div>
      <div className="flex items-end justify-between gap-3">
        <span
          className={`leading-none font-semibold tabular-nums text-slate-900 dark:text-foreground ${
            featured ? 'text-4xl' : 'text-3xl'
          }`}
        >
          {count}
        </span>
        <ChevronRight
          className="size-4 text-slate-400 transition-transform group-hover:translate-x-0.5 motion-reduce:transition-none"
          aria-hidden="true"
        />
      </div>
    </Link>
  )
}

// Same structure and height as a real card, so nothing jumps when the numbers arrive.
function StatsSkeleton() {
  return (
    <div role="status" aria-label="Loading statistics" className={GRID}>
      {Array.from({ length: 6 }, (_, index) => (
        <div key={index} className={`flex min-h-32 flex-col justify-between gap-4 ${CARD}`}>
          <div className="flex items-center justify-between">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="size-9 rounded-lg" />
          </div>
          <Skeleton className="h-8 w-16" />
        </div>
      ))}
    </div>
  )
}

function Message({ icon: Icon, chip, title, children, action }) {
  return (
    <div className={`flex flex-col items-center gap-3 px-6 py-12 text-center ${CARD}`}>
      <span className={`flex size-12 items-center justify-center rounded-full ${chip}`}>
        <Icon className="size-6" aria-hidden="true" />
      </span>
      <h2 className="text-lg font-semibold">{title}</h2>
      <div className="max-w-sm text-sm text-slate-600 dark:text-slate-300">{children}</div>
      {action}
    </div>
  )
}

const ViewTasksLink = ({ ariaLabel }) => (
  <Button asChild className="bg-indigo-600 text-white hover:bg-indigo-700 focus-visible:ring-indigo-500/50">
    <Link to="/" aria-label={ariaLabel}>
      <ListChecks aria-hidden="true" />
      View Tasks
    </Link>
  </Button>
)

export function DashboardPage() {
  const { data: stats, isPending, isError, isFetching, refetch } = useTaskStats()

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900 dark:text-foreground">Dashboard</h1>
          <p className="text-sm text-slate-600 dark:text-slate-300">Track your tasks and project progress.</p>
        </div>
        <div className="shrink-0">
          <ViewTasksLink ariaLabel="View all tasks" />
        </div>
      </header>

      {isPending && <StatsSkeleton />}

      {isError && (
        <Message
          icon={AlertCircle}
          chip="bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300"
          title="Couldn't load statistics"
          action={
            <Button variant="outline" onClick={() => refetch()} disabled={isFetching}>
              <RefreshCw className={isFetching ? 'animate-spin' : undefined} aria-hidden="true" />
              Retry
            </Button>
          }
        >
          <p role="alert">Could not load statistics. Check your connection and try again.</p>
        </Message>
      )}

      {stats && stats.total === 0 && (
        <Message
          icon={ListChecks}
          chip="bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300"
          title="No tasks yet"
          action={<ViewTasksLink />}
        >
          <p>Statistics appear here once you create a task or one is assigned to you.</p>
        </Message>
      )}

      {stats && stats.total > 0 && (
        <ul aria-label="Task statistics" className={GRID}>
          <li>
            <StatCard
              to="/"
              label="Total Tasks"
              count={stats.total}
              icon={TOTAL_ICON}
              featured
              ariaLabel={`All tasks: ${plural(stats.total)}. View all tasks`}
            />
          </li>
          {TASK_STATUSES.map((status) => (
            <li key={status}>
              <StatCard
                to={`/?status=${encodeURIComponent(status)}`}
                label={status}
                count={stats.byStatus[status]}
                icon={STATUS_ICONS[status]}
                ariaLabel={`${status}: ${plural(stats.byStatus[status])}. View ${status} tasks`}
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
