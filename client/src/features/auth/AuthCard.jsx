import { KanbanSquare } from 'lucide-react'

/** Shared shell for the login and register pages: brand, heading, subtitle, form, and a footer link. */
export function AuthCard({ title, description, footer, children }) {
  return (
    <div className="mx-auto flex w-full max-w-md flex-col items-center gap-6 py-4 sm:py-10">
      <div className="flex items-center gap-2 font-semibold tracking-tight text-slate-900 dark:text-foreground">
        <span className="flex size-8 items-center justify-center rounded-lg bg-indigo-600 text-white shadow-xs">
          <KanbanSquare className="size-4" aria-hidden="true" />
        </span>
        TaskFlow
      </div>
      <div className="w-full rounded-2xl border bg-card p-6 shadow-sm sm:p-8">
        <div className="mb-6 flex flex-col gap-1.5">
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900 dark:text-foreground">{title}</h1>
          <p className="text-sm text-slate-600 dark:text-slate-300">{description}</p>
        </div>
        {children}
      </div>
      <div className="text-sm text-slate-600 dark:text-slate-300">{footer}</div>
    </div>
  )
}

/** The styled link between login and register. */
export const authLinkClass =
  'rounded-sm font-medium text-indigo-700 underline-offset-4 outline-none hover:underline focus-visible:ring-[3px] focus-visible:ring-indigo-500/50 dark:text-indigo-300'

/** Primary full-width submit button styling, shared by both forms. */
export const authSubmitClass =
  'h-10 w-full bg-indigo-600 text-white shadow-xs hover:bg-indigo-700 focus-visible:ring-indigo-500/50'
