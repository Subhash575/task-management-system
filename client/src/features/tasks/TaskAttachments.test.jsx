import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { jsonResponse, renderRoute, stubApi, testUser } from '@/test/renderWithProviders'

const signedIn = () => jsonResponse({ user: testUser })
const ada = { id: 'u1', name: 'Ada Lovelace', email: 'ada@example.com' } // the signed-in user
const bob = { id: 'u2', name: 'Bob Builder', email: 'bob@example.com' }

const fmt = (iso) => new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(iso))

function makeAttachment(overrides = {}) {
  return {
    id: 'a1',
    filename: 'spec.pdf',
    mimeType: 'application/pdf',
    size: 2048,
    uploadedBy: ada,
    createdAt: '2030-03-04T12:00:00.000Z',
    ...overrides,
  }
}

function makeTask(attachments, overrides = {}) {
  return {
    id: 't1',
    title: 'Write the spec',
    description: '',
    status: 'To Do',
    priority: 'Medium',
    creator: ada,
    assignee: bob,
    labels: [],
    dueDate: null,
    createdAt: '2030-01-02T09:30:00.000Z',
    updatedAt: '2030-01-02T09:30:00.000Z',
    statusHistory: [],
    attachments,
    ...overrides,
  }
}

/** A stateful mini API: POST adds an attachment, DELETE removes one, and the detail GET reflects both. */
function api(initial, { task = {}, onPost, onDelete } = {}) {
  const attachments = [...initial]
  const fetchMock = stubApi({
    'GET /auth/me': signedIn,
    'GET /tasks/t1': () => jsonResponse({ task: makeTask(attachments, task) }),
    'POST /tasks/t1/attachments': (options) => {
      if (onPost) return onPost(options, attachments)
      const file = options.body.get('file')
      const attachment = makeAttachment({ id: `new-${attachments.length}`, filename: file.name, size: file.size })
      attachments.push(attachment)
      return jsonResponse({ attachment }, 201)
    },
  })
  const base = fetchMock.getMockImplementation()
  fetchMock.mockImplementation(async (url, options = {}) => {
    const match = String(url).match(/^\/api\/tasks\/t1\/attachments\/([^/?]+)$/)
    if (match && options.method === 'DELETE') {
      if (onDelete) return onDelete(options, attachments, match[1])
      attachments.splice(
        attachments.findIndex((a) => a.id === match[1]),
        1,
      )
      return new Response(null, { status: 204 })
    }
    return base(url, options)
  })
  return { fetchMock, attachments }
}

const posts = (fetchMock) => fetchMock.mock.calls.filter(([, o]) => o?.method === 'POST')
const deletes = (fetchMock) => fetchMock.mock.calls.filter(([, o]) => o?.method === 'DELETE')
const png = (name = 'photo.png', size = 1000) => new File([new Uint8Array(size)], name, { type: 'image/png' })

async function openPage() {
  renderRoute('/tasks/t1')
  await screen.findByRole('heading', { level: 1, name: 'Write the spec' })
}
const chooser = () => screen.getByLabelText('Add an attachment')

describe('attachment list', () => {
  it('shows an empty state when there are no attachments', async () => {
    api([])
    await openPage()

    expect(screen.getByRole('heading', { level: 2, name: 'Attachments' })).toBeInTheDocument()
    expect(screen.getByText('No attachments yet.')).toBeInTheDocument()
    expect(screen.queryByRole('list', { name: 'Attachments' })).not.toBeInTheDocument()
  })

  it('shows filename, size, uploader, date and a download link', async () => {
    api([makeAttachment({ size: 2048 }), makeAttachment({ id: 'a2', filename: 'big.png', size: 3 * 1024 * 1024, uploadedBy: bob })])
    await openPage()

    const items = within(screen.getByRole('list', { name: 'Attachments' })).getAllByRole('listitem')
    expect(items).toHaveLength(2)
    expect(items[0]).toHaveTextContent('spec.pdf')
    expect(items[0]).toHaveTextContent('2.0 KB')
    expect(items[0]).toHaveTextContent('Ada Lovelace')
    expect(within(items[0]).getByText(fmt('2030-03-04T12:00:00.000Z'))).toBeInTheDocument()
    expect(items[1]).toHaveTextContent('3.0 MB')
    expect(items[1]).toHaveTextContent('Bob Builder')

    const link = screen.getByRole('link', { name: 'Download spec.pdf' })
    expect(link).toHaveAttribute('href', '/api/tasks/t1/attachments/a1/download')
    expect(link).toHaveAttribute('download', 'spec.pdf')
  })
})

