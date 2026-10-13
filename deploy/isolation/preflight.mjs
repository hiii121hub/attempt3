// Read-only host qualification. Passing this does not prove session isolation.
import fs from 'node:fs'
import os from 'node:os'
import { spawnSync } from 'node:child_process'
import { pathToFileURL } from 'node:url'

export function evaluateHost(host) {
  const requiredIds = 5 * 65536
  return {
    linux: host.platform === 'linux',
    nonRoot: Number.isInteger(host.uid) && host.uid > 0,
    supportedPodman: host.podmanMajor >= 5,
    rootless: host.rootless === true,
    cgroupV2: host.cgroupVersion === 'v2',
    delegatedLimits: ['cpu', 'memory', 'pids'].every(name => host.controllers?.includes(name)),
    separateUserNamespaceRanges: host.subuids >= requiredIds && host.subgids >= requiredIds,
    nestedUserNamespaces: host.userNamespaces === true,
  }
}
function run(command, args) {
  return spawnSync(command, args, { encoding: 'utf8', timeout: 5000, maxBuffer: 1024 * 1024 })
}
function ranges(file, user, uid) {
  try {
    return fs.readFileSync(file, 'utf8').split('\n').reduce((sum, line) => {
      const [owner, , size] = line.split(':')
      return owner === user || owner === String(uid) ? sum + (Number(size) || 0) : sum
    }, 0)
  } catch { return 0 }
}
export function inspectHost() {
  const host = { platform: process.platform, uid: process.getuid?.() }
  if (host.platform !== 'linux') return host
  const info = run('podman', ['info', '--format', 'json'])
  try {
    if (info.status === 0) {
      const data = JSON.parse(info.stdout)
      host.rootless = data.host?.security?.rootless
      host.cgroupVersion = data.host?.cgroupVersion
      host.controllers = data.host?.cgroupControllers
    }
  } catch {}
  const version = run('podman', ['--version'])
  host.podmanMajor = Number(version.stdout?.match(/podman version (\d+)\./)?.[1])
  host.userNamespaces = run('unshare', ['--user', '--map-root-user', 'true']).status === 0
  const user = os.userInfo().username
  host.subuids = ranges('/etc/subuid', user, host.uid)
  host.subgids = ranges('/etc/subgid', user, host.uid)
  return host
}
if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  const checks = evaluateHost(inspectHost())
  console.log(JSON.stringify({ readyForIsolationPrototype: Object.values(checks).every(Boolean), checks, note: 'Prerequisites only; no containers started and no security boundary verified.' }, null, 2))
  process.exitCode = Object.values(checks).every(Boolean) ? 0 : 2
}
