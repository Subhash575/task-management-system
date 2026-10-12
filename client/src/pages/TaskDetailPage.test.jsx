import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { jsonResponse, renderRoute, stubApi, testUser } from '@/test/renderWithProviders'

const signedIn = () => jsonResponse({ user: testUser })
const ada = { id: 'u1', name: 'Ada Lovelace', email: 'ada@example.com' } // the signed-in user
const bob = { id: 'u2', name: 'Bob Builder', email: 'bob@example.com' }

const fmt = (iso) => new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(iso))
const fmtDate = (iso) => new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeZone: 'UTC' }).format(new Date(iso))

function makeTask(overrides = {}) {
  return {
    id: 't1',
    title: 'Design login screen',
    description: 'Mockups for sign in\nand register',
    status: 'In Review',
    priority: 'High',
    creator: ada,
    assignee: bob,
    labels: ['ui', 'design'],
    dueDate: '2030-06-30T00:00:00.000Z',
    createdAt: '2030-01-02T09:30:00.000Z',
    updatedAt: '2030-02-03T10:45:00.000Z',
    statusHistory: [],
    ...overrides,
  }
}

const history = [
  { id: 'h1', from: 'To Do', to: 'In Progress', changedAt: '2030-01-05T08:00:00.000Z', changedBy: ada },
  { id: 'h2', from: 'In Progress', to: 'In Review', changedAt: '2030-01-06T16:20:00.000Z', changedBy: bob },
]

const listPage = (tasks) => jsonResponse({ tasks, pagination: { page: 1, limit: 10, total: tasks.length, totalPages: 1 } })

function api(task, extra = {}) {
  return stubApi({
    'GET /auth/me': signedIn,
    'GET /tasks/t1': () => jsonResponse({ task }),
    'GET /tasks': () => listPage([task]),
    ...extra,
  })
}

describe('task detail page', () => {
  it('shows a loading state, then every field of the task', async () => {
    const fetchMock = api(makeTask())
    renderRoute('/tasks/t1')

    expect(await screen.findByRole('status', { name: 'Loading task' })).toBeInTheDocument()
    expect(await screen.findByRole('heading', { level: 1, name: 'Design login screen' })).toBeInTheDocument()

    const article = within(screen.getByRole('article'))
    expect(article.getAllByText('In Review').length).toBeGreaterThan(0)
    expect(article.getByText('High priority')).toBeInTheDocument()
    expect(article.getByText(/Mockups for sign in/)).toHaveTextContent('Mockups for sign in and register')
    expect(article.getByText('Ada Lovelace', { selector: 'dd' })).toBeInTheDocument()
    expect(article.getByText('Bob Builder', { selector: 'dd' })).toBeInTheDocument()
    expect(article.getByText('ui')).toBeInTheDocument()
    expect(article.getByText('design')).toBeInTheDocument()
    expect(article.getByText(fmtDate('2030-06-30'))).toBeInTheDocument()
    expect(article.getByText(fmt('2030-01-02T09:30:00.000Z'))).toBeInTheDocument()
    expect(article.getByText(fmt('2030-02-03T10:45:00.000Z'))).toBeInTheDocument()
    expect(fetchMock).toHaveBeenCalledWith('/api/tasks/t1', expect.objectContaining({ credentials: 'include' }))
  })

  it('shows placeholders for missing optional fields', async () => {
    api(makeTask({ description: '', assignee: null, labels: [], dueDate: null }))
    renderRoute('/tasks/t1')

    await screen.findByRole('heading', { level: 1, name: 'Design login screen' })
    expect(screen.getByText('No description.')).toBeInTheDocument()
    expect(screen.getByText('Unassigned')).toBeInTheDocument()
    expect(screen.getByText('No labels')).toBeInTheDocument()
    expect(screen.getByText('No due date')).toBeInTheDocument()
  })

  it('shows the status history in the order the API returns it (oldest first)', async () => {
    api(makeTask({ statusHistory: history }))
    renderRoute('/tasks/t1')

    const list = await screen.findByRole('list', { name: 'Status history' })
    const items = within(list).getAllByRole('listitem')

    expect(items).toHaveLength(2)
    expect(items[0]).toHaveTextContent('To Do')
    expect(items[0]).toHaveTextContent('In Progress')
    expect(items[0]).toHaveTextContent('Ada Lovelace')
    expect(within(items[0]).getByText(fmt('2030-01-05T08:00:00.000Z'))).toBeInTheDocument()
    expect(items[1]).toHaveTextContent('In Progress')
    expect(items[1]).toHaveTextContent('In Review')
    expect(items[1]).toHaveTextContent('Bob Builder')
    expect(within(items[1]).getByText(fmt('2030-01-06T16:20:00.000Z'))).toBeInTheDocument()
    expect(within(items[0]).getByText(fmt('2030-01-05T08:00:00.000Z'))).toHaveAttribute('datetime', '2030-01-05T08:00:00.000Z')
  })

  it('shows an empty-history message when the status never changed', async () => {
    api(makeTask({ statusHistory: [] }))
    renderRoute('/tasks/t1')

    expect(await screen.findByText('No status changes yet.')).toBeInTheDocument()
    expect(screen.queryByRole('list', { name: 'Status history' })).not.toBeInTheDocument()
  })

  it('names an unknown actor when the user who changed the status no longer exists', async () => {
    api(makeTask({ statusHistory: [{ ...history[0], changedBy: null }] }))
    renderRoute('/tasks/t1')

    expect(await screen.findByText('Unknown user')).toBeInTheDocument()
  })

  it('shows "not found" for a missing or inaccessible task (the API answers 404)', async () => {
    stubApi({
      'GET /auth/me': signedIn,
      'GET /tasks/t1': () => jsonResponse({ error: { message: 'Task not found' } }, 404),
    })
    renderRoute('/tasks/t1')

    expect(await screen.findByRole('heading', { name: 'Task not found' })).toBeInTheDocument()
    expect(screen.getByText(/may have been deleted, or you may not have access/)).toBeInTheDocument()
    expect(screen.queryByText('No status changes yet.')).not.toBeInTheDocument()
  })

  it('shows "not found" for a malformed id (400)', async () => {
    stubApi({
      'GET /auth/me': signedIn,
      'GET /tasks/not-an-id': () => jsonResponse({ error: { message: 'Validation failed' } }, 400),
    })
    renderRoute('/tasks/not-an-id')

    expect(await screen.findByRole('heading', { name: 'Task not found' })).toBeInTheDocument()
  })

  it('shows a permission message on 403', async () => {
    stubApi({
      'GET /auth/me': signedIn,
      'GET /tasks/t1': () => jsonResponse({ error: { message: 'Forbidden' } }, 403),
    })
    renderRoute('/tasks/t1')

    expect(await screen.findByRole('heading', { name: "You can't view this task" })).toBeInTheDocument()
  })

  it('sends the user to the login page when the session has expired (401)', async () => {
    stubApi({
      'GET /auth/me': signedIn,
      'GET /tasks/t1': () => jsonResponse({ error: { message: 'Your session is invalid or has expired.' } }, 401),
    })
    renderRoute('/tasks/t1')

    expect(await screen.findByRole('heading', { name: 'Sign in' })).toBeInTheDocument()
  })

  it.each([
    ['a server error', () => jsonResponse({ error: { message: 'Internal server error' } }, 500)],
    [
      'a network failure',
      () => {
        throw new TypeError('Failed to fetch')
      },
    ],
  ])('shows a retryable error for %s', async (_name, fail) => {
    let calls = 0
    api(makeTask(), {
      'GET /tasks/t1': () => {
        calls += 1
        return calls === 1 ? fail() : jsonResponse({ task: makeTask() })
      },
    })
    const user = userEvent.setup()
    renderRoute('/tasks/t1')

    expect(await screen.findByRole('alert')).toHaveTextContent('Could not load this task')
    await user.click(screen.getByRole('button', { name: /try again/i }))

    expect(await screen.findByRole('heading', { level: 1, name: 'Design login screen' })).toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })
})

