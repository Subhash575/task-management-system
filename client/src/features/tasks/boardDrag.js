import { TASK_STATUSES } from './tasks'

/**
 * Turns a finished drag into a move: `{ task, status }`, or null when nothing should change
 * (dropped outside a column, on the same column, or the task is unknown).
 */
export function statusFromDragEnd({ active, over }, tasks) {
  if (!over || !TASK_STATUSES.includes(over.id)) return null
  const task = tasks.find((candidate) => candidate.id === active.id)
  if (!task || task.status === over.id) return null
  return { task, status: over.id }
}
