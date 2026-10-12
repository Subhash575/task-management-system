import { QueryClient } from '@tanstack/react-query'

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000, // treat data as fresh for 30s to avoid refetching on every mount
      refetchOnWindowFocus: false,
      // Retry once for network/server errors, but never for client errors like 401/403/404.
      retry: (failureCount, error) => {
        if (error?.status && error.status < 500) return false
        return failureCount < 1
      },
    },
  },
})
