import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { jsonResponse, renderRoute, stubApi, testUser } from '@/test/renderWithProviders'

const signedIn = () => jsonResponse({ user: testUser })
const creator = { id: 'u1', name: 'Ada Lovelace', email: 'ada@example.com' }

function makeTask(overrides = {}) {
  return {
    id: 't1',
    title: 'Existing task',
    description: '',
    status: 'To Do',
    priority: 'Medium',
    creator,
    assignee: null,
    labels: [],
    dueDate: null,
    ...overrides,
  }
}

const listBody = (tasks) => ({
  tasks,
  pagination: { page: 1, limit: 10, total: tasks.length, totalPages: tasks.length ? 1 : 0 },
})

/** A task API that keeps an in-memory list, so a successful POST really shows up in the next GET. */
function taskApi({ onPost } = {}) {
  const tasks = [makeTask()]
  return stubApi({
    'GET /auth/me': signedIn,
    'GET /tasks': () => jsonResponse(listBody(tasks)),
    'GET /users': () => jsonResponse({ users: [creator] }),
    'POST /tasks': (options) => {
      if (onPost) return onPost(options, tasks)
      const task = makeTask({ id: 't2', ...JSON.parse(options.body), creator })
      tasks.unshift(task)
      return jsonResponse({ task }, 201)
    },
  })
}

const postCalls = (fetchMock) => fetchMock.mock.calls.filter(([url, o]) => url === '/api/tasks' && o.method === 'POST')

async function openDialog(user) {
  await user.click(await screen.findByRole('button', { name: 'Create Task' }))
  return screen.findByRole('dialog', { name: 'Create task' })
}

