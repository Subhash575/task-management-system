import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { apiRequest } from '@/lib/api'

export const sessionQueryKey = ['auth', 'me']

/**
 * The current user, restored from the HTTP-only cookie via GET /auth/me.
 * `data` is the user, `null` when signed out (a 401 is a normal answer, not an error),
 * and a real error is only raised for network/server failures.
 */
export function useSession() {
  return useQuery({
    queryKey: sessionQueryKey,
    queryFn: async ({ signal }) => {
      try {
        const { user } = await apiRequest('/auth/me', { signal })
        return user
      } catch (error) {
        if (error.status === 401) return null
        throw error
      }
    },
    staleTime: Infinity, // the session only changes through login/register/logout below
  })
}

function useSignInMutation(path) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (body) => apiRequest(path, { method: 'POST', body }),
    onSuccess: ({ user }) => queryClient.setQueryData(sessionQueryKey, user),
  })
}

export const useLogin = () => useSignInMutation('/auth/login')
export const useRegister = () => useSignInMutation('/auth/register')

export function useLogout() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: () => apiRequest('/auth/logout', { method: 'POST' }),
    onSuccess: () => {
      // Drop everything cached for the old user, then mark the session as signed out.
      queryClient.removeQueries({ predicate: (query) => query.queryKey[0] !== 'auth' })
      queryClient.setQueryData(sessionQueryKey, null)
    },
  })
}

/** Only allow same-site paths so a crafted `from` can never redirect users to another website. */
export function safeRedirectPath(path) {
  return typeof path === 'string' && path.startsWith('/') && !path.startsWith('//') ? path : '/'
}
