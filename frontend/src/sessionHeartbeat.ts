const HEARTBEAT_INTERVAL = 15_000
const HEARTBEAT_URL = '/__poxey_session/heartbeat'

let heartbeatTimer: number | null = null
let started = false
let sessionToken: string | null = null

async function sendHeartbeat() {
  if (!sessionToken) return

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
        token: sessionToken,
      }),
    })

    console.log('[Poxey heartbeat]', response.status, new Date().toISOString())

    if (!response.ok) {
      console.error('[Poxey heartbeat FAILED]', response.status)
    }
  } catch (error) {
    console.error('[Poxey heartbeat FAILED]', error)
  }
}

export function startPoxeyHeartbeat(token: string) {
  if (started) return

  sessionToken = token
  started = true

  console.log('[Poxey heartbeat] started')

  sendHeartbeat()

  heartbeatTimer = window.setInterval(
    sendHeartbeat,
    HEARTBEAT_INTERVAL
  )
}

export async function stopPoxeyHeartbeat() {
  if (heartbeatTimer !== null) {
    window.clearInterval(heartbeatTimer)
    heartbeatTimer = null
  }

  if (sessionToken) {
    try {
      await fetch('/__poxey_session/end', {
        method: 'POST',
        credentials: 'include',
        cache: 'no-store',
        keepalive: true,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          token: sessionToken,
        }),
      })
    } catch (error) {
      console.error('[Poxey session end FAILED]', error)
    }
  }

  sessionToken = null
  started = false
  console.log('[Poxey heartbeat] stopped')
}
