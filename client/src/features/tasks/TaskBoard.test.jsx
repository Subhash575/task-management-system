import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { jsonResponse, renderRoute, stubApi, testUser } from '@/test/renderWithProviders'
import { statusFromDragEnd } from './boardDrag'

const signedIn = () => jsonResponse({ user: testUser })
const ada = { id: 'u1', name: 'Ada Lovelace', email: 'ada@example.com' } // the signed-in user
const bob = { id: 'u2', name: 'Bob Builder', email: 'bob@example.com' }
const cy = { id: 'u3', name: 'Cy Young', email: 'cy@example.com' }

let counter = 0
function makeTask(overrides = {}) {
  counter += 1
  return {
    id: `t${counter}`,
    title: `Task ${counter}`,
    description: '',
    status: 'To Do',
    priority: 'Medium',
    creator: ada,
    assignee: null,
    labels: [],
    dueDate: null,
    ...overrides,
  }
}

/** An in-memory API: GET /tasks serves the stored list, PATCH changes it (so "persisted" can be checked). */
function boardApi(tasks, { onPatch, onGet } = {}) {
  const fetchMock = stubApi({
    'GET /auth/me': signedIn,
    'GET /tasks': (_options, url) =>
      onGet?.(url) ??
      jsonResponse({ tasks, pagination: { page: 1, limit: 100, total: tasks.length, totalPages: 1 } }),
  })
  const base = fetchMock.getMockImplementation()
  fetchMock.mockImplementation(async (url, options = {}) => {
    const match = String(url).match(/^\/api\/tasks\/([^/?]+)$/)
    if (match && options.method === 'PATCH') {
      if (onPatch) return onPatch(options, tasks, match[1])
      const task = tasks.find((t) => t.id === match[1])
      Object.assign(task, JSON.parse(options.body))
      return jsonResponse({ task })
    }
    return base(url, options)
  })
  return { fetchMock, tasks }
}

const patchCalls = (fetchMock) => fetchMock.mock.calls.filter(([, o]) => o?.method === 'PATCH')
const getCalls = (fetchMock) => fetchMock.mock.calls.filter(([url, o]) => String(url).startsWith('/api/tasks?') && (o?.method ?? 'GET') === 'GET')
const column = (status) => within(screen.getByRole('region', { name: status }))
const moveSelect = (title) => screen.getByLabelText(`Move “${title}” to status`)

