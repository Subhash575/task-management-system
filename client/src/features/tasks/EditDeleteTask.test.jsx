import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { jsonResponse, renderRoute, stubApi, testUser } from '@/test/renderWithProviders'

const signedIn = () => jsonResponse({ user: testUser })
const ada = { id: 'u1', name: 'Ada Lovelace', email: 'ada@example.com' } // the signed-in user (testUser)
const bob = { id: 'u2', name: 'Bob Builder', email: 'bob@example.com' }

function makeTask(overrides = {}) {
  return {
    id: 't1',
    title: 'Design login screen',
    description: 'Mockups for sign in',
    status: 'In Progress',
    priority: 'High',
    creator: ada,
    assignee: null,
    labels: ['ui', 'design'],
    dueDate: '2030-06-30T00:00:00.000Z',
    ...overrides,
  }
}

/**
 * An in-memory task API: GET (with real paging of 10), PATCH and DELETE change the stored list,
 * so "the list refreshes" is proven by the next GET returning different data.
 */
function taskApi(initialTasks, { onPatch, onDelete } = {}) {
  const tasks = [...initialTasks]
  const fetchMock = stubApi({
    'GET /auth/me': signedIn,
    'GET /tasks': (_options, url) => {
      const pageNumber = Number(new URL(url, 'http://localhost').searchParams.get('page'))
      const slice = tasks.slice((pageNumber - 1) * 10, pageNumber * 10)
      return jsonResponse({
        tasks: slice,
        pagination: { page: pageNumber, limit: 10, total: tasks.length, totalPages: Math.ceil(tasks.length / 10) },
      })
    },
  })
  // stubApi matches "METHOD /path/:id" keys exactly, so wrap fetch to route the id-based calls.
  const base = fetchMock.getMockImplementation()
  fetchMock.mockImplementation(async (url, options = {}) => {
    const match = String(url).match(/^\/api\/tasks\/([^/?]+)$/)
    if (match && options.method === 'PATCH') {
      if (onPatch) return onPatch(options, tasks, match[1])
      const task = tasks.find((t) => t.id === match[1])
      Object.assign(task, JSON.parse(options.body))
      return jsonResponse({ task })
    }
    if (match && options.method === 'DELETE') {
      if (onDelete) return onDelete(options, tasks, match[1])
      tasks.splice(
        tasks.findIndex((t) => t.id === match[1]),
        1,
      )
      return new Response(null, { status: 204 })
    }
    return base(url, options)
  })
  return fetchMock
}

const callsFor = (fetchMock, method) =>
  fetchMock.mock.calls.filter(([url, o]) => /^\/api\/tasks\/[^/?]+$/.test(String(url)) && o.method === method)

async function openEdit(user, title = 'Design login screen') {
  await user.click(await screen.findByRole('button', { name: `Edit task: ${title}` }))
  return screen.findByRole('dialog', { name: 'Edit task' })
}

