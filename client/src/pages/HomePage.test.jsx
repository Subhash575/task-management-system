import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { jsonResponse, renderRoute, stubApi, testUser } from '@/test/renderWithProviders'

// "/" is a protected route, so every test starts with a restored session.
const signedIn = () => jsonResponse({ user: testUser })

describe('HomePage', () => {
  it('shows a loading state, then the healthy API status', async () => {
    const fetchMock = stubApi({
      'GET /auth/me': signedIn,
      'GET /health': () => jsonResponse({ status: 'ok', db: 'connected' }),
    })

    renderRoute('/')

    expect(await screen.findByText('Checking API status…')).toBeInTheDocument()
    expect(await screen.findByText(/API healthy · Database connected/)).toBeInTheDocument()
    expect(fetchMock).toHaveBeenCalledWith('/api/health', expect.objectContaining({ credentials: 'include' }))
  })

  it('explains a database outage when the API returns 503', async () => {
    stubApi({
      'GET /auth/me': signedIn,
      'GET /health': () => jsonResponse({ status: 'degraded', db: 'disconnected' }, 503),
    })

    renderRoute('/')

    expect(await screen.findByRole('alert')).toHaveTextContent('database is not connected')
  })

  it('shows an error when the API is unreachable and lets the user retry', async () => {
    let healthCalls = 0
    stubApi({
      'GET /auth/me': signedIn,
      'GET /health': () => {
        healthCalls += 1
        if (healthCalls === 1) throw new TypeError('Failed to fetch')
        return jsonResponse({ status: 'ok', db: 'connected' })
      },
    })
    const user = userEvent.setup()

    renderRoute('/')

    expect(await screen.findByRole('alert')).toHaveTextContent('Could not reach the API')
    await user.click(screen.getByRole('button', { name: /try again/i }))
    expect(await screen.findByText(/API healthy/)).toBeInTheDocument()
    expect(healthCalls).toBe(2)
  })
})
