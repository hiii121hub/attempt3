// Transport-injected orchestration. Unit fixtures are explicitly NOT real Chrome.
export async function fiveUserRun({ durationSeconds, clients, create, heartbeat, open, sample, cleanup, signal, now = Date.now, wait = ms => new Promise(resolve => setTimeout(resolve, ms)) }) {
  if (clients.length !== 6 || !Number.isInteger(durationSeconds) || durationSeconds < 1 || durationSeconds > 1200) throw new Error('Six independent synthetic identities and a bounded duration are required')
  const report = { kind: 'automated-RFB-PCM-load-test', humanAcceptance: 'NOT VERIFIED', fileIsolation: 'NOT VERIFIED', realWebsiteWorkload: 'NOT VERIFIED', targetSeconds: durationSeconds, launches: [], samples: [], cleanupVerified: false }
  const owned = [], streams = []
  let failure, stage = 'launch'
  try {
    const launched = await Promise.allSettled(clients.slice(0, 5).map(async (client, index) => {
      const begun = now(), deadline = begun + 120000
      let response
      do {
        signal?.throwIfAborted()
        response = await create(client)
        if (response.status !== 429 || response.data.error !== 'SESSION_CREATION_BUSY') break
        await wait(500)
      } while (now() < deadline)
      if (response.status !== 201) throw new Error('Five-user launch failed')
      owned.push({ client, session: response.data, index })
      report.launches.push({ client: index + 1, creationMs: now() - begun })
      return response.data
    }))
    if (launched.some(v => v.status === 'rejected') || owned.length !== 5) throw new Error('Not all five sessions launched')
    if (new Set(owned.map(v => v.session.id)).size !== 5 || new Set(owned.map(v => v.session.token)).size !== 5) throw new Error('Duplicate sessions or tokens')
    stage = 'sixth-admission'
    const sixth = await create(clients[5])
    if (sixth.status === 201) owned.push({ client: clients[5], session: sixth.data, index: 5 })
    if (sixth.status !== 429 || sixth.data.error !== 'MAX_SESSIONS') throw new Error('Sixth admission was not cleanly rejected')
    report.sixthRejected = true
    // Outer production owner-cookie authorization, for BOTH existing WS routes.
    stage = 'authorization'
    for (const route of ['/websockify', '/audio']) {
      await open({ route, owner: owned[0], wrongClient: owned[1].client, rejectOnly: true })
      await open({ route, owner: owned[0], invalidToken: true, rejectOnly: true })
    }
    stage = 'stream-and-interaction-startup'
    for (const owner of owned) streams.push(await open({ owner }))
    stage = 'allowance-headroom'
    for (const owner of owned) {
      const response = await heartbeat(owner)
      if (response.status !== 200 || response.data.remainingMs < durationSeconds * 1000 + 30000) throw new Error('Insufficient unchanged allowance for sustained interval')
    }
    let pressureSamples = 0
    const begun = now()
    stage = 'sustained-monitoring'
    while (now() - begun < durationSeconds * 1000) {
      signal?.throwIfAborted()
      const metrics = await sample()
      report.samples.push(metrics)
      if (metrics.memoryAvailableMiB < 512 || metrics.memoryUsedFraction > 0.85 || metrics.oomEvents > 0) throw new Error('Memory pressure/OOM stop')
      pressureSamples = metrics.cpuPercent > 90 ? pressureSamples + 1 : 0
      if (pressureSamples >= 3) throw new Error('Sustained CPU pressure stop')
      await Promise.all(owned.map(async owner => {
        const started = now(), response = await heartbeat(owner)
        if (response.status !== 200 || response.data.remainingMs <= 0) throw new Error('Session heartbeat/allowance failure')
        report.heartbeatMaxMs = Math.max(report.heartbeatMaxMs || 0, now() - started)
      }))
      for (const stream of streams) await stream.check()
      await wait(Math.min(5000, durationSeconds * 1000 - (now() - begun)))
    }
    report.sustainedSeconds = (now() - begun) / 1000
    report.streams = streams.map(stream => stream.summary())
  } catch { failure = true; report.failedStage = stage }
  finally {
    for (const stream of streams) stream.close()
    try { await cleanup(owned); report.cleanupVerified = true } catch { failure = true; report.failedStage = 'cleanup' }
  }
  report.result = failure ? 'FAIL' : 'PASS'
  // Never expose tokens, cookies, arbitrary server errors or page contents.
  return report
}
