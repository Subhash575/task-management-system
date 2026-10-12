import { useQuery } from '@tanstack/react-query'
import { apiRequest } from '@/lib/api'

export const userKeys = {
  all: ['users'],
  list: (search = '') => ['users', 'list', search],
}

/** Registered users for the assignee picker: `{ users: [{ id, name, email }] }` (the server returns up to 20 by default). */
export function useUsers(search = '') {
  return useQuery({
    queryKey: userKeys.list(search),
    queryFn: ({ signal }) => {
      const params = new URLSearchParams()
      if (search) params.set('search', search)
      const query = params.toString()
      return apiRequest(`/users${query ? `?${query}` : ''}`, { signal })
    },
    staleTime: 60_000, // the user list rarely changes, so reopening a dialog does not refetch every time
  })
}
