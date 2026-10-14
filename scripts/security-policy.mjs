import path from 'node:path'
import { validateStatePath } from './accounting-state.mjs'

const projectRoot = path.resolve(new URL('..', import.meta.url).pathname)
export const developmentStateDir = path.join(path.dirname(projectRoot), '.poxey-state', path.basename(projectRoot))

export function readRuntimeConfig(env = process.env, runtime = { platform: process.platform, uid: process.getuid?.() }) {
  const production = env.NODE_ENV === 'production'
  const rawLimit = env.POXEY_MAX_SESSIONS ?? (production ? '1' : '100')
  if (!/^[1-9]\d*$/.test(rawLimit) || Number(rawLimit) > 100) {
    throw new Error('POXEY_MAX_SESSIONS must be an integer between 1 and 100')
  }
  let origin = null
  let stateDir = env.POXEY_STATE_DIR ?? developmentStateDir
  if (production) {
    if (runtime.platform !== 'linux' || !Number.isInteger(runtime.uid) || runtime.uid === 0) {
      throw new Error('Production requires Linux and a dedicated non-root service user')
    }
    const url = new URL(env.POXEY_PUBLIC_ORIGIN || '')
    if (url.protocol !== 'https:' || url.origin !== env.POXEY_PUBLIC_ORIGIN || url.username || url.password) {
      throw new Error('POXEY_PUBLIC_ORIGIN must be one exact HTTPS origin without a path')
    }
    origin = url.origin
    stateDir = env.POXEY_STATE_DIR || ''
  }
  validateStatePath(stateDir)
  return { production, origin, stateDir, maxSessions: Number(rawLimit) }
}

export function requestAllowed(req, config) {
  if (!config.production) return true
  // Never infer the public origin from attacker-controlled Host/forwarded headers.
  return req.headers.origin === config.origin && req.headers['x-forwarded-proto'] === 'https'
}

export function sessionUsable(session, now = Date.now()) {
  return Boolean(session && !session.cleaningUp && now < session.expiresAt)
}

export function parseSessionBody(body) {
  const value = body ? JSON.parse(body) : {}
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('INVALID_JSON_OBJECT')
  return value
}

export function decodeCookie(value) {
  try { return decodeURIComponent(value) } catch { return null }
}

export function childEnvironment(env, production) {
  if (!production) return { ...env }
  // Chrome must not inherit GitHub tokens, cloud credentials, or signing secrets.
  const allowed = ['HOME', 'USER', 'LOGNAME', 'LANG', 'LC_ALL', 'LC_CTYPE', 'TZ', 'XDG_RUNTIME_DIR', 'PULSE_SERVER', 'PULSE_COOKIE']
  const result = { PATH: '/usr/local/bin:/usr/bin:/bin' }
  for (const key of allowed) if (env[key]) result[key] = env[key]
  return result
}

export function chromeSandboxArgs(config) {
  // No production fallback. A host without a working sandbox must fail its release checks.
  return config.production ? [] : ['--no-sandbox']
}

export function websocketAllowed(req, config, session, deviceId, route) {
  if (!requestAllowed(req, config) || !sessionUsable(session)) return false
  if (!config.production) return true
  if (!deviceId || session.deviceId !== deviceId) return false
  const clients = route === '/audio' ? session.audioClients : session.vncClients
  return (clients?.size || 0) < 2 // allows brief reconnect overlap without unbounded FFmpeg processes
}
