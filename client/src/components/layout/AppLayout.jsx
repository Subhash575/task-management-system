import { Link, Outlet } from 'react-router'
import { KanbanSquare, Loader2, LogOut } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useLogout, useSession } from '@/features/auth/auth'

function UserMenu() {
  const { data: user } = useSession()
  const logout = useLogout()

  if (!user) return null

  return (
    <div className="ml-auto flex items-center gap-2 sm:gap-3">
      {logout.isError && (
        <span role="alert" className="text-sm text-destructive">
          Could not sign out. Try again.
        </span>
      )}
      <span className="hidden max-w-40 truncate text-sm text-muted-foreground sm:inline">{user.name}</span>
      <Button variant="outline" size="sm" onClick={() => logout.mutate()} disabled={logout.isPending}>
        {logout.isPending ? <Loader2 className="animate-spin" aria-hidden="true" /> : <LogOut aria-hidden="true" />}
        Sign out
      </Button>
    </div>
  )
}

export function AppLayout() {
  return (
    <div className="flex min-h-svh flex-col">
      {/* Lets keyboard and screen-reader users jump past the header. */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:rounded-md focus:bg-primary focus:px-3 focus:py-2 focus:text-primary-foreground"
      >
        Skip to main content
      </a>

      <header className="border-b bg-background">
        <div className="mx-auto flex h-14 w-full max-w-6xl items-center px-4 sm:px-6">
          <Link
            to="/"
            className="flex items-center gap-2 rounded-md font-semibold focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
          >
            <KanbanSquare className="size-5" aria-hidden="true" />
            <span>TaskFlow</span>
          </Link>
          <UserMenu />
        </div>
      </header>

      <main id="main-content" tabIndex={-1} className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-6">
        <Outlet />
      </main>
    </div>
  )
}
