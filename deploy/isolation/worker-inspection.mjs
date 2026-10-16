// Strict Podman-5 inspection contract, NOT proof of effective kernel enforcement.
// Unsupported/missing fields fail closed; qualify exact host output before use.
import { ownedWorkerCleanup } from './worker-spec.mjs'

const empty = value => value === null || (value !== undefined && typeof value === 'object' && Object.keys(value).length === 0)
const bytes = value => {
  const match = /^(\d+)([kmgt]?)$/i.exec(value || '')
  return match ? Number(match[1]) * 1024 ** ({ '': 0, k: 1, m: 2, g: 3, t: 4 }[match[2].toLowerCase()]) : NaN
}
function privateTmpfs(value, size, runtime = false) {
  if (typeof value !== 'string') return false
  const options = value.split(',')
  if (new Set(options.map(option => option.split('=')[0])).size !== options.length) return false
  const setting = key => options.find(option => option.startsWith(key + '='))?.slice(key.length + 1)
  return ['rw', 'nosuid', 'nodev', 'noexec'].every(option => options.includes(option)) &&
    bytes(setting('size')) === size * 1024 * 1024 && (runtime ?
      /^0?700$/.test(setting('mode')) && setting('uid') === '1000' && setting('gid') === '1000' :
      /^0?1777$/.test(setting('mode')))
}

export function verifyWorkerInspection(spec, inspected) {
  ownedWorkerCleanup(spec, inspected)
  const h = inspected.HostConfig, c = inspected.Config, q = spec.limits
  const checks = {
    pinnedImage: inspected.ImageDigest === spec.args.at(-1).split('@')[1],
    nonRoot: c.User === '1000:1000',
    privateNamespaces: h?.NetworkMode === 'none' && h?.PidMode === 'private' && h?.IpcMode === 'private' &&
      h?.CgroupMode === 'private' && h?.UTSMode === 'private' && /^auto(?::.*)?$/.test(h?.UsernsMode || ''),
    noPrivileges: h?.Privileged === false && h?.ReadonlyRootfs === true && empty(h?.CapAdd) &&
      Array.isArray(inspected.EffectiveCaps) && inspected.EffectiveCaps.length === 0 &&
      Array.isArray(inspected.BoundingCaps) && inspected.BoundingCaps.length === 0 &&
      Array.isArray(h?.SecurityOpt) && h.SecurityOpt.some(v => /^no-new-privileges(?::true|=true)?$/.test(v)) &&
      !h.SecurityOpt.some(v => /unconfined|unmask/i.test(v)),
    noHostAccess: h && empty(h.Binds) && empty(h.Devices) && empty(h.VolumesFrom) && empty(h.ExtraHosts) &&
      h.PublishAllPorts === false && empty(h.PortBindings) && empty(inspected.NetworkSettings?.Ports) &&
      Array.isArray(inspected.Mounts) && inspected.Mounts.every(m => m.Type === 'tmpfs' && ['/tmp', '/run', '/var/tmp', '/dev/shm'].includes(m.Destination)),
    memory: h?.Memory === q.memoryMiB * 1024 * 1024 && h?.MemorySwap === (q.memoryMiB + 1) * 1024 * 1024 && h?.OomKillDisable === false,
    processes: h?.PidsLimit === q.pids,
    cpu: h?.NanoCpus > 0 ? h.NanoCpus === q.cpuMillis * 1000000 : h?.CpuPeriod > 0 && h?.CpuQuota > 0 && h.CpuQuota / h.CpuPeriod === q.cpuMillis / 1000,
    privateTemporaryData: h?.ShmSize === q.shmMiB * 1024 * 1024 && h.Tmpfs &&
      Object.keys(h.Tmpfs).length === 3 && privateTmpfs(h.Tmpfs['/tmp'], q.tmpMiB) &&
      privateTmpfs(h.Tmpfs['/run'], 16, true) && privateTmpfs(h.Tmpfs['/var/tmp'], 16),
    noPersistentLogsOrRestart: h?.LogConfig?.Type === 'none' && ['no', ''].includes(h?.RestartPolicy?.Name),
    privateAudioEnvironment: Array.isArray(c.Env) && ['HOME=/tmp/poxey-home', 'XDG_RUNTIME_DIR=/run/poxey', 'PULSE_SERVER=unix:/run/poxey/pulse/native'].every(v => c.Env.includes(v)) &&
      c.Env.every(v => /^(PATH|LANG|HOME|XDG_RUNTIME_DIR|PULSE_SERVER|HOSTNAME|container)=/.test(v)) &&
      new Set(c.Env.map(v => v.split('=')[0])).size === c.Env.length,
  }
  const failed = Object.entries(checks).filter(([, valid]) => !valid).map(([key]) => key)
  if (failed.length) throw new Error(`Worker security inspection refused: ${failed.join(', ')}`)
  return Object.freeze({ configurationVerified: true, kernelBoundariesVerified: false })
}