describe('opening the detail page from the list and the board', () => {
  it('opens from a list card, and "Back to tasks" returns to the list', async () => {
    api(makeTask({ statusHistory: history }))
    const user = userEvent.setup()
    renderRoute('/')

    await user.click(await screen.findByRole('link', { name: 'Design login screen' }))

    expect(await screen.findByRole('heading', { level: 1, name: 'Design login screen' })).toBeInTheDocument()
    expect(await screen.findByRole('list', { name: 'Status history' })).toBeInTheDocument()

    await user.click(screen.getByRole('link', { name: /back to tasks/i }))
    expect(await screen.findByRole('link', { name: 'Design login screen' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'List' })).toHaveAttribute('aria-current', 'page')
  })

  it('opens from a board card, "Back" returns to the board, and the card controls keep working', async () => {
    const fetchMock = api(makeTask(), {
      'PATCH /tasks/t1': () => jsonResponse({ task: makeTask({ status: 'Completed' }) }),
    })
    const user = userEvent.setup()
    renderRoute('/board')

    // The drag handle and the move select are still there next to the link.
    expect(await screen.findByRole('button', { name: 'Drag task: Design login screen' })).toBeInTheDocument()
    expect(screen.getByLabelText('Move “Design login screen” to status')).toBeInTheDocument()

    // Using the select moves the card without navigating away.
    await user.selectOptions(screen.getByLabelText('Move “Design login screen” to status'), 'Completed')
    expect(fetchMock.mock.calls.filter(([, o]) => o?.method === 'PATCH')).toHaveLength(1)
    expect(screen.getByRole('region', { name: 'Completed' })).toBeInTheDocument()

    await user.click(screen.getByRole('link', { name: 'Design login screen' }))
    expect(await screen.findByRole('heading', { level: 1, name: 'Design login screen' })).toBeInTheDocument()

    await user.click(screen.getByRole('link', { name: /back to tasks/i }))
    expect(await screen.findByRole('region', { name: 'To Do' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Board' })).toHaveAttribute('aria-current', 'page')
  })

  it('does not open the detail page when a list card\'s Edit or Delete button is used', async () => {
    api(makeTask())
    const user = userEvent.setup()
    renderRoute('/')

    await user.click(await screen.findByRole('button', { name: 'Edit task: Design login screen' }))

    expect(await screen.findByRole('dialog', { name: 'Edit task' })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { level: 1, name: 'Design login screen' })).not.toBeInTheDocument()
  })

  it('supports opening a task directly by URL', async () => {
    api(makeTask())
    renderRoute('/tasks/t1')

    expect(await screen.findByRole('heading', { level: 1, name: 'Design login screen' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /back to tasks/i })).toHaveAttribute('href', '/')
  })
})
