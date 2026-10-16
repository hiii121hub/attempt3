// Own only resources created by one startup attempt until the session is published.
export function startupResources({ killTree, isAlive, removeSink, removeDirectory, wait }) {
  const children = []
  let sink = null
  let directory = null
  let committed = false
  let rollbackPromise
  return {
    directory(value) { directory = value },
    child(value) { children.push(value); return value },
    sink(value) { sink = value; return value },
    commit() { committed = true },
    rollback() {
      if (committed) return Promise.resolve()
      if (rollbackPromise) return rollbackPromise
      rollbackPromise = (async () => {
        const errors = []
        const attempt = async action => { try { await action() } catch (error) { errors.push(error) } }
        for (const child of children) await attempt(() => killTree(child, 'SIGTERM'))
        await attempt(() => wait(1500))
        for (const child of children) await attempt(() => { if (isAlive(child)) killTree(child, 'SIGKILL') })
        await attempt(() => wait(250))
        if (sink?.moduleId) await attempt(() => removeSink(sink.moduleId))
        if (directory) await attempt(() => removeDirectory(directory))
        if (errors.length) throw new AggregateError(errors, 'Session startup rollback failed')
      })()
      return rollbackPromise
    },
  }
}