describe('create task dialog', () => {
  it('opens with backend-consistent defaults and an unassigned assignee', async () => {
    taskApi()
    const user = userEvent.setup()
    renderRoute('/')

    const dialog = await openDialog(user)
    const form = within(dialog)

    expect(form.getByLabelText(/^Title/)).toHaveValue('')
    expect(form.getByLabelText('Status')).toHaveValue('To Do')
    expect(form.getByLabelText('Priority')).toHaveValue('Medium')
    expect(form.getByLabelText(/^Title/)).toHaveAttribute('aria-required', 'true')
    expect(await form.findByRole('option', { name: /Ada Lovelace/ })).toBeInTheDocument()
    expect(form.getByLabelText('Assignee')).toHaveValue('')
    expect(form.getByRole('button', { name: 'Cancel' })).toBeInTheDocument()
  })

  it('requires a title and does not call the API', async () => {
    const fetchMock = taskApi()
    const user = userEvent.setup()
    renderRoute('/')
    const dialog = await openDialog(user)

    await user.click(within(dialog).getByRole('button', { name: 'Create Task' }))

    expect(within(dialog).getByText('Title is required')).toBeInTheDocument()
    expect(within(dialog).getByLabelText(/^Title/)).toHaveAttribute('aria-invalid', 'true')
    expect(postCalls(fetchMock)).toHaveLength(0)
  })

  it('enforces the backend limits for title, description and labels', async () => {
    const fetchMock = taskApi()
    const user = userEvent.setup()
    renderRoute('/')
    const dialog = await openDialog(user)
    const form = within(dialog)

    await user.click(form.getByLabelText(/^Title/))
    await user.paste('x'.repeat(201))
    await user.click(form.getByLabelText('Description'))
    await user.paste('y'.repeat(5001))
    await user.click(form.getByLabelText('Labels'))
    await user.paste(Array.from({ length: 11 }, (_, i) => `l${i}`).join(','))
    await user.click(form.getByRole('button', { name: 'Create Task' }))

    expect(form.getByText('Title must be at most 200 characters')).toBeInTheDocument()
    expect(form.getByText('Description must be at most 5000 characters')).toBeInTheDocument()
    expect(form.getByText('Use at most 10 labels')).toBeInTheDocument()
    expect(postCalls(fetchMock)).toHaveLength(0)
  })

  it('creates the task, sends the exact payload, closes, and refreshes the list', async () => {
    const fetchMock = taskApi()
    const user = userEvent.setup()
    renderRoute('/')
    const dialog = await openDialog(user)
    const form = within(dialog)

    await user.click(form.getByLabelText(/^Title/))
    await user.paste('  Ship the release  ')
    await user.click(form.getByLabelText('Description'))
    await user.paste('Cut the tag')
    await user.selectOptions(form.getByLabelText('Status'), 'In Review')
    await user.selectOptions(form.getByLabelText('Priority'), 'Critical')
    await user.type(form.getByLabelText('Due date'), '2030-06-30')
    await user.click(form.getByLabelText('Labels'))
    await user.paste('release, Release, ops ,')
    await user.click(form.getByRole('button', { name: 'Create Task' }))

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(JSON.parse(postCalls(fetchMock)[0][1].body)).toEqual({
      title: 'Ship the release',
      description: 'Cut the tag',
      status: 'In Review',
      priority: 'Critical',
      labels: ['release', 'ops'],
      dueDate: '2030-06-30',
      assignee: null,
    })
    expect(postCalls(fetchMock)[0][1]).toMatchObject({ credentials: 'include' })
    expect(await screen.findByRole('heading', { level: 2, name: 'Ship the release' })).toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent('Task “Ship the release” was created.')
    expect(screen.queryByRole('button', { name: 'Show newest tasks' })).not.toBeInTheDocument()
  })

  it('sends a null due date and empty labels when those fields are left blank', async () => {
    const fetchMock = taskApi()
    const user = userEvent.setup()
    renderRoute('/')
    const dialog = await openDialog(user)

    await user.type(within(dialog).getByLabelText(/^Title/), 'Minimal')
    await user.click(within(dialog).getByRole('button', { name: 'Create Task' }))

    await waitFor(() => expect(postCalls(fetchMock)).toHaveLength(1))
    expect(JSON.parse(postCalls(fetchMock)[0][1].body)).toEqual({
      title: 'Minimal',
      description: '',
      status: 'To Do',
      priority: 'Medium',
      labels: [],
      dueDate: null,
      assignee: null,
    })
  })

  it('shows server validation errors next to fields and keeps the entered values', async () => {
    taskApi({
      onPost: () =>
        jsonResponse(
          { error: { message: 'Validation failed', details: [{ path: 'title', message: 'Title is required' }] } },
          400,
        ),
    })
    const user = userEvent.setup()
    renderRoute('/')
    const dialog = await openDialog(user)
    const form = within(dialog)

    await user.type(form.getByLabelText(/^Title/), 'Keep me')
    await user.type(form.getByLabelText('Labels'), 'a, b')
    await user.click(form.getByRole('button', { name: 'Create Task' }))

    expect(await form.findByText('Title is required')).toBeInTheDocument()
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(form.getByLabelText(/^Title/)).toHaveValue('Keep me')
    expect(form.getByLabelText('Labels')).toHaveValue('a, b')
    expect(form.getByRole('button', { name: 'Create Task' })).toBeEnabled()
  })

  it('shows other client errors from the server, keeping the values', async () => {
    taskApi({ onPost: () => jsonResponse({ error: { message: 'Your session is invalid or has expired.' } }, 401) })
    const user = userEvent.setup()
    renderRoute('/')
    const dialog = await openDialog(user)

    await user.type(within(dialog).getByLabelText(/^Title/), 'Keep me')
    await user.click(within(dialog).getByRole('button', { name: 'Create Task' }))

    expect(await within(dialog).findByRole('alert')).toHaveTextContent('Your session is invalid or has expired.')
    expect(within(dialog).getByLabelText(/^Title/)).toHaveValue('Keep me')
  })

  it('hides internal details of server failures behind a generic message', async () => {
    taskApi({ onPost: () => jsonResponse({ error: { message: 'MongoServerError: secret detail' } }, 500) })
    const user = userEvent.setup()
    renderRoute('/')
    const dialog = await openDialog(user)

    await user.type(within(dialog).getByLabelText(/^Title/), 'Keep me')
    await user.click(within(dialog).getByRole('button', { name: 'Create Task' }))

    const alert = await within(dialog).findByRole('alert')
    expect(alert).toHaveTextContent('Something went wrong on our side')
    expect(alert).not.toHaveTextContent('secret detail')
  })

  it('shows a network error, keeps the values, and allows retrying', async () => {
    let attempts = 0
    const fetchMock = taskApi({
      onPost: (options, tasks) => {
        attempts += 1
        if (attempts === 1) throw new TypeError('Failed to fetch')
        const task = makeTask({ id: 't2', ...JSON.parse(options.body) })
        tasks.unshift(task)
        return jsonResponse({ task }, 201)
      },
    })
    const user = userEvent.setup()
    renderRoute('/')
    const dialog = await openDialog(user)

    await user.type(within(dialog).getByLabelText(/^Title/), 'Retry me')
    await user.click(within(dialog).getByRole('button', { name: 'Create Task' }))

    expect(await within(dialog).findByRole('alert')).toHaveTextContent('Could not reach the server')
    expect(within(dialog).getByLabelText(/^Title/)).toHaveValue('Retry me')

    await user.click(within(dialog).getByRole('button', { name: 'Create Task' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(postCalls(fetchMock)).toHaveLength(2)
  })

  it('disables the submit button while pending, so a task is never created twice', async () => {
    let release
    const fetchMock = taskApi({
      onPost: (options, tasks) =>
        new Promise((resolve) => {
          release = () => {
            const task = makeTask({ id: 't2', ...JSON.parse(options.body) })
            tasks.unshift(task)
            resolve(jsonResponse({ task }, 201))
          }
        }),
    })
    const user = userEvent.setup()
    renderRoute('/')
    const dialog = await openDialog(user)

    await user.type(within(dialog).getByLabelText(/^Title/), 'Once only{Enter}')

    const pending = await within(dialog).findByRole('button', { name: 'Creating…' })
    expect(pending).toBeDisabled()
    await user.type(within(dialog).getByLabelText(/^Title/), '{Enter}')
    expect(postCalls(fetchMock)).toHaveLength(1)

    release()
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(postCalls(fetchMock)).toHaveLength(1)
  })

  it('cancels without calling the API and starts empty the next time', async () => {
    const fetchMock = taskApi()
    const user = userEvent.setup()
    renderRoute('/')
    let dialog = await openDialog(user)

    await user.type(within(dialog).getByLabelText(/^Title/), 'Discard me')
    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(postCalls(fetchMock)).toHaveLength(0)

    dialog = await openDialog(user)
    expect(within(dialog).getByLabelText(/^Title/)).toHaveValue('')
  })

  it('closes on Escape', async () => {
    taskApi()
    const user = userEvent.setup()
    renderRoute('/')
    await openDialog(user)

    await user.keyboard('{Escape}')

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  })

  it('keeps filters, warns that the task may be hidden, and offers a way to see it', async () => {
    const fetchMock = taskApi()
    const user = userEvent.setup()
    renderRoute('/')
    await screen.findByText('Existing task')
    await user.selectOptions(screen.getByLabelText('Priority'), 'Low')
    const dialog = await openDialog(user)

    await user.type(within(dialog).getByLabelText(/^Title/), 'High one')
    await user.click(within(dialog).getByRole('button', { name: 'Create Task' }))

    const notice = await screen.findByRole('status')
    expect(notice).toHaveTextContent('may not appear in the current view')
    expect(screen.getByLabelText('Priority')).toHaveValue('Low')

    await user.click(within(notice).getByRole('button', { name: 'Show newest tasks' }))

    expect(screen.getByLabelText('Priority')).toHaveValue('')
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
    const lastGet = fetchMock.mock.calls.filter(([url]) => String(url).startsWith('/api/tasks?')).at(-1)[0]
    expect(lastGet).toBe('/api/tasks?page=1&limit=10')
  })
})
