// Offline lifecycle slice only. Not wired into the native broker or production.
import { execFile } from 'node:child_process'
import { evaluateHost, inspectHost } from './preflight.mjs'
import { offlineWorkerSpec, ownedWorkerCleanup } from './worker-spec.mjs'

export function boundedPodman(args, { exec = execFile, env = process.env } = {}) {
  const childEnv = { PATH: '/usr/local/bin:/usr/bin:/bin' }
  for (const key of ['HOME', 'USER', 'LOGNAME', 'XDG_RUNTIME_DIR', 'DBUS_SESSION_BUS_ADDRESS', 'LANG', 'LC_ALL']) if (env[key]) childEnv[key] = env[key]
  return new Promise((resolve, reject) => {
    exec('podman', ['--remote=false', ...args], {
      env: childEnv, shell: false, timeout: 10000, killSignal: 'SIGKILL', maxBuffer: 1024 * 1024,
    }, (error, stdout) => {
      if (!error) return resolve({ stdout })
      const failure = new Error('Local Podman command failed')
      failure.code = error.code; failure.killed = error.killed
      reject(failure)
    })
  })
}

export function offlineWorkerRuntime({ enableOfflinePrototype = false, host = inspectHost, run = boundedPodman } = {}) {
  if (enableOfflinePrototype !== true) throw new Error('Offline prototype must be explicitly enabled')
  const workers = new Map()
  const exists = async target => {
    try { await run(['container', 'exists', target]); return true }
    catch (error) { if (error.code === 1) return false; throw error }
  }
  const inspect = async (state, target = state.id || state.spec.name) => {
    const value = JSON.parse((await run(['container', 'inspect', target])).stdout)
    if (!Array.isArray(value) || value.length !== 1) throw new Error('Invalid container inspection')
    ownedWorkerCleanup(state.spec, value[0])
    if (state.id && value[0].Id !== state.id) throw new Error('Container identity changed')
    return value[0]
  }
  const destroy = async state => {
    const target = state.id || state.spec.name
    if (!(await exists(target))) { workers.delete(state.spec.sessionId); return }
    const inspected = await inspect(state)
    for (const args of ownedWorkerCleanup(state.spec, inspected)) await run(args)
    if (await exists(inspected.Id)) throw new Error('Container removal not verified')
    workers.delete(state.spec.sessionId)
  }
  return {
    get reservations() { return workers.size },
    start(input) {
      const spec = offlineWorkerSpec(input)
      if (workers.has(spec.sessionId)) throw new Error('Worker identity already reserved')
      const state = { spec }
      workers.set(spec.sessionId, state)
      state.startPromise = (async () => {
        let attemptedCreate = false
        try {
          if (!Object.values(evaluateHost(host())).every(Boolean)) throw new Error('Host is not qualified for isolation prototype')
          if (await exists(spec.name)) throw new Error('Container name already exists; refusing takeover')
          attemptedCreate = true
          const id = (await run(spec.args)).stdout.trim()
          if (!/^[0-9a-f]{64}$/.test(id)) throw new Error('Invalid created container ID')
          state.id = id
          await inspect(state)
          await run(['start', id])
          const inspected = await inspect(state)
          if (inspected.State?.Running !== true) throw new Error('Offline container did not remain running')
          return Object.freeze({ sessionId: spec.sessionId, containerId: id, stage: 'offline-container-only', chromeReady: false })
        } catch (error) {
          if (!attemptedCreate) workers.delete(spec.sessionId)
          else {
            try { await destroy(state) }
            catch (cleanupError) { throw new AggregateError([error, cleanupError], 'Offline worker startup/rollback incomplete') }
          }
          throw error
        }
      })()
      return state.startPromise
    },
    stop(sessionId) {
      const state = workers.get(sessionId)
      if (!state) return Promise.resolve()
      if (state.stopPromise) return state.stopPromise
      state.stopPromise = (async () => {
        try { await state.startPromise } catch {}
        if (workers.get(sessionId) === state) await destroy(state)
      })().finally(() => { state.stopPromise = null })
      return state.stopPromise
    },
  }
}
