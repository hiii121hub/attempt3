// Preparatory offline worker specification. Does not execute Podman or serve users.
// No host mounts, published ports, credentials, or unrestricted network are accepted.
import crypto from 'node:crypto'
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/
const IMAGE = /^[a-z0-9][a-z0-9./:_-]*@sha256:[0-9a-f]{64}$/
const OWNER = 'poxey-offline-prototype-v2'

function integer(value, min, max, name) {
  if (!Number.isSafeInteger(value) || value < min || value > max) throw new Error(`Invalid ${name}`)
  return value
}

export function offlineWorkerSpec(input, { attemptId = crypto.randomUUID() } = {}) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('Invalid worker configuration')
  const allowed = new Set(['sessionId', 'image', 'cpuMillis', 'memoryMiB', 'pids', 'tmpMiB', 'shmMiB'])
  for (const key of Object.keys(input)) if (!allowed.has(key)) throw new Error(`Unsupported worker option: ${key}`)
  const { sessionId, image } = input
  if (typeof sessionId !== 'string' || !UUID.test(sessionId)) throw new Error('A broker-issued v4 session UUID is required')
  if (typeof attemptId !== 'string' || !UUID.test(attemptId)) throw new Error('A broker-issued attempt UUID is required')
  if (typeof image !== 'string' || !IMAGE.test(image)) throw new Error('A digest-pinned image is required')
  const cpu = integer(input.cpuMillis, 100, 16000, 'CPU limit') / 1000
  const memory = integer(input.memoryMiB, 128, 65536, 'memory limit')
  const pids = integer(input.pids, 32, 4096, 'process limit')
  const tmp = integer(input.tmpMiB, 16, memory, 'temporary filesystem limit')
  const shm = integer(input.shmMiB, 16, memory, 'shared-memory limit')
  if (tmp + shm + 32 >= memory) throw new Error('Writable filesystem ceilings must leave memory for processes')
  const name = `poxey-offline-${sessionId}`
  return {
    stage: 'offline-prototype-only', name, sessionId, attemptId,
    limits: Object.freeze({ cpuMillis: input.cpuMillis, memoryMiB: memory, pids, tmpMiB: tmp, shmMiB: shm }),
    executable: 'podman',
    args: [
      'create', '--pull=never', `--name=${name}`,
      `--label=org.poxey.owner=${OWNER}`, `--label=org.poxey.session=${sessionId}`,
      `--label=org.poxey.attempt=${attemptId}`,
      '--user=1000:1000', '--userns=auto:size=65536',
      '--pid=private', '--ipc=private', '--cgroupns=private',
      '--cap-drop=ALL', '--security-opt=no-new-privileges',
      '--read-only', '--read-only-tmpfs=true', '--image-volume=ignore',
      '--network=none', '--http-proxy=false', '--no-hosts',
      '--uts=private', '--restart=no', '--log-driver=none', '--umask=0077',
      `--cpus=${cpu}`, `--memory=${memory}m`, `--memory-swap=${memory + 1}m`, `--pids-limit=${pids}`,
      `--shm-size=${shm}m`,
      `--tmpfs=/tmp:rw,nosuid,nodev,noexec,size=${tmp}m,mode=1777`,
      '--tmpfs=/run:rw,nosuid,nodev,noexec,size=16m,uid=1000,gid=1000,mode=700',
      '--tmpfs=/var/tmp:rw,nosuid,nodev,noexec,size=16m,mode=1777',
      '--unsetenv-all', '--env=PATH=/usr/local/bin:/usr/bin:/bin', '--env=LANG=C.UTF-8',
      '--env=HOME=/tmp/poxey-home', '--env=XDG_RUNTIME_DIR=/run/poxey',
      '--env=PULSE_SERVER=unix:/run/poxey/pulse/native',
      image,
    ],
  }
}

export function ownedWorkerCleanup(spec, inspected) {
  const name = `poxey-offline-${spec.sessionId}`
  if (!UUID.test(spec.sessionId) || !UUID.test(spec.attemptId) || spec.stage !== 'offline-prototype-only' || spec.name !== name) throw new Error('Invalid worker ownership specification')
  const labels = inspected?.Config?.Labels
  if (inspected?.Name !== name || labels?.['org.poxey.owner'] !== OWNER || labels?.['org.poxey.session'] !== spec.sessionId || labels?.['org.poxey.attempt'] !== spec.attemptId || !/^[0-9a-f]{64}$/.test(inspected?.Id || '')) {
    throw new Error('Refusing cleanup of a resource without matching ownership')
  }
  // Commands are returned as argv arrays; caller must stop successfully before removal.
  return [['stop', '--time=5', inspected.Id], ['rm', inspected.Id]]
}
