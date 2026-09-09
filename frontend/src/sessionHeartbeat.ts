const HEARTBEAT_INTERVAL = 15_000
const HEARTBEAT_URL = '/__poxey_session/heartbeat'

const heartbeats = new Map<string, number>()

async function sendHeartbeat(token: string) {
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

    if (!response.ok) {
      console.error('[Poxey heartbeat FAILED]', response.status)
    }
  } catch (error) {
    console.error('[Poxey heartbeat FAILED]', error)
  }
}

export function startPoxeyHeartbeat(token: string) {
  if (heartbeats.has(token)) return

  void sendHeartbeat(token)

  const timer = window.setInterval(() => {
    void sendHeartbeat(token)
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
