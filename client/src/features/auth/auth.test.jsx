import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { safeRedirectPath } from './auth'
import { jsonResponse, renderRoute, stubApi, testUser } from '@/test/renderWithProviders'

const signedOut = () => jsonResponse({ error: { message: 'Authentication required' } }, 401)
const signedIn = () => jsonResponse({ user: testUser })
const emptyTasks = () => jsonResponse({ tasks: [], pagination: { page: 1, limit: 10, total: 0, totalPages: 0 } })

describe('session restoration and route protection', () => {
  it('shows a loading state, then restores the session from /auth/me', async () => {
    const fetchMock = stubApi({ 'GET /auth/me': signedIn, 'GET /tasks': emptyTasks })

    renderRoute('/')

    expect(screen.getByRole('status')).toHaveTextContent('Checking your session')
    expect(await screen.findByRole('heading', { name: 'Tasks' })).toBeInTheDocument()
    expect(screen.getByText('Ada Lovelace')).toBeInTheDocument()
    expect(fetchMock).toHaveBeenCalledWith('/api/auth/me', expect.objectContaining({ credentials: 'include' }))
  })

  it('redirects a signed-out visitor from a protected route to /login', async () => {
    stubApi({ 'GET /auth/me': signedOut })

    renderRoute('/')

    expect(await screen.findByRole('heading', { name: 'Welcome back' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /sign out/i })).not.toBeInTheDocument()
  })

  it('redirects a signed-in user away from /login', async () => {
    stubApi({ 'GET /auth/me': signedIn, 'GET /tasks': emptyTasks })

    renderRoute('/login')

    expect(await screen.findByRole('heading', { name: 'Tasks' })).toBeInTheDocument()
  })

  it('redirects a signed-in user away from /register', async () => {
    stubApi({ 'GET /auth/me': signedIn, 'GET /tasks': emptyTasks })

    renderRoute('/register')

    expect(await screen.findByRole('heading', { name: 'Tasks' })).toBeInTheDocument()
  })

  it('shows an error with retry when the session check fails (not a 401)', async () => {
    let calls = 0
    stubApi({
      'GET /auth/me': () => {
        calls += 1
        if (calls === 1) throw new TypeError('Failed to fetch')
        return signedIn()
      },
      'GET /tasks': emptyTasks,
    })
    const user = userEvent.setup()

    renderRoute('/')

    expect(await screen.findByRole('alert')).toHaveTextContent('Could not check your session')
    await user.click(screen.getByRole('button', { name: /try again/i }))
    expect(await screen.findByRole('heading', { name: 'Tasks' })).toBeInTheDocument()
  })
})