describe('edit task', () => {
  it('opens pre-filled with the current values', async () => {
    taskApi([makeTask()])
    const user = userEvent.setup()
    renderRoute('/')

    const dialog = within(await openEdit(user))

    expect(dialog.getByLabelText(/^Title/)).toHaveValue('Design login screen')
    expect(dialog.getByLabelText('Description')).toHaveValue('Mockups for sign in')
    expect(dialog.getByLabelText('Status')).toHaveValue('In Progress')
    expect(dialog.getByLabelText('Priority')).toHaveValue('High')
    expect(dialog.getByLabelText('Labels')).toHaveValue('ui, design')
    expect(dialog.getByLabelText('Due date')).toHaveValue('2030-06-30')
    expect(dialog.queryByLabelText('Assignee')).not.toBeInTheDocument()
  })

  it('sends only the changed fields, closes, and refreshes the list', async () => {
    const fetchMock = taskApi([makeTask()])
    const user = userEvent.setup()
    renderRoute('/')
    const dialog = within(await openEdit(user))

    await user.clear(dialog.getByLabelText(/^Title/))
    await user.click(dialog.getByLabelText(/^Title/))
    await user.paste('  Redesign login  ')
    await user.selectOptions(dialog.getByLabelText('Status'), 'In Review')
    await user.click(dialog.getByRole('button', { name: 'Save changes' }))

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(callsFor(fetchMock, 'PATCH')).toHaveLength(1)
    const [url, options] = callsFor(fetchMock, 'PATCH')[0]
    expect(url).toBe('/api/tasks/t1')
    expect(options).toMatchObject({ method: 'PATCH', credentials: 'include' })
    expect(JSON.parse(options.body)).toEqual({ title: 'Redesign login', status: 'In Review' })

    expect(await screen.findByRole('heading', { level: 2, name: 'Redesign login' })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Design login screen' })).not.toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent('Task “Redesign login” was updated.')
  })

  it('can clear the due date, description and labels', async () => {
    const fetchMock = taskApi([makeTask()])
    const user = userEvent.setup()
    renderRoute('/')
    const dialog = within(await openEdit(user))

    await user.clear(dialog.getByLabelText('Due date'))
    await user.clear(dialog.getByLabelText('Description'))
    await user.clear(dialog.getByLabelText('Labels'))
    await user.click(dialog.getByRole('button', { name: 'Save changes' }))

    await waitFor(() => expect(callsFor(fetchMock, 'PATCH')).toHaveLength(1))
    expect(JSON.parse(callsFor(fetchMock, 'PATCH')[0][1].body)).toEqual({
      dueDate: null,
      description: '',
      labels: [],
    })
  })

  it('never sends creator or assignee', async () => {
    const fetchMock = taskApi([makeTask({ assignee: bob })])
    const user = userEvent.setup()
    renderRoute('/')
    const dialog = within(await openEdit(user))

    await user.selectOptions(dialog.getByLabelText('Priority'), 'Low')
    await user.click(dialog.getByRole('button', { name: 'Save changes' }))

    await waitFor(() => expect(callsFor(fetchMock, 'PATCH')).toHaveLength(1))
    const body = JSON.parse(callsFor(fetchMock, 'PATCH')[0][1].body)
    expect(body).toEqual({ priority: 'Low' })
    expect(body).not.toHaveProperty('creator')
    expect(body).not.toHaveProperty('assignee')
  })

  it('closes without a request when nothing changed', async () => {
    const fetchMock = taskApi([makeTask()])
    const user = userEvent.setup()
    renderRoute('/')
    const dialog = within(await openEdit(user))

    await user.click(dialog.getByRole('button', { name: 'Save changes' }))

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(callsFor(fetchMock, 'PATCH')).toHaveLength(0)
  })

  it('validates the title on the client without calling the API', async () => {
    const fetchMock = taskApi([makeTask()])
    const user = userEvent.setup()
    renderRoute('/')
    const dialog = within(await openEdit(user))

    await user.clear(dialog.getByLabelText(/^Title/))
    await user.click(dialog.getByRole('button', { name: 'Save changes' }))

    expect(dialog.getByText('Title is required')).toBeInTheDocument()
    expect(dialog.getByLabelText(/^Title/)).toHaveAttribute('aria-invalid', 'true')
    expect(callsFor(fetchMock, 'PATCH')).toHaveLength(0)
  })

  it('shows server validation errors next to the field and keeps the values', async () => {
    taskApi([makeTask()], {
      onPatch: () =>
        jsonResponse(
          { error: { message: 'Validation failed', details: [{ path: 'labels', message: 'Use fewer labels' }] } },
          400,
        ),
    })
    const user = userEvent.setup()
    renderRoute('/')
    const dialog = within(await openEdit(user))

    await user.clear(dialog.getByLabelText('Labels'))
    await user.click(dialog.getByLabelText('Labels'))
    await user.paste('keep, me')
    await user.click(dialog.getByRole('button', { name: 'Save changes' }))

    expect(await dialog.findByText('Use fewer labels')).toBeInTheDocument()
    expect(dialog.getByLabelText('Labels')).toHaveValue('keep, me')
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(dialog.getByRole('button', { name: 'Save changes' })).toBeEnabled()
  })

  it.each([
    ['403 from the API', () => jsonResponse({ error: { message: 'Assignees can only update the status of a task' } }, 403), 'Assignees can only update the status of a task'],
    ['404 from the API', () => jsonResponse({ error: { message: 'Task not found' } }, 404), 'Task not found'],
    ['500 from the API', () => jsonResponse({ error: { message: 'MongoServerError: secret' } }, 500), 'Something went wrong on our side'],
    [
      'a network failure',
      () => {
        throw new TypeError('Failed to fetch')
      },
      'Could not reach the server',
    ],
  ])('shows a safe message for %s and keeps the values', async (_name, onPatch, expected) => {
    taskApi([makeTask()], { onPatch })
    const user = userEvent.setup()
    renderRoute('/')
    const dialog = within(await openEdit(user))

    await user.selectOptions(dialog.getByLabelText('Priority'), 'Critical')
    await user.click(dialog.getByRole('button', { name: 'Save changes' }))

    const alert = await dialog.findByRole('alert')
    expect(alert).toHaveTextContent(expected)
    expect(alert).not.toHaveTextContent('secret')
    expect(dialog.getByLabelText('Priority')).toHaveValue('Critical')
  })

  it('disables the submit button while pending, so only one request is sent', async () => {
    let release
    const fetchMock = taskApi([makeTask()], {
      onPatch: (options, tasks) =>
        new Promise((resolve) => {
          release = () => {
            Object.assign(tasks[0], JSON.parse(options.body))
            resolve(jsonResponse({ task: tasks[0] }))
          }
        }),
    })
    const user = userEvent.setup()
    renderRoute('/')
    const dialog = within(await openEdit(user))

    await user.selectOptions(dialog.getByLabelText('Priority'), 'Low')
    await user.type(dialog.getByLabelText(/^Title/), '{Enter}')

    expect(await dialog.findByRole('button', { name: 'Saving…' })).toBeDisabled()
    await user.type(dialog.getByLabelText(/^Title/), '{Enter}')
    expect(callsFor(fetchMock, 'PATCH')).toHaveLength(1)

    release()
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(callsFor(fetchMock, 'PATCH')).toHaveLength(1)
  })

  it('cancels without a request and shows each task\'s own values the next time', async () => {
    const fetchMock = taskApi([makeTask(), makeTask({ id: 't2', title: 'Second task', description: 'Other' })])
    const user = userEvent.setup()
    renderRoute('/')
    let dialog = within(await openEdit(user))

    await user.clear(dialog.getByLabelText(/^Title/))
    await user.click(dialog.getByLabelText(/^Title/))
    await user.paste('Discarded edit')
    await user.click(dialog.getByRole('button', { name: 'Cancel' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())

    dialog = within(await openEdit(user, 'Second task'))
    expect(dialog.getByLabelText(/^Title/)).toHaveValue('Second task')
    expect(dialog.getByLabelText('Description')).toHaveValue('Other')
    expect(callsFor(fetchMock, 'PATCH')).toHaveLength(0)
  })
})

describe('permissions in the UI', () => {
  it('offers Edit and Delete to the creator', async () => {
    taskApi([makeTask()])
    renderRoute('/')

    expect(await screen.findByRole('button', { name: 'Edit task: Design login screen' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Delete task: Design login screen' })).toBeInTheDocument()
  })

  it('lets an assignee change only the status, and offers no Delete', async () => {
    const fetchMock = taskApi([makeTask({ creator: bob, assignee: ada })])
    const user = userEvent.setup()
    renderRoute('/')

    expect(await screen.findByRole('button', { name: 'Edit task: Design login screen' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /^Delete task/ })).not.toBeInTheDocument()

    const dialog = within(await openEdit(user))
    expect(dialog.getByText(/you can only change its status/)).toBeInTheDocument()
    expect(dialog.queryByLabelText(/^Title/)).not.toBeInTheDocument()
    expect(dialog.queryByLabelText('Priority')).not.toBeInTheDocument()

    await user.selectOptions(dialog.getByLabelText('Status'), 'Completed')
    await user.click(dialog.getByRole('button', { name: 'Save changes' }))

    await waitFor(() => expect(callsFor(fetchMock, 'PATCH')).toHaveLength(1))
    expect(JSON.parse(callsFor(fetchMock, 'PATCH')[0][1].body)).toEqual({ status: 'Completed' })
  })

  it('shows no actions on a task the user neither created nor is assigned to', async () => {
    taskApi([makeTask({ creator: bob, assignee: { id: 'u3', name: 'Cy', email: 'cy@example.com' } })])
    renderRoute('/')

    await screen.findByRole('heading', { name: 'Design login screen' })
    expect(screen.queryByRole('button', { name: /^Edit task/ })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /^Delete task/ })).not.toBeInTheDocument()
  })
})

describe('delete task', () => {
  async function openDelete(user, title = 'Design login screen') {
    await user.click(await screen.findByRole('button', { name: `Delete task: ${title}` }))
    return screen.findByRole('alertdialog')
  }

  it('asks for confirmation and does nothing when cancelled', async () => {
    const fetchMock = taskApi([makeTask()])
    const user = userEvent.setup()
    renderRoute('/')

    const dialog = within(await openDelete(user))
    expect(dialog.getByText(/“Design login screen” will be permanently deleted/)).toBeInTheDocument()
    await user.click(dialog.getByRole('button', { name: 'Cancel' }))

    await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument())
    expect(callsFor(fetchMock, 'DELETE')).toHaveLength(0)
    expect(screen.getByRole('heading', { name: 'Design login screen' })).toBeInTheDocument()
  })

  it('deletes after confirmation, closes, and refreshes the list', async () => {
    const fetchMock = taskApi([makeTask(), makeTask({ id: 't2', title: 'Keep me' })])
    const user = userEvent.setup()
    renderRoute('/')

    const dialog = within(await openDelete(user))
    await user.click(dialog.getByRole('button', { name: 'Delete' }))

    await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument())
    const [url, options] = callsFor(fetchMock, 'DELETE')[0]
    expect(url).toBe('/api/tasks/t1')
    expect(options).toMatchObject({ method: 'DELETE', credentials: 'include' })
    await waitFor(() => expect(screen.queryByRole('heading', { name: 'Design login screen' })).not.toBeInTheDocument())
    expect(screen.getByRole('heading', { name: 'Keep me' })).toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent('Task “Design login screen” was deleted.')
  })

  it('shows the empty state after deleting the only task', async () => {
    taskApi([makeTask()])
    const user = userEvent.setup()
    renderRoute('/')

    await user.click(within(await openDelete(user)).getByRole('button', { name: 'Delete' }))

    expect(await screen.findByRole('heading', { name: 'No tasks yet' })).toBeInTheDocument()
  })

  it('stays open with an error when deletion fails, and can be retried', async () => {
    let attempts = 0
    const fetchMock = taskApi([makeTask()], {
      onDelete: (_options, tasks) => {
        attempts += 1
        if (attempts === 1) return jsonResponse({ error: { message: 'Only the creator can delete this task' } }, 403)
        tasks.splice(0, 1)
        return new Response(null, { status: 204 })
      },
    })
    const user = userEvent.setup()
    renderRoute('/')

    const dialog = within(await openDelete(user))
    await user.click(dialog.getByRole('button', { name: 'Delete' }))

    expect(await dialog.findByRole('alert')).toHaveTextContent('Only the creator can delete this task')
    expect(screen.getByRole('alertdialog')).toBeInTheDocument()

    await user.click(dialog.getByRole('button', { name: 'Delete' }))
    await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument())
    expect(callsFor(fetchMock, 'DELETE')).toHaveLength(2)
  })

  it.each([
    ['a 404', () => jsonResponse({ error: { message: 'Task not found' } }, 404), 'Task not found'],
    ['a 500', () => jsonResponse({ error: { message: 'MongoServerError: secret' } }, 500), 'Something went wrong on our side'],
    [
      'a network failure',
      () => {
        throw new TypeError('Failed to fetch')
      },
      'Could not reach the server',
    ],
  ])('shows a safe message for %s', async (_name, onDelete, expected) => {
    taskApi([makeTask()], { onDelete })
    const user = userEvent.setup()
    renderRoute('/')

    const dialog = within(await openDelete(user))
    await user.click(dialog.getByRole('button', { name: 'Delete' }))

    const alert = await dialog.findByRole('alert')
    expect(alert).toHaveTextContent(expected)
    expect(alert).not.toHaveTextContent('secret')
  })

  it('disables the buttons while pending, so only one request is sent', async () => {
    let release
    const fetchMock = taskApi([makeTask()], {
      onDelete: (_options, tasks) =>
        new Promise((resolve) => {
          release = () => {
            tasks.splice(0, 1)
            resolve(new Response(null, { status: 204 }))
          }
        }),
    })
    const user = userEvent.setup()
    renderRoute('/')

    const dialog = within(await openDelete(user))
    await user.click(dialog.getByRole('button', { name: 'Delete' }))

    const pending = await dialog.findByRole('button', { name: 'Deleting…' })
    expect(pending).toBeDisabled()
    expect(dialog.getByRole('button', { name: 'Cancel' })).toBeDisabled()
    expect(callsFor(fetchMock, 'DELETE')).toHaveLength(1)

    release()
    await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument())
  })

  it('steps back a page after deleting the last task on the last page', async () => {
    const tasks = Array.from({ length: 11 }, (_, i) => makeTask({ id: `t${i + 1}`, title: `Task ${i + 1}` }))
    const fetchMock = taskApi(tasks)
    const user = userEvent.setup()
    renderRoute('/')

    await user.click(await screen.findByRole('button', { name: /next/i }))
    expect(await screen.findByRole('heading', { name: 'Task 11' })).toBeInTheDocument()
    expect(screen.getByText('Page 2 of 2 · 11 tasks')).toBeInTheDocument()

    await user.click(within(await openDelete(user, 'Task 11')).getByRole('button', { name: 'Delete' }))

    expect(await screen.findByText('Page 1 of 1 · 10 tasks')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Task 1' })).toBeInTheDocument()
    expect(screen.queryByText(/No tasks/)).not.toBeInTheDocument()
    expect(callsFor(fetchMock, 'DELETE')).toHaveLength(1)
  })
})
