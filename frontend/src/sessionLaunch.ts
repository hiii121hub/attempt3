export const MAX_LAUNCH_ATTEMPTS = 25
export const LAUNCH_TIMEOUT_MS = 90_000

function pause(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const cancel = () => {
      clearTimeout(timer)
      signal.removeEventListener('abort', cancel)
      reject(signal.reason)
    }
    const timer = setTimeout(() => {
      signal.removeEventListener('abort', cancel)
      resolve()
    }, ms)
    signal.addEventListener('abort', cancel, { once: true })
    if (signal.aborted) cancel()
  })
}

// Only a confirmed busy response guarantees that this request created no session.
// Network errors and timeouts are ambiguous and must never trigger another POST.
export async function requestSession(endpoint: string, signal: AbortSignal) {
  const controller = new AbortController()
  const cancel = () => controller.abort(signal.reason)
  signal.addEventListener('abort', cancel, { once: true })
  if (signal.aborted) cancel()
  let inFlight = false
  const timeout = setTimeout(() => controller.abort(new Error(inFlight
    ? 'The launch response timed out. A session may still be starting; no automatic retry was made.'
    : 'The server is still starting other browsers. Please try again shortly.')), LAUNCH_TIMEOUT_MS)

  try {
    for (let attempt = 0; attempt < MAX_LAUNCH_ATTEMPTS; attempt++) {
      controller.signal.throwIfAborted()
      inFlight = true
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
      })
      const data = await response.json().catch(() => ({}))
      controller.signal.throwIfAborted()
      inFlight = false
      if (response.status !== 429 || data?.error !== 'SESSION_CREATION_BUSY') {
        return { response, data }
      }
      if (attempt === MAX_LAUNCH_ATTEMPTS - 1) break
      // Equal jitter: 0.5–1s initially, rising to 2.5–5s between attempts.
      const ceiling = Math.min(5000, 1000 * 2 ** attempt)
      await pause(ceiling * (0.5 + Math.random() * 0.5), controller.signal)
    }
    throw new Error('The server is still starting other browsers. Please try again shortly.')
  } catch (error) {
    if (controller.signal.aborted) throw controller.signal.reason
    throw error
  } finally {
    clearTimeout(timeout)
    signal.removeEventListener('abort', cancel)
  }
}