describe('login', () => {
  it('toggles password visibility without losing the typed value', async () => {
    stubApi({ 'GET /auth/me': signedOut })
    const user = userEvent.setup()
    renderRoute('/login')

    const password = await screen.findByLabelText('Password')
    await user.type(password, 'secret-pass')
    expect(password).toHaveAttribute('type', 'password')

    await user.click(screen.getByRole('button', { name: 'Show password' }))
    expect(password).toHaveAttribute('type', 'text')
    expect(password).toHaveValue('secret-pass')

    await user.click(screen.getByRole('button', { name: 'Hide password' }))
    expect(password).toHaveAttribute('type', 'password')
  })

  it('validates fields on the client without calling the login API', async () => {
    const fetchMock = stubApi({ 'GET /auth/me': signedOut })
    const user = userEvent.setup()
    renderRoute('/login')

    await user.click(await screen.findByRole('button', { name: 'Sign in' }))

    expect(screen.getByText('Email is required')).toBeInTheDocument()
    expect(screen.getByText('Password is required')).toBeInTheDocument()
    expect(screen.getByLabelText('Email')).toHaveAttribute('aria-invalid', 'true')
    expect(fetchMock).toHaveBeenCalledTimes(1) // only the /auth/me session check
  })

  it('signs in with credentials and lands on the protected page', async () => {
    const fetchMock = stubApi({
      'GET /auth/me': signedOut,
      'POST /auth/login': () => jsonResponse({ user: testUser }),
      'GET /tasks': emptyTasks,
    })
    const user = userEvent.setup()
    renderRoute('/login')

    await user.type(await screen.findByLabelText('Email'), 'ada@example.com')
    await user.type(screen.getByLabelText('Password'), 'secret-pass')
    await user.click(screen.getByRole('button', { name: 'Sign in' }))

    expect(await screen.findByRole('heading', { name: 'Tasks' })).toBeInTheDocument()
    const loginCall = fetchMock.mock.calls.find(([url]) => url === '/api/auth/login')
    expect(loginCall[1]).toMatchObject({ method: 'POST', credentials: 'include' })
    expect(JSON.parse(loginCall[1].body)).toEqual({ email: 'ada@example.com', password: 'secret-pass' })
  })

  it('shows the server error message for wrong credentials', async () => {
    stubApi({
      'GET /auth/me': signedOut,
      'POST /auth/login': () => jsonResponse({ error: { message: 'Invalid email or password' } }, 401),
    })
    const user = userEvent.setup()
    renderRoute('/login')

    await user.type(await screen.findByLabelText('Email'), 'ada@example.com')
    await user.type(screen.getByLabelText('Password'), 'wrong-pass')
    await user.click(screen.getByRole('button', { name: 'Sign in' }))

    expect(await screen.findByText('Invalid email or password')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Welcome back' })).toBeInTheDocument()
  })

  it('shows an error when the network is down and re-enables the button', async () => {
    stubApi({
      'GET /auth/me': signedOut,
      'POST /auth/login': () => {
        throw new TypeError('Failed to fetch')
      },
    })
    const user = userEvent.setup()
    renderRoute('/login')

    await user.type(await screen.findByLabelText('Email'), 'ada@example.com')
    await user.type(screen.getByLabelText('Password'), 'secret-pass')
    await user.click(screen.getByRole('button', { name: 'Sign in' }))

    expect(await screen.findByText('Failed to fetch')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Sign in' })).toBeEnabled()
  })
})

describe('registration', () => {
  async function fillForm(user, overrides = {}) {
    const values = {
      'Full name': 'Ada Lovelace',
      Email: 'ada@example.com',
      Password: 'secret-pass',
      'Confirm password': 'secret-pass',
      ...overrides,
    }
    for (const [label, value] of Object.entries(values)) {
      await user.type(await screen.findByLabelText(label), value)
    }
  }

  it('shows client-side errors for a short password and mismatched confirmation', async () => {
    const fetchMock = stubApi({ 'GET /auth/me': signedOut })
    const user = userEvent.setup()
    renderRoute('/register')

    await fillForm(user, { Password: 'short', 'Confirm password': 'different' })
    await user.click(screen.getByRole('button', { name: 'Create account' }))

    expect(screen.getByText('Password must be at least 8 characters')).toBeInTheDocument()
    expect(screen.getByText('Passwords do not match')).toBeInTheDocument()
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('registers and lands on the protected page', async () => {
    const fetchMock = stubApi({
      'GET /auth/me': signedOut,
      'POST /auth/register': () => jsonResponse({ user: testUser }, 201),
      'GET /tasks': emptyTasks,
    })
    const user = userEvent.setup()
    renderRoute('/register')

    await fillForm(user)
    await user.click(screen.getByRole('button', { name: 'Create account' }))

    expect(await screen.findByRole('heading', { name: 'Tasks' })).toBeInTheDocument()
    const call = fetchMock.mock.calls.find(([url]) => url === '/api/auth/register')
    expect(JSON.parse(call[1].body)).toEqual({
      name: 'Ada Lovelace',
      email: 'ada@example.com',
      password: 'secret-pass',
      confirmPassword: 'secret-pass',
    })
  })

  it('shows "email already in use" next to the email field on a 409', async () => {
    stubApi({
      'GET /auth/me': signedOut,
      'POST /auth/register': () => jsonResponse({ error: { message: 'Email is already in use' } }, 409),
    })
    const user = userEvent.setup()
    renderRoute('/register')

    await fillForm(user)
    await user.click(screen.getByRole('button', { name: 'Create account' }))

    expect(await screen.findByText('Email is already in use')).toBeInTheDocument()
    expect(screen.getByLabelText('Email')).toHaveAttribute('aria-invalid', 'true')
  })

  it('maps server validation details onto fields', async () => {
    stubApi({
      'GET /auth/me': signedOut,
      'POST /auth/register': () =>
        jsonResponse(
          { error: { message: 'Validation failed', details: [{ path: 'name', message: 'Name is required' }] } },
          400,
        ),
    })
    const user = userEvent.setup()
    renderRoute('/register')

    await fillForm(user)
    await user.click(screen.getByRole('button', { name: 'Create account' }))

    expect(await screen.findByText('Name is required')).toBeInTheDocument()
    expect(screen.getByLabelText('Full name')).toHaveAttribute('aria-invalid', 'true')
  })

  it('shows rate-limit errors in an alert', async () => {
    stubApi({
      'GET /auth/me': signedOut,
      'POST /auth/register': () => jsonResponse({ error: { message: 'Too many attempts, try again later' } }, 429),
    })
    const user = userEvent.setup()
    renderRoute('/register')

    await fillForm(user)
    await user.click(screen.getByRole('button', { name: 'Create account' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Too many attempts')
  })
})

describe('logout', () => {
  it('calls POST /auth/logout and returns to the login page', async () => {
    const fetchMock = stubApi({
      'GET /auth/me': signedIn,
      'GET /tasks': emptyTasks,
      'POST /auth/logout': () => new Response(null, { status: 204 }),
    })
    const user = userEvent.setup()
    renderRoute('/')

    await user.click(await screen.findByRole('button', { name: /sign out/i }))

    expect(await screen.findByRole('heading', { name: 'Welcome back' })).toBeInTheDocument()
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/auth/logout',
      expect.objectContaining({ method: 'POST', credentials: 'include' }),
    )
    // The session is cleared locally, so no second /auth/me round trip is needed.
    await waitFor(() => expect(fetchMock.mock.calls.filter(([url]) => url === '/api/auth/me')).toHaveLength(1))
  })

  it('stays signed in and shows an error when logout fails', async () => {
    stubApi({
      'GET /auth/me': signedIn,
      'GET /tasks': emptyTasks,
      'POST /auth/logout': () => jsonResponse({ error: { message: 'Internal server error' } }, 500),
    })
    const user = userEvent.setup()
    renderRoute('/')

    await user.click(await screen.findByRole('button', { name: /sign out/i }))

    expect(await screen.findByText('Could not sign out. Try again.')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Tasks' })).toBeInTheDocument()
  })
})

describe('safeRedirectPath', () => {
  it('only allows same-site paths', () => {
    expect(safeRedirectPath('/projects?x=1')).toBe('/projects?x=1')
    expect(safeRedirectPath('//evil.example')).toBe('/')
    expect(safeRedirectPath('https://evil.example')).toBe('/')
    expect(safeRedirectPath(undefined)).toBe('/')
  })
})
