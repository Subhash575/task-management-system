import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { jsonResponse, renderRoute } from '@/test/renderWithProviders'

describe('HomePage', () => {
  it('shows a loading state, then the healthy API status', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ status: 'ok', db: 'connected' }))
    vi.stubGlobal('fetch', fetchMock)

    renderRoute('/')

    expect(screen.getByRole('status')).toHaveTextContent('Checking API status')
    expect(await screen.findByText(/API healthy · Database connected/)).toBeInTheDocument()
    expect(fetchMock).toHaveBeenCalledWith('/api/health', expect.objectContaining({ credentials: 'include' }))
  })

  it('explains a database outage when the API returns 503', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({ status: 'degraded', db: 'disconnected' }, 503)))

    renderRoute('/')

    expect(await screen.findByRole('alert')).toHaveTextContent('database is not connected')
  })

  it('shows an error when the API is unreachable and lets the user retry', async () => {
    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(new TypeError('Failed to fetch'))
      .mockResolvedValueOnce(jsonResponse({ status: 'ok', db: 'connected' }))
    vi.stubGlobal('fetch', fetchMock)
    const user = userEvent.setup()

    renderRoute('/')

    expect(await screen.findByRole('alert')).toHaveTextContent('Could not reach the API')
    await user.click(screen.getByRole('button', { name: /try again/i }))
    expect(await screen.findByText(/API healthy/)).toBeInTheDocument()
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })
})
