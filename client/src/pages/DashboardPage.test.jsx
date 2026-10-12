import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { jsonResponse, renderRoute, stubApi, testUser } from '@/test/renderWithProviders'

const signedIn = () => jsonResponse({ user: testUser })
const byStatus = (overrides = {}) => ({ Idea: 0, 'To Do': 0, 'In Progress': 0, 'In Review': 0, Completed: 0, ...overrides })
const statsResponse = (counts) => {
  const status = byStatus(counts)
  return jsonResponse({ stats: { total: Object.values(status).reduce((a, b) => a + b, 0), byStatus: status } })
}
const emptyList = () => jsonResponse({ tasks: [], pagination: { page: 1, limit: 10, total: 0, totalPages: 0 } })

describe('dashboard', () => {
  it('shows a loading state, then the total and a count for each of the five statuses', async () => {
    const fetchMock = stubApi({
      'GET /auth/me': signedIn,
      'GET /tasks/stats': () => statsResponse({ Idea: 1, 'To Do': 2, 'In Progress': 3, 'In Review': 4, Completed: 5 }),
    })
    renderRoute('/dashboard')

    expect(await screen.findByRole('status', { name: 'Loading statistics' })).toBeInTheDocument()
    const list = await screen.findByRole('list', { name: 'Task statistics' })
    const cards = within(list).getAllByRole('link')

    expect(cards.map((card) => card.getAttribute('aria-label'))).toEqual([
      'All tasks: 15 tasks. View all tasks',
      'Idea: 1 task. View Idea tasks',
      'To Do: 2 tasks. View To Do tasks',
      'In Progress: 3 tasks. View In Progress tasks',
      'In Review: 4 tasks. View In Review tasks',
      'Completed: 5 tasks. View Completed tasks',
    ])
    expect(within(cards[0]).getByText('15')).toBeInTheDocument()
    expect(within(cards[3]).getByText('3')).toBeInTheDocument()
    expect(fetchMock).toHaveBeenCalledWith('/api/tasks/stats', expect.objectContaining({ credentials: 'include' }))
  })

  it('shows zero counts for statuses without tasks', async () => {
    stubApi({ 'GET /auth/me': signedIn, 'GET /tasks/stats': () => statsResponse({ 'To Do': 2 }) })
    renderRoute('/dashboard')

    const card = await screen.findByRole('link', { name: /^Completed: 0 tasks/ })
    expect(within(card).getByText('0')).toBeInTheDocument()
  })

  it('shows an empty state when the user has no tasks', async () => {
    stubApi({ 'GET /auth/me': signedIn, 'GET /tasks/stats': () => statsResponse({}) })
    renderRoute('/dashboard')

    expect(await screen.findByRole('heading', { name: 'No tasks yet' })).toBeInTheDocument()
    expect(screen.queryByRole('list', { name: 'Task statistics' })).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Go to tasks' })).toHaveAttribute('href', '/')
  })

  it.each([
    ['a server error', () => jsonResponse({ error: { message: 'Internal server error' } }, 500)],
    [
      'a network failure',
      () => {
        throw new TypeError('Failed to fetch')
      },
    ],
  ])('shows an error with retry after %s', async (_name, fail) => {
    let calls = 0
    stubApi({
      'GET /auth/me': signedIn,
      'GET /tasks/stats': () => {
        calls += 1
        return calls === 1 ? fail() : statsResponse({ Idea: 4 })
      },
    })
    const user = userEvent.setup()
    renderRoute('/dashboard')

    expect(await screen.findByRole('alert')).toHaveTextContent('Could not load statistics')
    await user.click(screen.getByRole('button', { name: /try again/i }))

    expect(await screen.findByRole('link', { name: /^Idea: 4 tasks/ })).toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('redirects a signed-out visitor to the login page', async () => {
    stubApi({ 'GET /auth/me': () => jsonResponse({ error: { message: 'Authentication required' } }, 401) })
    renderRoute('/dashboard')

    expect(await screen.findByRole('heading', { name: 'Sign in' })).toBeInTheDocument()
  })
})

describe('dashboard navigation', () => {
  it('opens the task list filtered by the chosen status', async () => {
    const fetchMock = stubApi({
      'GET /auth/me': signedIn,
      'GET /tasks/stats': () => statsResponse({ 'In Review': 2 }),
      'GET /tasks': emptyList,
    })
    const user = userEvent.setup()
    renderRoute('/dashboard')

    await user.click(await screen.findByRole('link', { name: /^In Review: 2 tasks/ }))

    expect(await screen.findByRole('heading', { level: 1, name: 'Tasks' })).toBeInTheDocument()
    expect(screen.getByLabelText('Status')).toHaveValue('In Review')
    const listCalls = fetchMock.mock.calls.map(([url]) => String(url)).filter((url) => url.startsWith('/api/tasks?'))
    expect(new URL(listCalls.at(-1), 'http://localhost').searchParams.get('status')).toBe('In Review')
  })

  it('the total card opens the unfiltered list', async () => {
    stubApi({
      'GET /auth/me': signedIn,
      'GET /tasks/stats': () => statsResponse({ Idea: 1 }),
      'GET /tasks': emptyList,
    })
    const user = userEvent.setup()
    renderRoute('/dashboard')

    await user.click(await screen.findByRole('link', { name: /^All tasks: 1 task/ }))

    expect(await screen.findByLabelText('Status')).toHaveValue('')
  })

  it('ignores an unknown status in the URL', async () => {
    const fetchMock = stubApi({ 'GET /auth/me': signedIn, 'GET /tasks': emptyList })
    renderRoute('/?status=Bogus')

    expect(await screen.findByLabelText('Status')).toHaveValue('')
    const listCalls = fetchMock.mock.calls.map(([url]) => String(url)).filter((url) => url.startsWith('/api/tasks?'))
    expect(listCalls.at(-1)).toBe('/api/tasks?page=1&limit=10')
  })

  it('has a Dashboard link in the main navigation while the other pages keep working', async () => {
    stubApi({
      'GET /auth/me': signedIn,
      'GET /tasks/stats': () => statsResponse({ Idea: 1 }),
      'GET /tasks': emptyList,
    })
    const user = userEvent.setup()
    renderRoute('/')

    const nav = within(await screen.findByRole('navigation', { name: 'Main' }))
    await user.click(nav.getByRole('link', { name: 'Dashboard' }))
    expect(await screen.findByRole('heading', { level: 1, name: 'Dashboard' })).toBeInTheDocument()
    expect(nav.getByRole('link', { name: 'Dashboard' })).toHaveAttribute('aria-current', 'page')

    await user.click(nav.getByRole('link', { name: 'Tasks' }))
    expect(await screen.findByRole('heading', { level: 1, name: 'Tasks' })).toBeInTheDocument()
    // The list/board switch is still there.
    expect(screen.getByRole('link', { name: 'Board' })).toBeInTheDocument()
  })

  it('does not show the main navigation on the login page', async () => {
    stubApi({ 'GET /auth/me': () => jsonResponse({ error: { message: 'Authentication required' } }, 401) })
    renderRoute('/login')

    await screen.findByRole('heading', { name: 'Sign in' })
    expect(screen.queryByRole('navigation', { name: 'Main' })).not.toBeInTheDocument()
  })
})
