import { screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { jsonResponse, renderRoute, stubApi, testUser } from '@/test/renderWithProviders'

const emptyList = () => jsonResponse({ tasks: [], pagination: { page: 1, limit: 100, total: 0, totalPages: 1 } })

describe('main navigation', () => {
  it('keeps Tasks highlighted on the board and shows the user with a single sign-out button', async () => {
    stubApi({ 'GET /auth/me': () => jsonResponse({ user: testUser }), 'GET /tasks': emptyList })
    renderRoute('/board')

    const nav = await screen.findByRole('navigation', { name: 'Main' })
    expect(within(nav).getByRole('link', { name: 'Tasks' })).toHaveAttribute('aria-current', 'page')
    expect(within(nav).getByRole('link', { name: 'Dashboard' })).not.toHaveAttribute('aria-current')
    expect(screen.getByText(testUser.name)).toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: 'Sign out' })).toHaveLength(1)
  })

  it('does not highlight Tasks on the dashboard', async () => {
    stubApi({
      'GET /auth/me': () => jsonResponse({ user: testUser }),
      'GET /tasks/stats': () => new Promise(() => {}),
    })
    renderRoute('/dashboard')

    const nav = await screen.findByRole('navigation', { name: 'Main' })
    expect(within(nav).getByRole('link', { name: 'Dashboard' })).toHaveAttribute('aria-current', 'page')
    expect(within(nav).getByRole('link', { name: 'Tasks' })).not.toHaveAttribute('aria-current')
  })
})
