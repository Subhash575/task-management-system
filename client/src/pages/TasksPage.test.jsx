import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { jsonResponse, renderRoute, stubApi, testUser } from '@/test/renderWithProviders'

const signedIn = () => jsonResponse({ user: testUser })
const ada = { id: 'u1', name: 'Ada Lovelace', email: 'ada@example.com' }
const bob = { id: 'u2', name: 'Bob Builder', email: 'bob@example.com' }

function makeTask(overrides = {}) {
  return {
    id: 't1',
    title: 'Design login screen',
    description: 'Mockups for sign in and register',
    status: 'In Progress',
    priority: 'High',
    creator: ada,
    assignee: bob,
    labels: ['ui', 'design'],
    dueDate: '2030-06-30T00:00:00.000Z',
    createdAt: '2030-01-01T00:00:00.000Z',
    updatedAt: '2030-01-01T00:00:00.000Z',
    ...overrides,
  }
}

const page = (tasks, pagination = {}) =>
  jsonResponse({ tasks, pagination: { page: 1, limit: 10, total: tasks.length, totalPages: 1, ...pagination } })

/** Returns the query params of the most recent GET /api/tasks call. */
function lastTaskQuery(fetchMock) {
  const urls = fetchMock.mock.calls.map(([url]) => String(url)).filter((url) => url.startsWith('/api/tasks'))
  return new URL(urls.at(-1), 'http://localhost').searchParams
}

describe('TasksPage', () => {
  it('shows a loading state, then renders the task details', async () => {
    const fetchMock = stubApi({ 'GET /auth/me': signedIn, 'GET /tasks': () => page([makeTask()]) })

    renderRoute('/')

    expect(await screen.findByRole('status', { name: 'Loading tasks' })).toBeInTheDocument()
    expect(await screen.findByRole('heading', { level: 2, name: 'Design login screen' })).toBeInTheDocument()

    const card = screen.getByRole('heading', { name: 'Design login screen' }).closest('li')
    const view = within(card)
    expect(view.getByText('Mockups for sign in and register')).toBeInTheDocument()
    expect(view.getByText('In Progress')).toBeInTheDocument()
    expect(view.getByText('High priority')).toBeInTheDocument()
    expect(view.getByText('Ada Lovelace')).toBeInTheDocument()
    expect(view.getByText('Bob Builder')).toBeInTheDocument()
    expect(view.getByText('ui')).toBeInTheDocument()
    expect(view.getByText('design')).toBeInTheDocument()
    // Formatted for the user's locale, so build the expectation the same way.
    const expectedDate = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeZone: 'UTC' }).format(new Date('2030-06-30'))
    expect(view.getByText(expectedDate)).toBeInTheDocument()

    expect(screen.getByRole('heading', { level: 1, name: 'Tasks' })).toBeInTheDocument()
    expect(lastTaskQuery(fetchMock).get('page')).toBe('1')
    expect(lastTaskQuery(fetchMock).get('limit')).toBe('10')
    expect(fetchMock).toHaveBeenCalledWith('/api/tasks?page=1&limit=10', expect.objectContaining({ credentials: 'include' }))
  })

  it('shows "Unassigned" and omits description, labels and due date when absent', async () => {
    stubApi({
      'GET /auth/me': signedIn,
      'GET /tasks': () => page([makeTask({ assignee: null, description: '', labels: [], dueDate: null })]),
    })

    renderRoute('/')

    const card = (await screen.findByRole('heading', { name: 'Design login screen' })).closest('li')
    expect(within(card).getByText('Unassigned')).toBeInTheDocument()
    expect(within(card).queryByText('Due')).not.toBeInTheDocument()
    expect(within(card).queryByRole('list', { name: 'Labels' })).not.toBeInTheDocument()
  })

  it('has a Create Task action that is only a placeholder for now', async () => {
    stubApi({ 'GET /auth/me': signedIn, 'GET /tasks': () => page([makeTask()]) })
    const user = userEvent.setup()
    renderRoute('/')

    await user.click(await screen.findByRole('button', { name: 'Create Task' }))

    expect(screen.getByRole('status')).toHaveTextContent('coming in the next step')
  })

  it('shows an empty state when the user has no tasks', async () => {
    stubApi({ 'GET /auth/me': signedIn, 'GET /tasks': () => page([], { total: 0, totalPages: 0 }) })

    renderRoute('/')

    expect(await screen.findByRole('heading', { name: 'No tasks yet' })).toBeInTheDocument()
    expect(screen.getByText(/Tasks you create or that are assigned to you/)).toBeInTheDocument()
    // No filters are active, so the empty state offers no Clear filters shortcut (the toolbar one is disabled).
    expect(screen.getAllByRole('button', { name: 'Clear filters' })).toHaveLength(1)
  })

  it('shows an error with retry, and recovers when retried', async () => {
    let calls = 0
    stubApi({
      'GET /auth/me': signedIn,
      'GET /tasks': () => {
        calls += 1
        if (calls === 1) return jsonResponse({ error: { message: 'Internal server error' } }, 500)
        return page([makeTask()])
      },
    })
    const user = userEvent.setup()
    renderRoute('/')

    expect(await screen.findByRole('alert')).toHaveTextContent('Could not load tasks')
    await user.click(screen.getByRole('button', { name: /try again/i }))

    expect(await screen.findByRole('heading', { name: 'Design login screen' })).toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('shows an error when the network is down', async () => {
    stubApi({
      'GET /auth/me': signedIn,
      'GET /tasks': () => {
        throw new TypeError('Failed to fetch')
      },
    })

    renderRoute('/')

    expect(await screen.findByRole('alert')).toHaveTextContent('Could not load tasks')
  })
})

