import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { apiRequest } from '@/lib/api'

// Must match the server's allowed values (server/src/models/Task.js).
export const TASK_STATUSES = ['Idea', 'To Do', 'In Progress', 'In Review', 'Completed']
export const TASK_PRIORITIES = ['Low', 'Medium', 'High', 'Critical']
export const TASK_SCOPES = [
  { value: 'created', label: 'Created by me' },
  { value: 'assigned', label: 'Assigned to me' },
]

export const PAGE_SIZE = 10

/** Filter values are '' when "all"; `page` starts at 1. */
export const INITIAL_FILTERS = { status: '', priority: '', scope: '', page: 1 }

// Every list query is keyed by its filters and page, so each combination is cached separately.
// Future task mutations can invalidate everything with `taskKeys.all`.
export const taskKeys = {
  all: ['tasks'],
  list: (filters) => ['tasks', 'list', filters],
}

export function fetchTasks({ page, status, priority, scope }, signal) {
  const params = new URLSearchParams({ page: String(page), limit: String(PAGE_SIZE) })
  if (status) params.set('status', status)
  if (priority) params.set('priority', priority)
  if (scope) params.set('scope', scope)
  return apiRequest(`/tasks?${params}`, { signal })
}

/** Returns `{ tasks, pagination }`. The previous page stays on screen while the next one loads. */
export function useTasks(filters) {
  return useQuery({
    queryKey: taskKeys.list(filters),
    queryFn: ({ signal }) => fetchTasks(filters, signal),
    placeholderData: keepPreviousData,
  })
}
