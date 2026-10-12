import { AlertCircle, ArrowLeft, FileQuestion, Lock, RefreshCw } from 'lucide-react'
import { Link, useLocation, useParams } from 'react-router'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { PriorityBadge, StatusBadge } from '@/features/tasks/TaskBadges'
import { dateTimeFormat } from '@/features/tasks/dateFormat'
import { TaskAttachments } from '@/features/tasks/TaskAttachments'
import { TaskStatusHistory } from '@/features/tasks/TaskStatusHistory'
import { useSession } from '@/features/auth/auth'
import { useTask } from '@/features/tasks/tasks'

// Date-only due dates are stored as midnight UTC, so format in UTC (same as the list and board).
const dateFormat = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeZone: 'UTC' })

function DetailSkeleton() {
  return (
    <div role="status" aria-label="Loading task" className="flex flex-col gap-4">
      <Skeleton className="h-8 w-2/3" />
      <Skeleton className="h-40 w-full" />
      <Skeleton className="h-32 w-full" />
    </div>
  )
}

function Message({ icon: Icon, title, children }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed px-4 py-12 text-center">
      <Icon className="size-8 text-muted-foreground" aria-hidden="true" />
      <h1 className="text-xl font-semibold">{title}</h1>
      <p className="max-w-sm text-sm text-muted-foreground">{children}</p>
    </div>
  )
}

function Detail({ label, children }) {
  return (
    <div className="flex flex-col gap-1">
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className="text-sm break-words">{children}</dd>
    </div>
  )
}

export function TaskDetailPage() {
  const { id } = useParams()
  const location = useLocation()
  const { data: currentUser } = useSession()
  const { data: task, isPending, isError, error, isFetching, refetch } = useTask(id)

  // Cards link here with the page they came from (list, board, or filtered views).
  const backTo = location.state?.from ?? '/'
  const backLink = (
    <Button asChild variant="ghost" size="sm" className="w-fit">
      <Link to={backTo}>
        <ArrowLeft aria-hidden="true" />
        Back to tasks
      </Link>
    </Button>
  )

  let body
  if (isPending) {
    body = <DetailSkeleton />
  } else if (isError && (error.status === 404 || error.status === 400)) {
    // The API answers 404 for missing tasks and for tasks you may not see; a malformed id is a 400.
    body = (
      <Message icon={FileQuestion} title="Task not found">
        It may have been deleted, or you may not have access to it.
      </Message>
    )
  } else if (isError && error.status === 403) {
    body = (
      <Message icon={Lock} title="You can't view this task">
        You don't have permission to see this task.
      </Message>
    )
  } else if (isError) {
    body = (
      <div className="flex flex-col items-start gap-3">
        <p role="alert" className="flex items-center gap-2 text-destructive">
          <AlertCircle className="size-4 shrink-0" aria-hidden="true" />
          Could not load this task. Check your connection and try again.
        </p>
        <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>
          <RefreshCw className={isFetching ? 'animate-spin' : undefined} aria-hidden="true" />
          Try again
        </Button>
      </div>
    )
  } else {
    body = (
      <article className="flex flex-col gap-6">
        <header className="flex flex-col gap-3">
          <h1 className="text-2xl font-bold tracking-tight break-words sm:text-3xl">{task.title}</h1>
          <div className="flex flex-wrap gap-2">
            <StatusBadge status={task.status} />
            <PriorityBadge priority={task.priority} />
          </div>
        </header>

        <Card>
          <CardHeader>
            <h2 className="leading-none font-semibold">Details</h2>
          </CardHeader>
          <CardContent className="flex flex-col gap-5">
            <div>
              <h3 className="mb-1 text-sm text-muted-foreground">Description</h3>
              {task.description ? (
                <p className="text-sm break-words whitespace-pre-wrap">{task.description}</p>
              ) : (
                <p className="text-sm text-muted-foreground">No description.</p>
              )}
            </div>

            <dl className="grid gap-4 sm:grid-cols-2">
              <Detail label="Creator">{task.creator?.name ?? 'Unknown'}</Detail>
              <Detail label="Assignee">{task.assignee?.name ?? 'Unassigned'}</Detail>
              <Detail label="Due date">
                {task.dueDate ? (
                  <time dateTime={task.dueDate}>{dateFormat.format(new Date(task.dueDate))}</time>
                ) : (
                  'No due date'
                )}
              </Detail>
              <Detail label="Labels">
                {task.labels.length > 0 ? (
                  <ul aria-label="Labels" className="flex flex-wrap gap-1.5">
                    {task.labels.map((label) => (
                      <li key={label}>
                        <Badge variant="outline">{label}</Badge>
                      </li>
                    ))}
                  </ul>
                ) : (
                  'No labels'
                )}
              </Detail>
              <Detail label="Created">
                <time dateTime={task.createdAt}>{dateTimeFormat.format(new Date(task.createdAt))}</time>
              </Detail>
              <Detail label="Last updated">
                <time dateTime={task.updatedAt}>{dateTimeFormat.format(new Date(task.updatedAt))}</time>
              </Detail>
            </dl>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <h2 className="leading-none font-semibold">Attachments</h2>
          </CardHeader>
          <CardContent>
            <TaskAttachments task={task} currentUserId={currentUser?.id} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <h2 className="leading-none font-semibold">Status history</h2>
          </CardHeader>
          <CardContent>
            <TaskStatusHistory history={task.statusHistory ?? []} />
          </CardContent>
        </Card>
      </article>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      {backLink}
      {body}
    </div>
  )
}
