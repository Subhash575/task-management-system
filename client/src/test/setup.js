import '@testing-library/jest-dom/vitest'
import { cleanup, configure } from '@testing-library/react'
import { afterEach, vi } from 'vitest'

// Slow machines (or a cold first render) can exceed the 1s default for findBy*/waitFor.
configure({ asyncUtilTimeout: 10000 })

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})
