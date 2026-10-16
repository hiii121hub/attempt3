// A lease covers starting, active and cleaning-up resources in this single broker.
// Reserve synchronously before the first await; release only after owned cleanup.
export function sessionCapacity(limit) {
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > 100) throw new Error('Invalid session capacity')
  const leases = new Set()
  return {
    get occupied() { return leases.size },
    reserve() {
      if (leases.size >= limit) return null
      const id = Symbol('session capacity')
      leases.add(id)
      return { release() { leases.delete(id) } }
    },
  }
}
