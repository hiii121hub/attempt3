import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { requestSession, MAX_LAUNCH_ATTEMPTS, LAUNCH_TIMEOUT_MS } from './sessionLaunch'

const reply = (status: number, data: object) => ({ status, ok: status === 201, json: async () => data })
const busy = () => reply(429, { error: 'SESSION_CREATION_BUSY' })
let transport: ReturnType<typeof vi.fn>
beforeEach(() => {
  vi.useFakeTimers()
  vi.spyOn(Math, 'random').mockReturnValue(0)
  transport = vi.fn()
  vi.stubGlobal('fetch', transport)
})
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); vi.unstubAllGlobals() })
const launch = (signal = new AbortController().signal) => requestSession('/session/create', signal)

it('returns immediate success unchanged with one POST and no timers', async () => {
  const data = { token: 'unique', remainingMs: 1500000 }
  transport.mockResolvedValue(reply(201, data))
  expect((await launch()).data).toBe(data)
  expect(transport).toHaveBeenCalledTimes(1)
  expect(vi.getTimerCount()).toBe(0)
})
it('recovers from multiple busy responses using increasing delays', async () => {
  transport.mockResolvedValueOnce(busy()).mockResolvedValueOnce(busy()).mockResolvedValue(reply(201, { token: 'one' }))
  const pending = launch()
  await vi.advanceTimersByTimeAsync(499)
  expect(transport).toHaveBeenCalledTimes(1)
  await vi.advanceTimersByTimeAsync(1)
  expect(transport).toHaveBeenCalledTimes(2)
  await vi.advanceTimersByTimeAsync(1000)
  expect((await pending).data.token).toBe('one')
  expect(transport).toHaveBeenCalledTimes(3)
  expect(vi.getTimerCount()).toBe(0)
})
it('bounds the number of requests when contention persists', async () => {
  transport.mockResolvedValue(busy())
  const result = launch().catch(error => error)
  await vi.runAllTimersAsync()
  expect((await result).message).toContain('still starting other browsers')
  expect(transport).toHaveBeenCalledTimes(MAX_LAUNCH_ATTEMPTS)
  expect(vi.getTimerCount()).toBe(0)
})
it('enforces the overall deadline while waiting between attempts', async () => {
  vi.mocked(Math.random).mockReturnValue(0.999)
  transport.mockResolvedValue(busy())
  const result = launch().catch(error => error)
  await vi.advanceTimersByTimeAsync(LAUNCH_TIMEOUT_MS)
  expect((await result).message).toContain('still starting other browsers')
  expect(transport.mock.calls.length).toBeLessThan(MAX_LAUNCH_ATTEMPTS)
  expect(vi.getTimerCount()).toBe(0)
})
it.each([
  [429, 'ALLOWANCE_EXHAUSTED'], [429, 'ACTIVE_SESSION'], [429, 'MAX_SESSIONS'],
  [401, 'SESSION_CREATION_BUSY'], [403, 'FORBIDDEN'], [500, 'UNKNOWN'], [429, 'UNKNOWN'],
])('does not retry HTTP %s error %s', async (status, error) => {
  transport.mockResolvedValue(reply(status, { error }))
  expect((await launch()).data.error).toBe(error)
  expect(transport).toHaveBeenCalledTimes(1)
  expect(vi.getTimerCount()).toBe(0)
})
it('does not retry malformed error responses', async () => {
  transport.mockResolvedValue({ status: 429, json: async () => { throw new Error('invalid JSON') } })
  expect((await launch()).data).toEqual({})
  expect(transport).toHaveBeenCalledTimes(1)
})
it('never retries an ambiguous network failure', async () => {
  transport.mockRejectedValue(new Error('connection lost'))
  await expect(launch()).rejects.toThrow('connection lost')
  expect(transport).toHaveBeenCalledTimes(1)
  expect(vi.getTimerCount()).toBe(0)
})
it('aborts an in-flight deadline without a second POST', async () => {
  transport.mockImplementation((_url, { signal }) => new Promise((_resolve, reject) => {
    signal.addEventListener('abort', () => reject(signal.reason), { once: true })
  }))
  const result = launch().catch(error => error)
  await vi.advanceTimersByTimeAsync(LAUNCH_TIMEOUT_MS)
  expect((await result).message).toContain('may still be starting')
  expect(transport).toHaveBeenCalledTimes(1)
  expect(vi.getTimerCount()).toBe(0)
})
it('cancels backoff without orphan timers or further requests', async () => {
  transport.mockResolvedValue(busy())
  const controller = new AbortController()
  const result = launch(controller.signal).catch(error => error)
  await vi.advanceTimersByTimeAsync(0)
  controller.abort()
  expect((await result).name).toBe('AbortError')
  await vi.runAllTimersAsync()
  expect(transport).toHaveBeenCalledTimes(1)
  expect(vi.getTimerCount()).toBe(0)
})
it('does not send a request for an already canceled action', async () => {
  const controller = new AbortController()
  controller.abort()
  await expect(launch(controller.signal)).rejects.toMatchObject({ name: 'AbortError' })
  expect(transport).not.toHaveBeenCalled()
})
it('serializes five independent clients against a simulated startup lock', async () => {
  let locked = false
  let created = 0
  transport.mockImplementation(async () => {
    if (locked) return busy()
    locked = true
    await new Promise(resolve => setTimeout(resolve, created === 0 ? 23000 : 4500))
    const token = `session-${++created}`
    locked = false
    return reply(201, { token })
  })
  const pending = Promise.all(Array.from({ length: 5 }, () => launch()))
  await vi.runAllTimersAsync()
  expect(new Set((await pending).map(result => result.data.token)).size).toBe(5)
  expect(created).toBe(5)
  expect(vi.getTimerCount()).toBe(0)
})
