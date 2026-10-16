// Explicit, private operator command. Startup never provisions or rotates identities.
import fs from 'node:fs'
import path from 'node:path'
import net from 'node:net'
import { spawnSync } from 'node:child_process'
import { prepareRecovery, activateRecovery, validateLedger, recoveryStatus, reobserveRecovery, resetUnusedDevelopmentState } from './accounting-state.mjs'
import { readRuntimeConfig } from './security-policy.mjs'

async function idleHost() {
  if (process.platform !== 'linux') throw new Error('Linux host inspection required')
  for (const port of [3997, 3999]) {
    await new Promise((resolve, reject) => {
      const socket = net.createConnection({ host: '127.0.0.1', port })
      socket.setTimeout(1000)
      socket.on('connect', () => { socket.destroy(); reject(new Error('Listener present')) })
      socket.on('timeout', () => { socket.destroy(); reject(new Error('Listener inspection uncertain')) })
      socket.on('error', error => error.code === 'ECONNREFUSED' ? resolve() : reject(error))
    })
  }
  for (const pid of fs.readdirSync('/proc').filter(name => /^\d+$/.test(name))) {
    try {
      const comm = fs.readFileSync(`/proc/${pid}/comm`, 'utf8').trim()
      if (/^(chrome.*|google-chrome.*|Xvfb|x11vnc|ffmpeg)$/.test(comm)) throw new Error('Session process present')
    } catch (error) { if (error.code !== 'ENOENT' && error.code !== 'ESRCH') throw error }
  }
  const legacy = '/tmp/poxey-sessions'
  if (fs.existsSync(legacy) && fs.readdirSync(legacy).length) throw new Error('Additional legacy state requires review')
  const pulse = spawnSync('pactl', ['list', 'sinks', 'short'], { encoding: 'utf8', timeout: 3000, maxBuffer: 1024 * 1024 })
  if (pulse.error && pulse.error.code !== 'ENOENT') throw new Error('Audio ownership inspection uncertain')
  if (pulse.status === 0 && /poxey_/.test(pulse.stdout)) throw new Error('Session sink present')
  return fs.readFileSync('/proc/sys/kernel/random/boot_id', 'utf8').trim()
}

try {
  const [operation, dir, source] = process.argv.slice(2)
  if (operation === 'status' && !source) {
    const bootId = process.platform === 'linux'
      ? fs.readFileSync('/proc/sys/kernel/random/boot_id', 'utf8').trim() : undefined
    const result = recoveryStatus(path.resolve(dir || readRuntimeConfig().stateDir), { bootId })
    console.log(JSON.stringify(result))
    process.exitCode = result.admissionReady ? 0 : 2
  } else {
    const bootId = await idleHost()
    if (operation === 'owner-reset' && dir === 'RESET-UNUSED-DEVELOPMENT-ALLOWANCES' && !source) {
      const config = readRuntimeConfig()
      console.log(JSON.stringify(resetUnusedDevelopmentState(config.stateDir,
        { confirmation: dir, production: config.production, bootId, quiescent: true })))
    } else if (operation === 'reobserve' && dir && source) {
      const result = reobserveRecovery(path.resolve(source), path.resolve(dir), { bootId, quiescent: true })
      console.log(JSON.stringify({ ...result, notBeforeUTC: new Date(result.notBefore).toISOString() }))
    } else if (operation === 'prepare' && dir && source) {
      const stat = fs.lstatSync(source)
      if (!stat.isFile() || stat.isSymbolicLink() || stat.uid !== process.getuid() || (stat.mode & 0o777) !== 0o600 || stat.size > 1024 * 1024) throw new Error('Unsafe source')
      const bytes = fs.readFileSync(source)
      validateLedger(bytes)
      const result = prepareRecovery(path.resolve(dir), bytes, { bootId })
      console.log(JSON.stringify({ ...result, notBeforeUTC: new Date(result.notBefore).toISOString(), keyGenerated: false }))
    } else if (operation === 'activate' && dir && !source) {
      console.log(JSON.stringify(activateRecovery(path.resolve(dir), { bootId, quiescent: true })))
    } else throw new Error('Invalid command')
  }
} catch {
  console.error('IDENTITY_RECOVERY_BLOCKED: require idle Linux host, intact private state, unchanged boot and expired recovery gate. See deploy/IDENTITY-RECOVERY.md. No secret or ledger values are logged.')
  process.exitCode = 1
}
