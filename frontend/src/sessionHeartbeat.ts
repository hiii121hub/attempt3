const HEARTBEAT_INTERVAL = 15_000
const HEARTBEAT_URL = '/__poxey_session/heartbeat'

let heartbeatTimer: number | null = null
let started = false

async function sendHeartbeat() {
  try {
    const response = await fetch(HEARTBEAT_URL, {
      method: 'POST',
      credentials: 'include',
      cache: 'no-store',
      keepalive: true,
    })

    console.log('[Poxey heartbeat]', response.status, new Date().toISOString())
  } catch (error) {
    console.error('[Poxey heartbeat FAILED]', error)
  }
}

export function startPoxeyHeartbeat() {
  if (started) return

  started = true
  console.log('[Poxey heartbeat] started')

  sendHeartbeat()

  heartbeatTimer = window.setInterval(
    sendHeartbeat,
    HEARTBEAT_INTERVAL
  )
}

export function stopPoxeyHeartbeat() {
  if (heartbeatTimer !== null) {
    window.clearInterval(heartbeatTimer)
    heartbeatTimer = null
  }

  started = false
  console.log('[Poxey heartbeat] stopped')
}
