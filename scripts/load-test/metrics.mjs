import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'

export function linuxSampler({ read = file => fs.readFileSync(file, 'utf8'), now = Date.now, logicalCpus = os.cpus().length } = {}) {
  let previous, initialOom
  return () => {
    const time = now(), ticks = read('/proc/stat').split('\n')[0].trim().split(/\s+/).slice(1, 9).map(Number)
    if (ticks.length !== 8 || !ticks.every(Number.isFinite)) throw new Error('CPU telemetry unavailable')
    const memory = Object.fromEntries(read('/proc/meminfo').split('\n').filter(Boolean).map(line => { const [key, value] = line.split(':'); return [key, Number(value.trim().split(/\s+/)[0]) * 1024] }))
    const member = read('/proc/self/cgroup').split('\n').find(line => line.startsWith('0::'))?.slice(3)
    if (!member || member.split('/').includes('..')) throw new Error('cgroup v2 telemetry required')
    const root = path.posix.join('/sys/fs/cgroup', member)
    const value = name => read(`${root}/${name}`).trim()
    const memoryMax = value('memory.max'), current = Number(value('memory.current'))
    const events = Object.fromEntries(value('memory.events').split('\n').map(line => line.split(/\s+/)))
    const cpu = Object.fromEntries(value('cpu.stat').split('\n').map(line => line.split(/\s+/)))
    const [quota, period] = value('cpu.max').split(/\s+/), allocated = quota === 'max' ? logicalCpus : Number(quota) / Number(period)
    const ceiling = Math.min(memory.MemTotal, memoryMax === 'max' ? Infinity : Number(memoryMax))
    const available = Math.min(memory.MemAvailable, memoryMax === 'max' ? Infinity : ceiling - current)
    const total = ticks.reduce((sum, n) => sum + n, 0), idle = ticks[3] + ticks[4], oom = Number(events.oom_kill), usage = Number(cpu.usage_usec)
    const pids = Number(value('pids.current'))
    if (![ceiling, available, oom, usage, allocated, pids].every(Number.isFinite) || ceiling <= 0 || allocated <= 0 || available < 0) throw new Error('Invalid resource telemetry')
    initialOom ??= oom
    const hostCpuPercent = previous && total > previous.total ? 100 * (1 - (idle - previous.idle) / (total - previous.total)) : 0
    const cgroupCpuPercent = previous && time > previous.time ? 100 * (usage - previous.usage) / ((time - previous.time) * 1000 * allocated) : 0
    const interfaces = Object.fromEntries(read('/proc/net/dev').split('\n').slice(2).filter(line => line.includes(':')).map(line => {
      const [name, data] = line.split(':'), fields = data.trim().split(/\s+/).map(Number)
      if (fields.length !== 16 || !fields.every(Number.isFinite)) throw new Error('Network telemetry unavailable')
      return [name.trim(), { rx: fields[0], tx: fields[8] }]
    }))
    previous = { time, total, idle, usage }
    return { atUTC: new Date(time).toISOString(), cpuPercent: Math.max(hostCpuPercent, cgroupCpuPercent), hostCpuPercent, cgroupCpuPercent,
      effectiveMemoryMiB: ceiling / 1048576, memoryAvailableMiB: available / 1048576, memoryUsedFraction: 1 - available / ceiling,
      cgroupPids: pids, oomEvents: oom - initialOom, networkInterfaceCounters: interfaces }
  }
}
