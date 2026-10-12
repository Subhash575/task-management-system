import { ClipboardList, Plus, SearchX } from 'lucide-react'
import { Button } from '@/components/ui/button'

/**
 * Shown by both the list and the board when the API returns no tasks.
 * `onCreate` (optional) adds a "Create your first task" action when there are no filters to blame.
 */
export function TaskEmptyState({ filtered, onClear, onCreate }) {
  const Icon = filtered ? SearchX : ClipboardList

  return (
    <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed bg-card px-6 py-14 text-center">
      <span className="flex size-12 items-center justify-center rounded-full bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300">
        <Icon className="size-6" aria-hidden="true" />
      </span>
      <h2 className="text-lg font-semibold">{filtered ? 'No tasks match these filters' : 'No tasks yet'}</h2>
      <p className="max-w-sm text-sm text-slate-600 dark:text-slate-300">
        {filtered
          ? 'Try changing or clearing the filters to see more tasks.'
          : 'Tasks you create or that are assigned to you will show up here.'}
      </p>
      {filtered && (
        <Button variant="outline" size="sm" onClick={onClear}>
          Clear filters
        </Button>
      )}
      {!filtered && onCreate && (
        <Button onClick={onCreate} className="bg-indigo-600 text-white hover:bg-indigo-700 focus-visible:ring-indigo-500/50">
          <Plus aria-hidden="true" />
          Create your first task
        </Button>
      )}
    </div>
  )
}
