// All commands use one discovered/explicit Pulse server. Never fall back to a
// shared default sink when this session's audio initialization fails.
export function createSessionSink(id, { run, env, own }) {
  if (!/^[0-9a-f-]{36}$/.test(id)) throw new Error('Invalid audio session identity')
  const name = `poxey_${id.replace(/-/g, '_')}`
  const invoke = args => {
    const result = run('pactl', args, { env, encoding: 'utf8', timeout: 3000, maxBuffer: 1024 * 1024 })
    if (result.status !== 0) throw new Error('Session audio server is unavailable')
    return result.stdout.trim()
  }
  invoke(['info'])
  const moduleId = invoke(['load-module', 'module-null-sink', `sink_name=${name}`, 'rate=44100', 'channels=2'])
  if (!/^\d+$/.test(moduleId)) throw new Error('Session audio sink creation failed')
  const sink = { name, moduleId }
  own(sink) // Register immediately, before any readiness check can throw.
  const sinks = JSON.parse(invoke(['--format=json', 'list', 'sinks']))
  const sources = JSON.parse(invoke(['--format=json', 'list', 'sources']))
  if (!Array.isArray(sinks) || !Array.isArray(sources) ||
      !sinks.some(item => item.name === name && String(item.owner_module) === moduleId) ||
      !sources.some(item => item.name === `${name}.monitor` && String(item.owner_module) === moduleId)) {
    throw new Error('Session audio sink monitor is not ready')
  }
  return sink
}