describe('TasksPage pagination', () => {
  /** Serves 25 tasks in pages of 10, honouring the requested page. */
  function pagedApi() {
    return stubApi({
      'GET /auth/me': signedIn,
      'GET /tasks': (_options, url) => {
        const pageNumber = Number(new URL(url, 'http://localhost').searchParams.get('page'))
        const count = pageNumber === 3 ? 5 : 10
        const tasks = Array.from({ length: count }, (_, i) =>
          makeTask({ id: `p${pageNumber}-${i}`, title: `Task ${(pageNumber - 1) * 10 + i + 1}` }),
        )
        return page(tasks, { page: pageNumber, total: 25, totalPages: 3 })
      },
    })
  }

  it('disables Previous on the first page and navigates forward and back', async () => {
    const fetchMock = pagedApi()
    const user = userEvent.setup()
    renderRoute('/')

    expect(await screen.findByText('Task 1')).toBeInTheDocument()
    expect(screen.getByText('Page 1 of 3 · 25 tasks')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /previous/i })).toBeDisabled()
    expect(screen.getByRole('button', { name: /next/i })).toBeEnabled()

    await user.click(screen.getByRole('button', { name: /next/i }))
    expect(await screen.findByText('Task 11')).toBeInTheDocument()
    expect(lastTaskQuery(fetchMock).get('page')).toBe('2')
    expect(screen.getByRole('button', { name: /previous/i })).toBeEnabled()

    await user.click(screen.getByRole('button', { name: /previous/i }))
    expect(await screen.findByText('Task 1')).toBeInTheDocument()
  })

  it('disables Next on the last page', async () => {
    pagedApi()
    const user = userEvent.setup()
    renderRoute('/')

    await user.click(await screen.findByRole('button', { name: /next/i }))
    await screen.findByText('Task 11')
    await user.click(screen.getByRole('button', { name: /next/i }))

    expect(await screen.findByText('Task 21')).toBeInTheDocument()
    expect(screen.getByText('Page 3 of 3 · 25 tasks')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /next/i })).toBeDisabled()
    expect(screen.getByRole('button', { name: /previous/i })).toBeEnabled()
  })
})

describe('TasksPage filters', () => {
  it('sends status, priority and scope to the API', async () => {
    const fetchMock = stubApi({ 'GET /auth/me': signedIn, 'GET /tasks': () => page([makeTask()]) })
    const user = userEvent.setup()
    renderRoute('/')
    await screen.findByText('Design login screen')

    await user.selectOptions(screen.getByLabelText('Status'), 'In Review')
    await waitForQuery(fetchMock, 'status', 'In Review')
    await user.selectOptions(screen.getByLabelText('Priority'), 'Critical')
    await waitForQuery(fetchMock, 'priority', 'Critical')
    await user.selectOptions(screen.getByLabelText('Show'), 'assigned')
    await waitForQuery(fetchMock, 'scope', 'assigned')

    const query = lastTaskQuery(fetchMock)
    expect(query.get('status')).toBe('In Review')
    expect(query.get('priority')).toBe('Critical')
    expect(query.get('scope')).toBe('assigned')
  })

  it('resets to page 1 when a filter changes', async () => {
    const fetchMock = stubApi({
      'GET /auth/me': signedIn,
      'GET /tasks': (_options, url) => {
        const pageNumber = Number(new URL(url, 'http://localhost').searchParams.get('page'))
        return page([makeTask({ id: `x${pageNumber}`, title: `Page ${pageNumber} task` })], {
          page: pageNumber,
          total: 30,
          totalPages: 3,
        })
      },
    })
    const user = userEvent.setup()
    renderRoute('/')

    await user.click(await screen.findByRole('button', { name: /next/i }))
    await screen.findByText('Page 2 task')
    await user.selectOptions(screen.getByLabelText('Priority'), 'Low')

    expect(await screen.findByText('Page 1 task')).toBeInTheDocument()
    const query = lastTaskQuery(fetchMock)
    expect(query.get('page')).toBe('1')
    expect(query.get('priority')).toBe('Low')
  })

  it('shows a filtered empty state and clears the filters from it', async () => {
    const fetchMock = stubApi({
      'GET /auth/me': signedIn,
      'GET /tasks': (_options, url) => {
        const hasFilter = new URL(url, 'http://localhost').searchParams.has('status')
        return hasFilter ? page([], { total: 0, totalPages: 0 }) : page([makeTask()])
      },
    })
    const user = userEvent.setup()
    renderRoute('/')
    await screen.findByText('Design login screen')
    expect(screen.getAllByRole('button', { name: 'Clear filters' })[0]).toBeDisabled()

    await user.selectOptions(screen.getByLabelText('Status'), 'Idea')

    expect(await screen.findByRole('heading', { name: 'No tasks match these filters' })).toBeInTheDocument()
    await user.click(screen.getAllByRole('button', { name: 'Clear filters' }).at(-1))

    expect(await screen.findByText('Design login screen')).toBeInTheDocument()
    expect(screen.getByLabelText('Status')).toHaveValue('')
    expect(lastTaskQuery(fetchMock).has('status')).toBe(false)
  })

})

/** Waits until a request with the given query param has been made. */
function waitForQuery(fetchMock, key, value) {
  return waitFor(() => expect(lastTaskQuery(fetchMock).get(key)).toBe(value))
}