describe('kanban board', () => {
  it('renders the five status columns with tasks grouped by status and counts', async () => {
    boardApi([
      makeTask({ title: 'Brainstorm', status: 'Idea' }),
      makeTask({ title: 'Write spec', status: 'To Do' }),
      makeTask({ title: 'Plan sprint', status: 'To Do' }),
      makeTask({ title: 'Build it', status: 'In Progress' }),
      makeTask({ title: 'Check it', status: 'In Review' }),
      makeTask({ title: 'Ship it', status: 'Completed' }),
    ])
    renderRoute('/board')

    await screen.findByRole('heading', { name: 'Brainstorm' })
    const headings = screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent)
    expect(headings).toEqual(['Idea1', 'To Do2', 'In Progress1', 'In Review1', 'Completed1'])
    expect(column('Idea').getByText('Brainstorm')).toBeInTheDocument()
    expect(column('To Do').getByText('Write spec')).toBeInTheDocument()
    expect(column('To Do').getByText('Plan sprint')).toBeInTheDocument()
    expect(column('In Progress').getByText('Build it')).toBeInTheDocument()
    expect(column('In Review').getByText('Check it')).toBeInTheDocument()
    expect(column('Completed').getByText('Ship it')).toBeInTheDocument()
    expect(column('Idea').queryByText('Write spec')).not.toBeInTheDocument()
  })

  it('shows title, priority, assignee and due date on a card, and "No tasks" in empty columns', async () => {
    boardApi([
      makeTask({
        title: 'Design login',
        status: 'In Progress',
        priority: 'Critical',
        assignee: bob,
        dueDate: '2030-06-30T00:00:00.000Z',
      }),
      makeTask({ title: 'No extras', status: 'To Do' }),
    ])
    renderRoute('/board')

    const card = (await screen.findByRole('heading', { name: 'Design login' })).closest('li')
    const expectedDate = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeZone: 'UTC' }).format(
      new Date('2030-06-30'),
    )
    expect(within(card).getByText('Critical priority')).toBeInTheDocument()
    expect(within(card).getByText('Bob Builder')).toBeInTheDocument()
    expect(within(card).getByText(expectedDate)).toBeInTheDocument()

    const plain = screen.getByRole('heading', { name: 'No extras' }).closest('li')
    expect(within(plain).getByText('Unassigned')).toBeInTheDocument()
    expect(within(plain).queryByText('Due')).not.toBeInTheDocument()

    expect(column('Idea').getByText('No tasks')).toBeInTheDocument()
    expect(column('Completed').getByText('No tasks')).toBeInTheDocument()
  })

  it('shows a loading state, then the board', async () => {
    boardApi([makeTask({ title: 'Loaded' })])
    renderRoute('/board')

    expect(await screen.findByRole('status', { name: 'Loading board' })).toBeInTheDocument()
    expect(await screen.findByRole('heading', { name: 'Loaded' })).toBeInTheDocument()
    expect(screen.queryByRole('status', { name: 'Loading board' })).not.toBeInTheDocument()
  })

  it('shows an error with retry', async () => {
    let calls = 0
    boardApi([makeTask({ title: 'Back again' })], {
      onGet: () => {
        calls += 1
        return calls === 1 ? jsonResponse({ error: { message: 'Internal server error' } }, 500) : undefined
      },
    })
    const user = userEvent.setup()
    renderRoute('/board')

    expect(await screen.findByRole('alert')).toHaveTextContent('Could not load tasks')
    await user.click(screen.getByRole('button', { name: /try again/i }))

    expect(await screen.findByRole('heading', { name: 'Back again' })).toBeInTheDocument()
  })

  it('shows an empty state when there are no tasks', async () => {
    boardApi([])
    renderRoute('/board')

    expect(await screen.findByRole('heading', { name: 'No tasks yet' })).toBeInTheDocument()
    expect(screen.queryByRole('region', { name: 'Idea' })).not.toBeInTheDocument()
  })

  it('uses the same API as the list, and loads every page up to the cap', async () => {
    const urls = []
    const { fetchMock } = boardApi([], {
      onGet: (url) => {
        urls.push(url)
        const page = Number(new URL(url, 'http://localhost').searchParams.get('page'))
        return jsonResponse({
          tasks: [makeTask({ title: `Page ${page} task` })],
          pagination: { page, limit: 100, total: 650, totalPages: 7 },
        })
      },
    })
    renderRoute('/board')

    expect(await screen.findByText('The board shows the first 500 of 650 tasks. Use the filters to narrow it down.')).toBeInTheDocument()
    expect(urls).toEqual([1, 2, 3, 4, 5].map((n) => `/api/tasks?page=${n}&limit=100`))
    expect(screen.getByRole('heading', { name: 'Page 5 task' })).toBeInTheDocument()
    expect(fetchMock).toHaveBeenCalledWith('/api/tasks?page=1&limit=100', expect.objectContaining({ credentials: 'include' }))
  })
})

