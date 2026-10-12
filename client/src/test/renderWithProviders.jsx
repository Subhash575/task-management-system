import { render } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { vi } from 'vitest'
import { routes } from '@/app/router'

/** Renders the real app routes at `path` with a fresh, retry-free QueryClient. */
export function renderRoute(path = '/') {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  const router = createMemoryRouter(routes, { initialEntries: [path] })

  return render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  )
}

/** Builds a minimal fetch Response for stubbing `global.fetch`. */
export function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

export const testUser = { id: 'u1', name: 'Ada Lovelace', email: 'ada@example.com' }

/**
 * Stubs `global.fetch` with one handler per "METHOD /path" (path without the /api prefix).
 * A handler returns a Response (or throws to simulate a network failure). Unknown routes fail loudly.
 * Returns the fetch mock so tests can assert on calls.
 */
export function stubApi(handlers) {
  const fetchMock = vi.fn(async (url, options = {}) => {
    const key = `${options.method ?? 'GET'} ${String(url).replace(/^\/api/, '')}`
    const handler = handlers[key]
    if (!handler) throw new Error(`Unexpected request: ${key}`)
    return handler(options)
  })
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}