describe('uploading', () => {
  it('uploads the chosen file as multipart form data with the session cookie, then refreshes the list', async () => {
    const { fetchMock } = api([])
    const user = userEvent.setup()
    await openPage()

    await user.upload(chooser(), png('photo.png', 1500))
    expect(screen.getByText(/Selected:/)).toHaveTextContent('photo.png')
    await user.click(screen.getByRole('button', { name: 'Upload' }))

    expect(await screen.findByRole('status')).toHaveTextContent('“photo.png” was uploaded.')
    expect(await screen.findByRole('list', { name: 'Attachments' })).toHaveTextContent('photo.png')
    expect(screen.queryByText('No attachments yet.')).not.toBeInTheDocument()

    const [url, options] = posts(fetchMock)[0]
    expect(url).toBe('/api/tasks/t1/attachments')
    expect(options).toMatchObject({ method: 'POST', credentials: 'include' })
    expect(options.body).toBeInstanceOf(FormData)
    expect(options.body.get('file').name).toBe('photo.png')
    // The browser must add the multipart boundary itself, so no Content-Type is set by hand.
    expect(options.headers['Content-Type']).toBeUndefined()
    // The picker is cleared after success.
    expect(screen.queryByText(/Selected:/)).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Upload' })).toBeDisabled()
  })

  it('blocks unsupported files in the browser, without calling the API', async () => {
    const { fetchMock } = api([])
    const user = userEvent.setup({ applyAccept: false })
    await openPage()

    await user.upload(chooser(), new File(['x'], 'virus.exe', { type: 'application/x-msdownload' }))

    expect(screen.getByRole('alert')).toHaveTextContent('This file type is not supported')
    expect(chooser()).toHaveAttribute('aria-invalid', 'true')
    expect(screen.getByRole('button', { name: 'Upload' })).toBeDisabled()
    expect(posts(fetchMock)).toHaveLength(0)
  })

  it('blocks oversized and empty files in the browser', async () => {
    const { fetchMock } = api([])
    const user = userEvent.setup({ applyAccept: false })
    await openPage()

    await user.upload(chooser(), png('huge.png', 5 * 1024 * 1024 + 1))
    expect(screen.getByRole('alert')).toHaveTextContent('too large')
    expect(screen.getByRole('alert')).toHaveTextContent('5.0 MB')

    await user.upload(chooser(), png('empty.png', 0))
    expect(screen.getByRole('alert')).toHaveTextContent('The file is empty')
    expect(posts(fetchMock)).toHaveLength(0)
  })

  it('clears a chosen file with the Clear button', async () => {
    api([])
    const user = userEvent.setup()
    await openPage()

    await user.upload(chooser(), png())
    await user.click(screen.getByRole('button', { name: 'Clear' }))

    expect(screen.queryByText(/Selected:/)).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Upload' })).toBeDisabled()
  })

  it.each([
    ['415', jsonResponse({ error: { message: 'The file content does not match its file type' } }, 415), 'The file content does not match its file type'],
    ['413', jsonResponse({ error: { message: 'The file is too large. The maximum size is 5 MB' } }, 413), 'The file is too large'],
    ['404', jsonResponse({ error: { message: 'Task not found' } }, 404), 'Task not found'],
  ])('shows the server\'s %s message, keeps the file, and lets the user retry', async (_name, failure, expected) => {
    let calls = 0
    const { fetchMock } = api([], {
      onPost: (options, attachments) => {
        calls += 1
        if (calls === 1) return failure
        const attachment = makeAttachment({ id: 'ok', filename: options.body.get('file').name })
        attachments.push(attachment)
        return jsonResponse({ attachment }, 201)
      },
    })
    const user = userEvent.setup()
    await openPage()

    await user.upload(chooser(), png('retry.png'))
    await user.click(screen.getByRole('button', { name: 'Upload' }))

    expect(await screen.findByRole('alert')).toHaveTextContent(expected)
    expect(screen.getByRole('alert')).toHaveTextContent('Press Upload to try again')
    expect(screen.getByText(/Selected:/)).toHaveTextContent('retry.png')

    await user.click(screen.getByRole('button', { name: 'Upload' }))
    expect(await screen.findByText('“retry.png” was uploaded.')).toBeInTheDocument()
    expect(posts(fetchMock)).toHaveLength(2)
  })

  it('hides internal server details and handles network failures', async () => {
    let calls = 0
    api([], {
      onPost: () => {
        calls += 1
        if (calls === 1) return jsonResponse({ error: { message: 'MongoServerError: secret' } }, 500)
        throw new TypeError('Failed to fetch')
      },
    })
    const user = userEvent.setup()
    await openPage()

    await user.upload(chooser(), png())
    await user.click(screen.getByRole('button', { name: 'Upload' }))
    const first = await screen.findByRole('alert')
    expect(first).toHaveTextContent('Something went wrong on our side')
    expect(first).not.toHaveTextContent('secret')

    await user.click(screen.getByRole('button', { name: 'Upload' }))
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Could not reach the server'))
  })

  it('shows a pending state and sends the file only once', async () => {
    let release
    const { fetchMock } = api([], {
      onPost: (options, attachments) =>
        new Promise((resolve) => {
          release = () => {
            const attachment = makeAttachment({ id: 'p', filename: options.body.get('file').name })
            attachments.push(attachment)
            resolve(jsonResponse({ attachment }, 201))
          }
        }),
    })
    const user = userEvent.setup()
    await openPage()

    await user.upload(chooser(), png('slow.png'))
    await user.click(screen.getByRole('button', { name: 'Upload' }))

    const pending = await screen.findByRole('button', { name: 'Uploading…' })
    expect(pending).toBeDisabled()
    expect(chooser()).toBeDisabled()
    expect(screen.getByRole('status')).toHaveTextContent('Uploading “slow.png”')
    expect(posts(fetchMock)).toHaveLength(1)

    release()
    expect(await screen.findByText('“slow.png” was uploaded.')).toBeInTheDocument()
    expect(posts(fetchMock)).toHaveLength(1)
  })

  it('disables the chooser when the task already has 10 attachments', async () => {
    api(Array.from({ length: 10 }, (_, i) => makeAttachment({ id: `a${i}`, filename: `f${i}.pdf` })))
    await openPage()

    expect(chooser()).toBeDisabled()
    expect(screen.getByText(/maximum of 10 attachments/)).toBeInTheDocument()
  })
})