describe('moving tasks', () => {
  it('moves a task with the status select, sends only the status, and persists it', async () => {
    const { fetchMock, tasks } = boardApi([makeTask({ title: 'Move me', status: 'To Do' })])
    const user = userEvent.setup()
    const { unmount } = renderRoute('/board')
    await screen.findByRole('heading', { name: 'Move me' })

    await user.selectOptions(moveSelect('Move me'), 'In Review')

    await waitFor(() => expect(column('In Review').getByText('Move me')).toBeInTheDocument())
    expect(column('To Do').queryByText('Move me')).not.toBeInTheDocument()
    expect(patchCalls(fetchMock)).toHaveLength(1)
    const [url, options] = patchCalls(fetchMock)[0]
    expect(url).toBe('/api/tasks/t' + tasks[0].id.slice(1))
    expect(options).toMatchObject({ method: 'PATCH', credentials: 'include' })
    expect(JSON.parse(options.body)).toEqual({ status: 'In Review' })

    // The cache is refreshed from the server after the change...
    await waitFor(() => expect(getCalls(fetchMock).length).toBeGreaterThanOrEqual(2))
    expect(column('In Review').getByText('Move me')).toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()

    // ...and a fresh page load (a "reload") still shows it, because the server stored it.
    unmount()
    renderRoute('/board')
    await screen.findByRole('heading', { name: 'Move me' })
    expect(column('In Review').getByText('Move me')).toBeInTheDocument()
    expect(tasks[0].status).toBe('In Review')
  })

  it('moves the card at once (optimistically) and locks it until the server answers', async () => {
    let release
    const { fetchMock } = boardApi([makeTask({ title: 'Slow one', status: 'Idea' })], {
      onPatch: (options, tasks) =>
        new Promise((resolve) => {
          release = () => {
            Object.assign(tasks[0], JSON.parse(options.body))
            resolve(jsonResponse({ task: tasks[0] }))
          }
        }),
    })
    const user = userEvent.setup()
    renderRoute('/board')
    await screen.findByRole('heading', { name: 'Slow one' })

    await user.selectOptions(moveSelect('Slow one'), 'Completed')

    await waitFor(() => expect(column('Completed').getByText('Slow one')).toBeInTheDocument())
    const card = screen.getByRole('heading', { name: 'Slow one' }).closest('li')
    expect(card).toHaveAttribute('aria-busy', 'true')
    expect(moveSelect('Slow one')).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Drag task: Slow one' })).toBeDisabled()
    expect(patchCalls(fetchMock)).toHaveLength(1)

    release()
    await waitFor(() => expect(moveSelect('Slow one')).toBeEnabled())
    expect(column('Completed').getByText('Slow one')).toBeInTheDocument()
    expect(patchCalls(fetchMock)).toHaveLength(1)
  })

  it('does not send a request when a task is moved to its current status', async () => {
    const { fetchMock } = boardApi([makeTask({ title: 'Stay', status: 'To Do' })])
    const user = userEvent.setup()
    renderRoute('/board')
    await screen.findByRole('heading', { name: 'Stay' })

    await user.selectOptions(moveSelect('Stay'), 'To Do')

    expect(patchCalls(fetchMock)).toHaveLength(0)
  })

  it.each([
    ['403', () => jsonResponse({ error: { message: 'Assignees can only update the status of a task' } }, 403), 'Assignees can only update the status of a task'],
    ['404', () => jsonResponse({ error: { message: 'Task not found' } }, 404), 'Task not found'],
    ['500', () => jsonResponse({ error: { message: 'MongoServerError: secret' } }, 500), 'Something went wrong on our side'],
    [
      'network failure',
      () => {
        throw new TypeError('Failed to fetch')
      },
      'Could not reach the server',
    ],
  ])('puts the card back and shows a safe, dismissible message on a %s', async (_name, onPatch, expected) => {
    boardApi([makeTask({ title: 'Rejected', status: 'To Do' }), makeTask({ title: 'Bystander', status: 'Idea' })], {
      onPatch,
    })
    const user = userEvent.setup()
    renderRoute('/board')
    await screen.findByRole('heading', { name: 'Rejected' })

    await user.selectOptions(moveSelect('Rejected'), 'Completed')

    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent('Could not move “Rejected”.')
    expect(alert).toHaveTextContent(expected)
    expect(alert).not.toHaveTextContent('secret')
    // Back in its original column, usable again, and the rest of the board is untouched.
    await waitFor(() => expect(column('To Do').getByText('Rejected')).toBeInTheDocument())
    expect(column('Completed').queryByText('Rejected')).not.toBeInTheDocument()
    expect(moveSelect('Rejected')).toBeEnabled()
    expect(moveSelect('Rejected')).toHaveValue('To Do')
    expect(column('Idea').getByText('Bystander')).toBeInTheDocument()

    await user.click(within(alert).getByRole('button', { name: 'Dismiss' }))
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('reverts only the failed task when two moves are in flight', async () => {
    const releases = {}
    boardApi([makeTask({ id: 'a', title: 'Goes through', status: 'To Do' }), makeTask({ id: 'b', title: 'Gets rejected', status: 'To Do' })], {
      onPatch: (options, tasks, id) =>
        new Promise((resolve) => {
          releases[id] = () => {
            if (id === 'b') return resolve(jsonResponse({ error: { message: 'Task not found' } }, 404))
            Object.assign(tasks.find((t) => t.id === id), JSON.parse(options.body))
            return resolve(jsonResponse({ task: tasks.find((t) => t.id === id) }))
          }
        }),
    })
    const user = userEvent.setup()
    renderRoute('/board')
    await screen.findByRole('heading', { name: 'Goes through' })

    await user.selectOptions(moveSelect('Goes through'), 'In Progress')
    await user.selectOptions(moveSelect('Gets rejected'), 'In Progress')
    await waitFor(() => expect(column('In Progress').getByText('Gets rejected')).toBeInTheDocument())

    releases.b()
    expect(await screen.findByRole('alert')).toHaveTextContent('Task not found')
    await waitFor(() => expect(column('To Do').getByText('Gets rejected')).toBeInTheDocument())
    expect(column('In Progress').getByText('Goes through')).toBeInTheDocument() // still moved, still pending

    releases.a()
    await waitFor(() => expect(moveSelect('Goes through')).toBeEnabled())
    expect(column('In Progress').getByText('Goes through')).toBeInTheDocument()
    expect(column('To Do').getByText('Gets rejected')).toBeInTheDocument()
  })

  it('lets the creator and the assignee move a card, and keeps an unrelated user\'s card read-only', async () => {
    const { fetchMock } = boardApi([
      makeTask({ title: 'Mine', creator: ada }),
      makeTask({ title: 'Assigned to me', creator: bob, assignee: ada }),
      makeTask({ title: 'Not mine', creator: bob, assignee: cy }),
    ])
    const user = userEvent.setup()
    renderRoute('/board')
    await screen.findByRole('heading', { name: 'Not mine' })

    expect(moveSelect('Mine')).toBeInTheDocument()
    expect(moveSelect('Assigned to me')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Drag task: Mine' })).toBeInTheDocument()
    expect(screen.queryByLabelText('Move “Not mine” to status')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Drag task: Not mine' })).not.toBeInTheDocument()

    await user.selectOptions(moveSelect('Assigned to me'), 'In Review')
    await waitFor(() => expect(patchCalls(fetchMock)).toHaveLength(1))
  })

  it('shows the server\'s answer when a permitted-looking move is refused (the server stays authoritative)', async () => {
    boardApi([makeTask({ title: 'Locked down', creator: bob, assignee: ada })], {
      onPatch: () => jsonResponse({ error: { message: 'Assignees can only update the status of a task' } }, 403),
    })
    const user = userEvent.setup()
    renderRoute('/board')
    await screen.findByRole('heading', { name: 'Locked down' })

    await user.selectOptions(moveSelect('Locked down'), 'Idea')

    expect(await screen.findByRole('alert')).toHaveTextContent('Assignees can only update the status of a task')
    await waitFor(() => expect(column('To Do').getByText('Locked down')).toBeInTheDocument())
  })
})

describe('board filters and views', () => {
  it('sends priority and scope to the API and offers no status filter', async () => {
    const { fetchMock } = boardApi([makeTask({ title: 'Anything' })])
    const user = userEvent.setup()
    renderRoute('/board')
    await screen.findByRole('heading', { name: 'Anything' })

    expect(screen.queryByLabelText('Status')).not.toBeInTheDocument()
    await user.selectOptions(screen.getByLabelText('Priority'), 'High')
    await user.selectOptions(screen.getByLabelText('Show'), 'assigned')

    await waitFor(() => {
      const last = getCalls(fetchMock).at(-1)[0]
      expect(new URL(last, 'http://localhost').searchParams.get('priority')).toBe('High')
      expect(new URL(last, 'http://localhost').searchParams.get('scope')).toBe('assigned')
    })
    expect(new URL(getCalls(fetchMock).at(-1)[0], 'http://localhost').searchParams.get('limit')).toBe('100')
  })

  it('shows a filtered empty state that can be cleared', async () => {
    boardApi([], {
      onGet: (url) =>
        new URL(url, 'http://localhost').searchParams.has('priority')
          ? jsonResponse({ tasks: [], pagination: { page: 1, limit: 100, total: 0, totalPages: 0 } })
          : jsonResponse({ tasks: [makeTask({ title: 'Visible' })], pagination: { page: 1, limit: 100, total: 1, totalPages: 1 } }),
    })
    const user = userEvent.setup()
    renderRoute('/board')
    await screen.findByRole('heading', { name: 'Visible' })

    await user.selectOptions(screen.getByLabelText('Priority'), 'Low')
    expect(await screen.findByRole('heading', { name: 'No tasks match these filters' })).toBeInTheDocument()

    await user.click(screen.getAllByRole('button', { name: 'Clear filters' }).at(-1))
    expect(await screen.findByRole('heading', { name: 'Visible' })).toBeInTheDocument()
  })

  it('switches between the list and the board without breaking either URL', async () => {
    boardApi([makeTask({ title: 'Same task', status: 'In Progress' })])
    const user = userEvent.setup()
    renderRoute('/')

    // The list view at "/" still works as before.
    expect(await screen.findByRole('heading', { level: 2, name: 'Same task' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'List' })).toHaveAttribute('aria-current', 'page')
    expect(screen.getByRole('navigation', { name: 'Pagination' })).toBeInTheDocument()

    await user.click(screen.getByRole('link', { name: 'Board' }))
    expect(await screen.findByRole('region', { name: 'In Progress' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Board' })).toHaveAttribute('aria-current', 'page')
    expect(screen.queryByRole('navigation', { name: 'Pagination' })).not.toBeInTheDocument()

    await user.click(screen.getByRole('link', { name: 'List' }))
    expect(await screen.findByRole('navigation', { name: 'Pagination' })).toBeInTheDocument()
  })

  it('does not call the paginated list endpoint while on the board', async () => {
    const { fetchMock } = boardApi([makeTask()])
    renderRoute('/board')
    await screen.findByRole('region', { name: 'To Do' })

    const urls = getCalls(fetchMock).map(([url]) => url)
    expect(urls.every((url) => url.includes('limit=100'))).toBe(true)
  })

  it('keeps Create Task working on the board and refreshes the board', async () => {
    const tasks = [makeTask({ title: 'Old' })]
    const { fetchMock } = boardApi(tasks, {
      onPatch: undefined,
    })
    const base = fetchMock.getMockImplementation()
    fetchMock.mockImplementation(async (url, options = {}) => {
      if (url === '/api/users') return jsonResponse({ users: [ada] })
      if (url === '/api/tasks' && options.method === 'POST') {
        const task = makeTask({ ...JSON.parse(options.body), creator: ada })
        tasks.unshift(task)
        return jsonResponse({ task }, 201)
      }
      return base(url, options)
    })
    const user = userEvent.setup()
    renderRoute('/board')

    await user.click(await screen.findByRole('button', { name: 'Create Task' }))
    const dialog = within(await screen.findByRole('dialog', { name: 'Create task' }))
    await user.click(dialog.getByLabelText(/^Title/))
    await user.paste('Brand new')
    await user.click(dialog.getByRole('button', { name: 'Create Task' }))

    expect(await screen.findByRole('heading', { name: 'Brand new' })).toBeInTheDocument()
    expect(column('To Do').getByText('Brand new')).toBeInTheDocument()
  })
})

describe('board polish', () => {
  it('shows labels and marks overdue cards, but not completed, future or undated ones', async () => {
    boardApi([
      makeTask({ title: 'Late one', dueDate: '2000-01-01T00:00:00.000Z', labels: ['backend', 'urgent'] }),
      makeTask({ title: 'Late but done', status: 'Completed', dueDate: '2000-01-01T00:00:00.000Z' }),
      makeTask({ title: 'Future one', dueDate: '2999-01-01T00:00:00.000Z' }),
      makeTask({ title: 'No date' }),
    ])
    renderRoute('/board')

    await screen.findByRole('heading', { name: 'Late one' })
    const card = (title) => screen.getByRole('heading', { name: title }).closest('li')
    expect(within(card('Late one')).getByText('Overdue')).toBeInTheDocument()
    expect(within(within(card('Late one')).getByRole('list', { name: 'Labels' })).getAllByRole('listitem')).toHaveLength(2)
    for (const title of ['Late but done', 'Future one', 'No date']) {
      expect(within(card(title)).queryByText('Overdue')).not.toBeInTheDocument()
    }
  })

  it('offers a working Create action from the empty board', async () => {
    boardApi([])
    renderRoute('/board')

    await userEvent.click(await screen.findByRole('button', { name: 'Create your first task' }))
    expect(await screen.findByRole('dialog')).toBeInTheDocument()
  })
})

describe('statusFromDragEnd', () => {
  const tasks = [{ id: 'a', status: 'To Do' }]

  it('returns the task and target status for a drop on another column', () => {
    expect(statusFromDragEnd({ active: { id: 'a' }, over: { id: 'In Review' } }, tasks)).toEqual({
      task: tasks[0],
      status: 'In Review',
    })
  })

  it.each([
    ['dropped on its own column', { active: { id: 'a' }, over: { id: 'To Do' } }],
    ['dropped outside any column', { active: { id: 'a' }, over: null }],
    ['dropped on something that is not a status', { active: { id: 'a' }, over: { id: 'not-a-status' } }],
    ['an unknown task', { active: { id: 'zzz' }, over: { id: 'Idea' } }],
  ])('returns null when %s', (_name, event) => {
    expect(statusFromDragEnd(event, tasks)).toBeNull()
  })
})
