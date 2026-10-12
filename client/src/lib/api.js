export const API_BASE_URL = import.meta.env.VITE_API_URL || '/api'

/** Error thrown for any non-2xx API response. `status` lets callers react to 401/403/404 etc. */
export class ApiError extends Error {
  constructor(status, message, details) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.details = details
  }
}

/**
 * Small fetch wrapper shared by every feature.
 * - Always sends cookies (`credentials: 'include'`) so the HTTP-only auth cookie works.
 * - Serialises JSON bodies (FormData is passed through for uploads) and parses JSON responses.
 * - Throws ApiError using the server's `{ error: { message } }` shape.
 */
export async function apiRequest(path, { method = 'GET', body, headers, signal } = {}) {
  const hasBody = body !== undefined
  // A FormData body (file upload) is sent as-is: the browser adds the multipart Content-Type and boundary itself.
  const isFormData = typeof FormData !== 'undefined' && body instanceof FormData

  const response = await fetch(`${API_BASE_URL}${path}`, {
    method,
    credentials: 'include',
    headers: {
      Accept: 'application/json',
      ...(hasBody && !isFormData && { 'Content-Type': 'application/json' }),
      ...headers,
    },
    body: hasBody ? (isFormData ? body : JSON.stringify(body)) : undefined,
    signal,
  })

  const data = response.status === 204 ? null : await response.json().catch(() => null)

  if (!response.ok) {
    throw new ApiError(
      response.status,
      data?.error?.message ?? `Request failed with status ${response.status}`,
      data?.error?.details,
    )
  }

  return data
}