describe('deleting', () => {
  async function openDelete(user, filename) {
    await user.click(await screen.findByRole('button', { name: `Delete ${filename}` }))
    return within(await screen.findByRole('alertdialog'))
  }

  it('asks for confirmation and does nothing when cancelled', async () => {
    const { fetchMock } = api([makeAttachment()])
    const user = userEvent.setup()
    await openPage()

    const dialog = await openDelete(user, 'spec.pdf')
    expect(dialog.getByText(/“spec.pdf” will be permanently deleted/)).toBeInTheDocument()
    await user.click(dialog.getByRole('button', { name: 'Cancel' }))

    await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument())
    expect(deletes(fetchMock)).toHaveLength(0)
    expect(screen.getByText('spec.pdf')).toBeInTheDocument()
  })

  it('deletes after confirmation and refreshes the list', async () => {
    const { fetchMock } = api([makeAttachment(), makeAttachment({ id: 'a2', filename: 'keep.png' })])
    const user = userEvent.setup()
    await openPage()

    const dialog = await openDelete(user, 'spec.pdf')
    await user.click(dialog.getByRole('button', { name: 'Delete' }))

    await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument())
    expect(deletes(fetchMock)[0][0]).toBe('/api/tasks/t1/attachments/a1')
    expect(deletes(fetchMock)[0][1]).toMatchObject({ method: 'DELETE', credentials: 'include' })
    await waitFor(() => expect(screen.queryByText('spec.pdf', { selector: 'p' })).not.toBeInTheDocument())
    expect(screen.getByText('keep.png')).toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent('“spec.pdf” was deleted.')
  })

  it('shows an empty state after deleting the last attachment', async () => {
    api([makeAttachment()])
    const user = userEvent.setup()
    await openPage()

    await user.click((await openDelete(user, 'spec.pdf')).getByRole('button', { name: 'Delete' }))

    expect(await screen.findByText('No attachments yet.')).toBeInTheDocument()
  })

  it('stays open with the server\'s message when deletion is refused, and can be retried', async () => {
    let calls = 0
    const { fetchMock } = api([makeAttachment()], {
      onDelete: (_options, attachments) => {
        calls += 1
        if (calls === 1) {
          return jsonResponse({ error: { message: 'Only the task creator or the uploader can delete this attachment' } }, 403)
        }
        attachments.splice(0, 1)
        return new Response(null, { status: 204 })
      },
    })
    const user = userEvent.setup()
    await openPage()

    const dialog = await openDelete(user, 'spec.pdf')
    await user.click(dialog.getByRole('button', { name: 'Delete' }))

    expect(await dialog.findByRole('alert')).toHaveTextContent('Only the task creator or the uploader can delete')
    expect(screen.getByRole('alertdialog')).toBeInTheDocument()

    await user.click(dialog.getByRole('button', { name: 'Delete' }))
    await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument())
    expect(deletes(fetchMock)).toHaveLength(2)
  })

  it('hides server internals on a 500', async () => {
    api([makeAttachment()], { onDelete: () => jsonResponse({ error: { message: 'MongoServerError: secret' } }, 500) })
    const user = userEvent.setup()
    await openPage()

    const dialog = await openDelete(user, 'spec.pdf')
    await user.click(dialog.getByRole('button', { name: 'Delete' }))

    const alert = await dialog.findByRole('alert')
    expect(alert).toHaveTextContent('Something went wrong on our side')
    expect(alert).not.toHaveTextContent('secret')
  })

  it('disables both buttons while the delete is pending', async () => {
    let release
    const { fetchMock } = api([makeAttachment()], {
      onDelete: (_options, attachments) =>
        new Promise((resolve) => {
          release = () => {
            attachments.splice(0, 1)
            resolve(new Response(null, { status: 204 }))
          }
        }),
    })
    const user = userEvent.setup()
    await openPage()

    const dialog = await openDelete(user, 'spec.pdf')
    await user.click(dialog.getByRole('button', { name: 'Delete' }))

    expect(await dialog.findByRole('button', { name: 'Deleting…' })).toBeDisabled()
    expect(dialog.getByRole('button', { name: 'Cancel' })).toBeDisabled()
    expect(deletes(fetchMock)).toHaveLength(1)

    release()
    await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument())
  })
})

describe('permissions in the UI', () => {
  it('lets the task creator delete every attachment', async () => {
    api([makeAttachment({ id: 'a1', filename: 'mine.pdf', uploadedBy: ada }), makeAttachment({ id: 'a2', filename: 'theirs.pdf', uploadedBy: bob })])
    await openPage()

    expect(screen.getByRole('button', { name: 'Delete mine.pdf' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Delete theirs.pdf' })).toBeInTheDocument()
  })

  it('lets a non-creator assignee delete only their own uploads, but download and upload freely', async () => {
    api(
      [makeAttachment({ id: 'a1', filename: 'mine.pdf', uploadedBy: ada }), makeAttachment({ id: 'a2', filename: 'theirs.pdf', uploadedBy: bob })],
      { task: { creator: bob, assignee: ada } },
    )
    await openPage()

    // Signed in as Ada, who is only the assignee here: "mine.pdf" is hers (uploadedBy Ada), "theirs.pdf" is the creator's.
    expect(screen.getByRole('button', { name: 'Delete mine.pdf' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Delete theirs.pdf' })).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Download theirs.pdf' })).toBeInTheDocument()
    expect(chooser()).toBeEnabled()
  })
})
