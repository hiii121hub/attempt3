// Synthetic Podman inspection for unit tests only. Not captured Linux evidence.
export function workerFixture(spec, id = 'b'.repeat(64)) {
  const q = spec.limits
  return {
    Id: id, Name: spec.name, ImageDigest: spec.args.at(-1).split('@')[1], State: { Running: false },
    Config: { User: '1000:1000', Env: spec.args.filter(v => v.startsWith('--env=')).map(v => v.slice(6)),
      Labels: Object.fromEntries(spec.args.filter(v => v.startsWith('--label=')).map(v => { const pair = v.slice(8), at = pair.indexOf('='); return [pair.slice(0, at), pair.slice(at + 1)] })) },
    EffectiveCaps: [], BoundingCaps: [], Mounts: [], NetworkSettings: { Ports: {} },
    HostConfig: {
      NetworkMode: 'none', PidMode: 'private', IpcMode: 'private', CgroupMode: 'private', UTSMode: 'private', UsernsMode: 'auto',
      Privileged: false, ReadonlyRootfs: true, CapAdd: [], SecurityOpt: ['no-new-privileges'],
      Binds: [], Devices: [], VolumesFrom: [], ExtraHosts: [], PublishAllPorts: false, PortBindings: {},
      Memory: q.memoryMiB * 1024 * 1024, MemorySwap: (q.memoryMiB + 1) * 1024 * 1024, OomKillDisable: false,
      PidsLimit: q.pids, CpuPeriod: 100000, CpuQuota: q.cpuMillis * 100, NanoCpus: 0,
      ShmSize: q.shmMiB * 1024 * 1024, LogConfig: { Type: 'none' }, RestartPolicy: { Name: 'no' },
      Tmpfs: { '/tmp': `rw,nosuid,nodev,noexec,size=${q.tmpMiB}m,mode=1777`, '/run': 'rw,nosuid,nodev,noexec,size=16m,uid=1000,gid=1000,mode=700', '/var/tmp': 'rw,nosuid,nodev,noexec,size=16m,mode=1777' },
    },
  }
}
