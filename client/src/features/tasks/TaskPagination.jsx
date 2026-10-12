import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'

export function TaskPagination({ pagination, onPageChange, disabled }) {
  const { page, totalPages, total } = pagination
  const lastPage = Math.max(totalPages, 1)

  return (
    <nav
      aria-label="Pagination"
      className="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-card px-4 py-3 shadow-xs"
    >
      <p className="text-sm text-slate-600 dark:text-slate-300" aria-live="polite">
        Page {page} of {lastPage} · {total} {total === 1 ? 'task' : 'tasks'}
      </p>
      <div className="flex gap-2">
        {/* Disabled buttons are dimmed and show a "not allowed" cursor, so the end of the list is obvious. */}
        <Button
          variant="outline"
          size="sm"
          onClick={() => onPageChange(page - 1)}
          disabled={disabled || page <= 1}
          className="disabled:pointer-events-auto disabled:cursor-not-allowed disabled:opacity-40"
        >
          <ChevronLeft aria-hidden="true" />
          Previous
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => onPageChange(page + 1)}
          disabled={disabled || page >= lastPage}
          className="disabled:pointer-events-auto disabled:cursor-not-allowed disabled:opacity-40"
        >
          Next
          <ChevronRight aria-hidden="true" />
        </Button>
      </div>
    </nav>
  )
}
