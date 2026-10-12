import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
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
export function useTasks(filters, { enabled = true } = {}) {
  return useQuery({
    queryKey: taskKeys.list(filters),
    queryFn: ({ signal }) => fetchTasks(filters, signal),
    placeholderData: keepPreviousData,
    enabled,
  })
}

export function createTask(body) {
  return apiRequest('/tasks', { method: 'POST', body })
}

/** Creates a task, then refreshes every cached task list so the new task shows up. */
export function useCreateTask() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: createTask,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: taskKeys.all }),
  })
}

export function updateTask({ id, changes }) {
  return apiRequest(`/tasks/${id}`, { method: 'PATCH', body: changes })
}

export function deleteTask(id) {
  return apiRequest(`/tasks/${id}`, { method: 'DELETE' })
}

// onSettled (not onSuccess): after a failure such as 404 the list may be stale too, so refresh either way.

/** Updates a task, then refreshes every cached task list. */
export function useUpdateTask() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: updateTask,
    onSettled: () => queryClient.invalidateQueries({ queryKey: taskKeys.all }),
  })
}

/** Deletes a task, then refreshes every cached task list. */
export function useDeleteTask() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: deleteTask,
    onSettled: () => queryClient.invalidateQueries({ queryKey: taskKeys.all }),
  })
}

// ---- Kanban board ----

export const BOARD_PAGE_LIMIT = 100 // the API's maximum page size
export const BOARD_MAX_PAGES = 5 // so the board shows at most 500 tasks

// Nested under taskKeys.all, so creating, editing and deleting tasks refreshes the board too.
export const boardKeys = {
  list: (filters) => ['tasks', 'board', filters],
}

/** The board has no pagination, so it loads every page the API has (up to a cap). Only the API's visible tasks are returned. */
export async function fetchBoardTasks({ priority, scope }, signal) {
  const tasks = []
  let total = 0
  for (let page = 1; page <= BOARD_MAX_PAGES; page += 1) {
    const params = new URLSearchParams({ page: String(page), limit: String(BOARD_PAGE_LIMIT) })
    if (priority) params.set('priority', priority)
    if (scope) params.set('scope', scope)
    const data = await apiRequest(`/tasks?${params}`, { signal })
    tasks.push(...data.tasks)
    total = data.pagination.total
    if (page >= data.pagination.totalPages) return { tasks, total, truncated: false }
  }
  return { tasks, total, truncated: true }
}

/** Returns `{ tasks, total, truncated }` for the board. `filters` is `{ priority, scope }`. */
export function useBoardTasks(filters) {
  return useQuery({
    queryKey: boardKeys.list(filters),
    queryFn: ({ signal }) => fetchBoardTasks(filters, signal),
  })
}

/** Sets a task's status in every cached task list and board. With `onlyIfCurrently`, only when it still has that status. */
function setCachedStatus(queryClient, id, status, onlyIfCurrently) {
  queryClient.setQueriesData({ queryKey: taskKeys.all }, (old) => {
    if (!old?.tasks) return old
    return {
      ...old,
      tasks: old.tasks.map((task) =>
        task.id === id && (!onlyIfCurrently || task.status === onlyIfCurrently) ? { ...task, status } : task,
      ),
    }
  })
}

/**
 * Moves a task to another status (PATCH { status } only). Optimistic: the card moves at once, and if the server
 * rejects the change just that task is put back. The server's data replaces the cache when the request settles.
 * Variables: `{ id, status, previousStatus }`. Use `mutateAsync` so concurrent moves each get their own result.
 */
const moveMutationKey = ['tasks', 'move']

export function useMoveTask() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationKey: moveMutationKey,
    mutationFn: ({ id, status }) => apiRequest(`/tasks/${id}`, { method: 'PATCH', body: { status } }),
    onMutate: async ({ id, status }) => {
      // A refetch that started earlier could land after this and overwrite the optimistic change.
      await queryClient.cancelQueries({ queryKey: taskKeys.all })
      setCachedStatus(queryClient, id, status)
    },
    onError: (_error, { id, status, previousStatus }) => {
      // Only undo our own change, so another pending move of the same task is not clobbered.
      setCachedStatus(queryClient, id, previousStatus, status)
    },
    onSettled: () => {
      // While other moves are still in flight, a refetch would return their old status and undo their optimistic
      // change. The last move to finish refreshes everything (this one still counts as mutating here).
      if (queryClient.isMutating({ mutationKey: moveMutationKey }) <= 1) {
        return queryClient.invalidateQueries({ queryKey: taskKeys.all })
      }
    },
  })
}
