const HEARTBEAT_INTERVAL = 15_000
const HEARTBEAT_URL = '/__poxey_session/heartbeat'

type HeartbeatOptions = {
  onRemainingMs?: (remainingMs: number) => void
  onExpired?: () => void
}

const heartbeats = new Map<string, number>()

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

  heartbeats.set(token, timer)
}

export async function stopPoxeyHeartbeat(token: string) {
  const timer = heartbeats.get(token)

  if (timer !== undefined) {
    window.clearInterval(timer)
    heartbeats.delete(token)
  }

  await endPoxeySession(token)
}

export async function endPoxeySession(token: string) {
  try {
    await fetch('/__poxey_session/end', {
      method: 'POST',
      credentials: 'include',
      cache: 'no-store',
      keepalive: true,
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ token }),
    })
  } catch (error) {
    console.error('[Poxey session end FAILED]', error)
  }
}
