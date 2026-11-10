// Production builds require an explicit opt-in for browser-only demo accounts.
export const demoEnabled = import.meta.env.VITE_ENABLE_DEMO === 'true' || (import.meta.env.DEV && import.meta.env.VITE_ENABLE_DEMO !== 'false')

export async function platformApi<T>(token: string, path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers)
  headers.set('Content-Type', 'application/json')
  headers.set('Authorization', `Bearer ${token}`)
  let response: Response
  try {
    response = await fetch(`${import.meta.env.VITE_API_URL || (import.meta.env.DEV ? 'http://127.0.0.1:3001' : '')}${path}`, {
      ...init, headers, signal: init.signal || AbortSignal.timeout(20000),
    })
  } catch (error) {
    if (error instanceof DOMException && error.name === 'TimeoutError') throw new Error('The service took too long to respond. Check the saved result before retrying a change.')
    if (error instanceof DOMException && error.name === 'AbortError') throw error
    throw new Error('Unable to reach the service. Please check your connection and try again.')
  }
  if (response.status === 204) return undefined as T
  const payload = await response.json().catch(() => { throw new Error('The service is unavailable. Please try again later.') })
  if (!response.ok) throw Object.assign(new Error(payload.error || 'Unable to complete this request.'), { requestId: payload.requestId })
  return payload as T
}
