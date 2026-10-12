import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { jsonResponse, renderRoute, stubApi, testUser } from '@/test/renderWithProviders'

const signedIn = () => jsonResponse({ user: testUser })
const ada = { id: 'u1', name: 'Ada Lovelace', email: 'ada@example.com' } // the signed-in user
const bob = { id: 'u2', name: 'Bob Builder', email: 'bob@example.com' }
const cy = { id: 'u3', name: 'Cy Young', email: 'cy@example.com' }

function makeTask(overrides = {}) {
  return {
    id: 't1',
    title: 'Design login screen',
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

/** Serves one task, a configurable /users response, and records PATCH/POST bodies. */
function api({ task = makeTask(), users = () => jsonResponse({ users: [ada, bob, cy] }), onPatch, onPost } = {}) {
  const fetchMock = stubApi({
    'GET /auth/me': signedIn,
    'GET /users': users,
    'GET /tasks': () =>
      jsonResponse({ tasks: [task], pagination: { page: 1, limit: 10, total: 1, totalPages: 1 } }),
    'POST /tasks': (options) => onPost?.(options) ?? jsonResponse({ task: { ...task, ...JSON.parse(options.body) } }, 201),
  })
  const base = fetchMock.getMockImplementation()
  fetchMock.mockImplementation(async (url, options = {}) => {
    if (options.method === 'PATCH') {
      return onPatch?.(options) ?? jsonResponse({ task: { ...task, ...JSON.parse(options.body) } })
    }
    return base(url, options)
  })
  return fetchMock
}

const bodyOf = (fetchMock, method) =>
  JSON.parse(fetchMock.mock.calls.find(([, o]) => o?.method === method)[1].body)
const userCalls = (fetchMock) => fetchMock.mock.calls.filter(([url]) => String(url).startsWith('/api/users'))

async function openCreate(user) {
  await user.click(await screen.findByRole('button', { name: 'Create Task' }))
  return within(await screen.findByRole('dialog', { name: 'Create task' }))
}

async function openEdit(user) {
  await user.click(await screen.findByRole('button', { name: 'Edit task: Design login screen' }))
  return within(await screen.findByRole('dialog', { name: 'Edit task' }))
}

describe('assignee selector', () => {
  it('shows a loading state, then the registered users', async () => {
    let release
    const fetchMock = api({
      users: () =>
        new Promise((resolve) => {
          release = () => resolve(jsonResponse({ users: [ada, bob] }))
        }),
    })
    const user = userEvent.setup()
    renderRoute('/')
    const dialog = await openCreate(user)

    expect(dialog.getByLabelText('Assignee')).toBeDisabled()
    expect(dialog.getByText('Loading users…')).toBeInTheDocument()

    release()

    expect(await dialog.findByRole('option', { name: 'Bob Builder (bob@example.com)' })).toBeInTheDocument()
    expect(dialog.getByLabelText('Assignee')).toBeEnabled()
    expect(dialog.getByRole('option', { name: 'Unassigned' })).toBeInTheDocument()
    expect(dialog.queryByText('Loading users…')).not.toBeInTheDocument()
    expect(fetchMock).toHaveBeenCalledWith('/api/users', expect.objectContaining({ credentials: 'include' }))
  })

  it('assigns a new task to the chosen user', async () => {
    const fetchMock = api()
    const user = userEvent.setup()
    renderRoute('/')
    const dialog = await openCreate(user)

    await dialog.findByRole('option', { name: /Bob Builder/ })
    await user.selectOptions(dialog.getByLabelText('Assignee'), 'u2')
    await user.click(dialog.getByLabelText(/^Title/))
    await user.paste('Assigned task')
    await user.click(dialog.getByRole('button', { name: 'Create Task' }))

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(bodyOf(fetchMock, 'POST')).toMatchObject({ title: 'Assigned task', assignee: 'u2' })
    expect(bodyOf(fetchMock, 'POST')).not.toHaveProperty('creator')
  })

  it('creates an unassigned task by default', async () => {
    const fetchMock = api()
    const user = userEvent.setup()
    renderRoute('/')
    const dialog = await openCreate(user)

    await user.click(dialog.getByLabelText(/^Title/))
    await user.paste('Nobody yet')
    await user.click(dialog.getByRole('button', { name: 'Create Task' }))

    await waitFor(() => expect(bodyOf(fetchMock, 'POST')).toMatchObject({ assignee: null }))
  })

  it('pre-selects the current assignee when editing, and changes it', async () => {
    const fetchMock = api({ task: makeTask({ assignee: bob }) })
    const user = userEvent.setup()
    renderRoute('/')
    const dialog = await openEdit(user)

    expect(dialog.getByLabelText('Assignee')).toHaveValue('u2')
    await dialog.findByRole('option', { name: /Cy Young/ })
    await user.selectOptions(dialog.getByLabelText('Assignee'), 'u3')
    await user.click(dialog.getByRole('button', { name: 'Save changes' }))

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(bodyOf(fetchMock, 'PATCH')).toEqual({ assignee: 'u3' })
  })

  it('clears the assignee by choosing Unassigned', async () => {
    const fetchMock = api({ task: makeTask({ assignee: bob }) })
    const user = userEvent.setup()
    renderRoute('/')
    const dialog = await openEdit(user)

    await dialog.findByRole('option', { name: /Cy Young/ })
    await user.selectOptions(dialog.getByLabelText('Assignee'), '')
    await user.click(dialog.getByRole('button', { name: 'Save changes' }))

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(bodyOf(fetchMock, 'PATCH')).toEqual({ assignee: null })
  })

  it('does not send the assignee when it was not changed', async () => {
    const fetchMock = api({ task: makeTask({ assignee: bob }) })
    const user = userEvent.setup()
    renderRoute('/')
    const dialog = await openEdit(user)

    await user.selectOptions(dialog.getByLabelText('Priority'), 'High')
    await user.click(dialog.getByRole('button', { name: 'Save changes' }))

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(bodyOf(fetchMock, 'PATCH')).toEqual({ priority: 'High' })
  })

  it('keeps the current assignee as an option when they are missing from the list', async () => {
    api({ task: makeTask({ assignee: cy }), users: () => jsonResponse({ users: [ada, bob] }) })
    const user = userEvent.setup()
    renderRoute('/')
    const dialog = await openEdit(user)

    await dialog.findByRole('option', { name: /Bob Builder/ })
    expect(dialog.getByRole('option', { name: 'Cy Young (cy@example.com)' })).toBeInTheDocument()
    expect(dialog.getByLabelText('Assignee')).toHaveValue('u3')
  })

  it('shows an empty state when there are no users', async () => {
    api({ users: () => jsonResponse({ users: [] }) })
    const user = userEvent.setup()
    renderRoute('/')
    const dialog = await openCreate(user)

    expect(await dialog.findByText('No registered users found.')).toBeInTheDocument()
    expect(dialog.getByRole('option', { name: 'Unassigned' })).toBeInTheDocument()
  })

  it('shows an error with retry when users cannot be loaded, and the rest of the form still works', async () => {
    let calls = 0
    const fetchMock = api({
      users: () => {
        calls += 1
        return calls === 1 ? jsonResponse({ error: { message: 'Internal server error' } }, 500) : jsonResponse({ users: [ada, bob] })
      },
    })
    const user = userEvent.setup()
    renderRoute('/')
    const dialog = await openCreate(user)

    expect(await dialog.findByText('Could not load users.')).toBeInTheDocument()
    expect(dialog.getByLabelText('Assignee')).toBeDisabled()

    // The task can still be created, unassigned.
    await user.click(dialog.getByLabelText(/^Title/))
    await user.paste('Still works')
    await user.click(dialog.getByRole('button', { name: 'Create Task' }))
    await waitFor(() => expect(bodyOf(fetchMock, 'POST')).toMatchObject({ title: 'Still works', assignee: null }))
  })

  it('retries loading users', async () => {
    let calls = 0
    api({
      users: () => {
        calls += 1
        if (calls === 1) throw new TypeError('Failed to fetch')
        return jsonResponse({ users: [ada, bob] })
      },
    })
    const user = userEvent.setup()
    renderRoute('/')
    const dialog = await openCreate(user)

    await user.click(await dialog.findByRole('button', { name: /retry/i }))

    expect(await dialog.findByRole('option', { name: /Bob Builder/ })).toBeInTheDocument()
    expect(dialog.getByLabelText('Assignee')).toBeEnabled()
    expect(dialog.queryByText('Could not load users.')).not.toBeInTheDocument()
  })

  it('keeps the current assignee selected when the list fails to load while editing', async () => {
    const fetchMock = api({
      task: makeTask({ assignee: bob }),
      users: () => jsonResponse({ error: { message: 'Internal server error' } }, 500),
    })
    const user = userEvent.setup()
    renderRoute('/')
    const dialog = await openEdit(user)

    expect(await dialog.findByText('Could not load users.')).toBeInTheDocument()
    expect(dialog.getByLabelText('Assignee')).toHaveValue('u2')

    await user.selectOptions(dialog.getByLabelText('Priority'), 'Low')
    await user.click(dialog.getByRole('button', { name: 'Save changes' }))
    await waitFor(() => expect(bodyOf(fetchMock, 'PATCH')).toEqual({ priority: 'Low' }))
  })

  it('shows the server error inline when the assignee is rejected', async () => {
    api({
      onPost: () =>
        jsonResponse(
          { error: { message: 'Validation failed', details: [{ path: 'assignee', message: 'Assignee does not exist' }] } },
          400,
        ),
    })
    const user = userEvent.setup()
    renderRoute('/')
    const dialog = await openCreate(user)

    await dialog.findByRole('option', { name: /Bob Builder/ })
    await user.selectOptions(dialog.getByLabelText('Assignee'), 'u2')
    await user.click(dialog.getByLabelText(/^Title/))
    await user.paste('Rejected')
    await user.click(dialog.getByRole('button', { name: 'Create Task' }))

    expect(await dialog.findByText('Assignee does not exist')).toBeInTheDocument()
    expect(dialog.getByLabelText('Assignee')).toHaveAttribute('aria-invalid', 'true')
    expect(dialog.getByLabelText('Assignee')).toHaveValue('u2')
  })
})

describe('assignee permissions', () => {
  it('gives an assignee a status-only form with no assignee control and no user lookup', async () => {
    const fetchMock = api({ task: makeTask({ creator: bob, assignee: ada }) })
    const user = userEvent.setup()
    renderRoute('/')
    const dialog = await openEdit(user)

    expect(dialog.getByLabelText('Status')).toBeInTheDocument()
    expect(dialog.queryByLabelText('Assignee')).not.toBeInTheDocument()
    expect(dialog.queryByLabelText(/^Title/)).not.toBeInTheDocument()
    expect(userCalls(fetchMock)).toHaveLength(0)

    await user.selectOptions(dialog.getByLabelText('Status'), 'Completed')
    await user.click(dialog.getByRole('button', { name: 'Save changes' }))
    await waitFor(() => expect(bodyOf(fetchMock, 'PATCH')).toEqual({ status: 'Completed' }))
  })
})
