import { useQuery } from '@tanstack/react-query'
import { AlertCircle, CheckCircle2, Loader2, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { apiRequest } from '@/lib/api'

function HealthStatus() {
  const { data, error, isPending, isError, refetch, isFetching } = useQuery({
    queryKey: ['health'],
    queryFn: ({ signal }) => apiRequest('/health', { signal }),
  })

  if (isPending) {
    return (
      <p role="status" className="flex items-center gap-2 text-muted-foreground">
        <Loader2 className="size-4 animate-spin" aria-hidden="true" />
        Checking API status…
      </p>
    )
  }

  if (isError) {
    // 503 means the API answered but its database is not connected.
    const message =
      error.status === 503
        ? 'The API is running, but the database is not connected.'
        : 'Could not reach the API. Make sure the server is running.'

    return (
      <div className="flex flex-col items-start gap-3">
        <p role="alert" className="flex items-center gap-2 text-destructive">
          <AlertCircle className="size-4 shrink-0" aria-hidden="true" />
          {message}
        </p>
        <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>
          <RefreshCw className={isFetching ? 'animate-spin' : undefined} aria-hidden="true" />
          Try again
        </Button>
      </div>
    )
  }

  return (
    <p className="flex items-center gap-2 text-emerald-700 dark:text-emerald-400">
      <CheckCircle2 className="size-4 shrink-0" aria-hidden="true" />
      API healthy · Database {data.db}
    </p>
  )
}

export function HomePage() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">TaskFlow</h1>
        <p className="text-muted-foreground">
          Plan, track, and ship work with your team. Features are coming soon.
        </p>
      </div>

      <Card className="max-w-md">
        <CardHeader>
          <CardTitle>System status</CardTitle>
          <CardDescription>Connection between this app, the API, and the database.</CardDescription>
        </CardHeader>
        <CardContent>
          <HealthStatus />
        </CardContent>
      </Card>
    </div>
  )
}
