import { useQuery } from '@tanstack/react-query'
import { apiRequest } from '@/lib/api'
import { taskKeys } from './tasks'

// Under taskKeys.all, so creating, moving, editing or deleting a task refreshes the dashboard numbers too.
export const statsKey = [...taskKeys.all, 'stats']

/** `{ total, byStatus: { Idea, 'To Do', ... } }` for the tasks the signed-in user can see. */
export function useTaskStats() {
  return useQuery({
    queryKey: statsKey,
    queryFn: async ({ signal }) => (await apiRequest('/tasks/stats', { signal })).stats,
  })
}
