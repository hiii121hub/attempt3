// child.killed means a signal was sent, not that the process exited.
export function processRunning(child) {
  return Boolean(child?.pid && child.exitCode === null && child.signalCode === null)
}

export async function teardownResources({ children, killTree, isAlive, removeSink, removeDirectory, wait }) {
  const errors = []
  const attempt = async action => { try { await action() } catch (error) { errors.push(error) } }
  for (const child of children) await attempt(() => { if (isAlive(child)) killTree(child, 'SIGTERM') })
  await attempt(() => wait(1500))
  for (const child of children) await attempt(() => { if (isAlive(child)) killTree(child, 'SIGKILL') })
  await attempt(() => wait(250))
  if (children.some(isAlive)) errors.push(new Error('Owned session process did not exit'))
  await attempt(removeSink)
  // Do not delete a profile that an owned process might still be writing.
  if (!children.some(isAlive)) await attempt(removeDirectory)
  if (errors.length) throw new AggregateError(errors, 'Session resource teardown failed')
}
