const HEARTBEAT_INTERVAL = 15_000
const HEARTBEAT_URL = '/__poxey_session/session/heartbeat'

type HeartbeatOptions = {
  onRemainingMs?: (remainingMs: number) => void
  onExpired?: () => void
}

const heartbeats = new Map<string, number>()
const pagehideHandlers = new Map<string, () => void>()

function sendSessionEndBeacon(token: string) {
  if (!token || !navigator.sendBeacon) return

  const body = new Blob(
    [JSON.stringify({ token })],
    { type: 'application/json' },
  )

  navigator.sendBeacon('/__poxey_session/session/end', body)
}

async function sendHeartbeat(
  token: string,
  options: HeartbeatOptions = {},
) {
  if (!token) return

  try {
    const response = await fetch(HEARTBEAT_URL, {
      method: 'POST',
      credentials: 'include',
      cache: 'no-store',
      keepalive: true,
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        token,
      }),
    })

    if (response.ok) {
      const data = await response.json()

      if (Number.isFinite(data?.remainingMs)) {
        options.onRemainingMs?.(data.remainingMs)
      }

      return
    }

    if (response.status === 410) {
      const data = await response.json().catch(() => null)

      if (data?.error === 'ALLOWANCE_EXHAUSTED') {
        const timer = heartbeats.get(token)

        if (timer !== undefined) {
          window.clearInterval(timer)
          heartbeats.delete(token)
        }

        options.onRemainingMs?.(0)
        options.onExpired?.()
        return
      }
    }

    console.error('[Poxey heartbeat FAILED]', response.status)
  } catch (error) {
    console.error('[Poxey heartbeat FAILED]', error)
  }
}

export function startPoxeyHeartbeat(
  token: string,
  options: HeartbeatOptions = {},
) {
  if (heartbeats.has(token)) return

  void sendHeartbeat(token, options)

  const timer = window.setInterval(() => {
    void sendHeartbeat(token, options)
  }, HEARTBEAT_INTERVAL)

  const pagehideHandler = () => {
    sendSessionEndBeacon(token)
  }

  window.addEventListener('pagehide', pagehideHandler)

  heartbeats.set(token, timer)
  pagehideHandlers.set(token, pagehideHandler)
}

export function stopPoxeyHeartbeat(token: string) {
  const timer = heartbeats.get(token)

  if (timer !== undefined) {
    window.clearInterval(timer)
    heartbeats.delete(token)
  }

  const pagehideHandler = pagehideHandlers.get(token)

  if (pagehideHandler) {
    window.removeEventListener('pagehide', pagehideHandler)
    pagehideHandlers.delete(token)
  }
}

export async function endPoxeySession(token: string) {
  if (!token) return false

  try {
    const response = await fetch('/__poxey_session/session/end', {
      method: 'POST',
      credentials: 'include',
      cache: 'no-store',
      keepalive: true,
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ token }),
    })

    if (response.ok) {
      return true
    }

    if (response.status === 404) {
      console.error('[Poxey session end FAILED] Session not found')
      return false
    }

    console.error('[Poxey session end FAILED]', response.status)
    return false
  } catch (error) {
    console.error('[Poxey session end FAILED]', error)
    return false
  }
}
