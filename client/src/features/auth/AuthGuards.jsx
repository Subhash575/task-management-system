import { AlertCircle, Loader2, RefreshCw } from 'lucide-react'
import { Navigate, Outlet, useLocation } from 'react-router'
import { Button } from '@/components/ui/button'
import { safeRedirectPath, useSession } from './auth'

function SessionGate({ children }) {
  const { data: user, isPending, isError, refetch, isFetching } = useSession()

  if (isPending) {
    return (
      <p role="status" className="flex items-center justify-center gap-2 py-16 text-muted-foreground">
        <Loader2 className="size-4 animate-spin" aria-hidden="true" />
        Checking your session…
      </p>
    )
  }

  if (isError) {
    return (
      <div className="flex flex-col items-center gap-3 py-16 text-center">
        <p role="alert" className="flex items-center gap-2 text-destructive">
          <AlertCircle className="size-4 shrink-0" aria-hidden="true" />
          Could not check your session. Make sure the server is running.
        </p>
        <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>
          <RefreshCw className={isFetching ? 'animate-spin' : undefined} aria-hidden="true" />
          Try again
        </Button>
      </div>
    )
  }

  return children(user)
}

/** Routes that need a signed-in user. Others are sent to /login and returned here afterwards. */
export function ProtectedRoute() {
  const location = useLocation()
  return (
    <SessionGate>
      {(user) =>
        user ? (
          <Outlet />
        ) : (
          <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />
        )
      }
    </SessionGate>
  )
}

/** Login/register pages: signed-in users are sent on to where they were going (or home). */
export function GuestRoute() {
  const location = useLocation()
  return (
    <SessionGate>
      {(user) =>
        user ? <Navigate to={safeRedirectPath(location.state?.from)} replace /> : <Outlet />
      }
    </SessionGate>
  )
}
