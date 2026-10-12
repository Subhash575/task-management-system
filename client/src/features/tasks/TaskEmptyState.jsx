import { ClipboardList } from 'lucide-react'
import { Button } from '@/components/ui/button'

/** Shown by both the list and the board when the API returns no tasks. */
export function TaskEmptyState({ filtered, onClear }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed px-4 py-12 text-center">
      <ClipboardList className="size-8 text-muted-foreground" aria-hidden="true" />
      <h2 className="text-lg font-semibold">{filtered ? 'No tasks match these filters' : 'No tasks yet'}</h2>
      <p className="max-w-sm text-sm text-muted-foreground">
        {filtered
          ? 'Try changing or clearing the filters to see more tasks.'
          : 'Tasks you create or that are assigned to you will show up here.'}
      </p>
      {filtered && (
        <Button variant="outline" size="sm" onClick={onClear}>
          Clear filters
        </Button>
      )}
    </div>
  )
}
