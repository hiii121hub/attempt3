import { spawn } from 'node:child_process'
import { WebSocketServer } from 'ws'

const PORT = Number(process.env.POXEY_AUDIO_PORT || 3998)
const PULSE_SERVER =
  process.env.PULSE_SERVER || 'unix:/tmp/runtime-1000/pulse/native'

const wss = new WebSocketServer({ port: PORT })

let ffmpeg = null
let clients = new Set()

function startCapture() {
  if (ffmpeg) return

  console.log('[Poxey Audio] Starting PulseAudio capture')

  ffmpeg = spawn(
    'ffmpeg',
    [
      '-hide_banner',
      '-loglevel',
      'warning',
      '-f',
      'pulse',
      '-i',
      'poxey_output.monitor',
      '-ac',
      '2',
      '-ar',
      '44100',
      '-f',
      's16le',
      'pipe:1',
    ],
    {
      env: {
        ...process.env,
        PULSE_SERVER,
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    }
  )

  ffmpeg.stdout.on('data', chunk => {
    for (const client of clients) {
      if (client.readyState === 1) {
        client.send(chunk, { binary: true })
      }
    }
  })

  ffmpeg.stderr.on('data', data => {
    const message = data.toString().trim()
    if (message) console.log(`[Poxey Audio] ${message}`)
  })

  ffmpeg.on('exit', (code, signal) => {
    console.log(
      `[Poxey Audio] FFmpeg exited code=${code} signal=${signal || 'none'}`
    )
    ffmpeg = null

    if (clients.size > 0) {
      setTimeout(startCapture, 1000)
    }
  })

  ffmpeg.on('error', error => {
    console.error('[Poxey Audio] FFmpeg error:', error.message)
    ffmpeg = null
  })
}

wss.on('connection', socket => {
  console.log('[Poxey Audio] Client connected')

  clients.add(socket)
  startCapture()

  socket.on('close', () => {
    clients.delete(socket)
    console.log(`[Poxey Audio] Client disconnected (${clients.size} remaining)`)

    if (clients.size === 0 && ffmpeg) {
      ffmpeg.kill('SIGTERM')
      ffmpeg = null
    }
  })

  socket.on('error', error => {
    console.error('[Poxey Audio] WebSocket error:', error.message)
  })
})

wss.on('listening', () => {
  console.log(`[Poxey Audio] WebSocket listening on ${PORT}`)
})

wss.on('error', error => {
  console.error('[Poxey Audio] WebSocket server error:', error.message)
})

process.on('SIGTERM', () => {
  if (ffmpeg) ffmpeg.kill('SIGTERM')
  wss.close()
  process.exit(0)
})

process.on('SIGINT', () => {
  if (ffmpeg) ffmpeg.kill('SIGTERM')
  wss.close()
  process.exit(0)
})
