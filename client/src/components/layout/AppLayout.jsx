import { Link, NavLink, Outlet, useLocation, useMatch } from 'react-router'
import { KanbanSquare, Loader2, LogOut } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useLogout, useSession } from '@/features/auth/auth'

// Tasks stays highlighted on its sibling pages: the board and any task detail page.
const TASK_AREA = /^\/(board|tasks\/.+)?$/

function MainNav() {
  const { data: user } = useSession()
  const { pathname } = useLocation()
  if (!user) return null

  const linkClass = (active) =>
    `rounded-md px-2.5 py-1.5 text-sm font-medium outline-none transition-colors focus-visible:ring-[3px] focus-visible:ring-indigo-500/50 motion-reduce:transition-none ${
      active
        ? 'bg-slate-100 text-slate-900 dark:bg-accent dark:text-accent-foreground'
        : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-accent/50'
    }`
  const onTasks = TASK_AREA.test(pathname)

  return (
    <nav aria-label="Main" className="ml-3 flex items-center gap-0.5 sm:ml-6">
      <NavLink to="/dashboard" className={({ isActive }) => linkClass(isActive)}>
        Dashboard
      </NavLink>
      {/* A plain Link, since NavLink only knows its own path and would drop the highlight on /board and /tasks/:id. */}
      <Link to="/" aria-current={onTasks ? 'page' : undefined} className={linkClass(onTasks)}>
        Tasks
      </Link>
    </nav>
  )
}

/** Initials from the display name, e.g. "Ada Lovelace" -> "AL". Uses only the name already in the session. */
function initials(name) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0].toUpperCase())
    .join('')
}

function UserMenu() {
  const { data: user } = useSession()
  const logout = useLogout()

  if (!user) return null

  return (
    <div className="ml-auto flex items-center gap-2 sm:gap-3">
      {logout.isError && (
        <span role="alert" className="text-xs text-destructive sm:text-sm">
          Could not sign out. Try again.
        </span>
      )}
      <span className="flex items-center gap-2">
        <span
          aria-hidden="true"
          className="flex size-7 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-xs font-semibold text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300"
        >
          {initials(user.name)}
        </span>
        <span className="hidden max-w-40 truncate text-sm font-medium text-slate-700 sm:inline dark:text-slate-200">
          {user.name}
        </span>
      </span>
      <Button
        variant="outline"
        size="sm"
        onClick={() => logout.mutate()}
        disabled={logout.isPending}
        className="text-slate-700 hover:bg-slate-50 hover:text-slate-900 focus-visible:ring-indigo-500/50"
      >
        {logout.isPending ? <Loader2 className="animate-spin" aria-hidden="true" /> : <LogOut aria-hidden="true" />}
        {/* Icon-only on very narrow screens so the bar never wraps; the name stays for screen readers. */}
        <span className="max-sm:sr-only">Sign out</span>
      </Button>
    </div>
  )
}

export function AppLayout() {
  // The dashboard sits on a subtle neutral background so its white cards stand out.
  const onDashboard = Boolean(useMatch('/dashboard'))

  return (
    <div className={`flex min-h-svh flex-col ${onDashboard ? 'bg-slate-50 dark:bg-background' : ''}`}>
      {/* Lets keyboard and screen-reader users jump past the header. */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:rounded-md focus:bg-primary focus:px-3 focus:py-2 focus:text-primary-foreground"
      >
        Skip to main content
      </a>

      <header className="sticky top-0 z-40 border-b bg-background">
        <div className="mx-auto flex h-14 w-full max-w-6xl items-center px-4 sm:px-6">
          <Link
            to="/"
            className="flex items-center gap-2 rounded-md font-semibold tracking-tight text-slate-900 outline-none focus-visible:ring-[3px] focus-visible:ring-indigo-500/50 dark:text-foreground"
          >
            <span className="flex size-7 items-center justify-center rounded-lg bg-indigo-600 text-white">
              <KanbanSquare className="size-4" aria-hidden="true" />
            </span>
            <span className="max-[380px]:sr-only">TaskFlow</span>
          </Link>
          <MainNav />
          <UserMenu />
        </div>
      </header>

      <main id="main-content" tabIndex={-1} className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-6">
        <Outlet />
      </main>
    </div>
  )
}
