import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { startPoxeyHeartbeat, stopPoxeyHeartbeat } from './sessionHeartbeat'

describe('sessionHeartbeat', () => {
  let nextTimerId = 0

  beforeEach(() => {
    vi.restoreAllMocks()
    nextTimerId = 0
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          ok: true,
          remainingMs: 25 * 60 * 1000,
        }),
      })
    )
    vi.spyOn(window, 'setInterval').mockImplementation(((..._args: any[]) => {
      nextTimerId += 1
      return nextTimerId as unknown as number
    }) as typeof window.setInterval)
    vi.spyOn(window, 'clearInterval').mockImplementation(() => undefined)
  })

  afterEach(() => {
    for (const token of ['token-failed', 'token-recovery', 'token-a', 'token-b', 'token-refresh']) {
      stopPoxeyHeartbeat(token)
    }
    vi.unstubAllGlobals()
  })

  it('ends the active session on pagehide using the existing same-origin beacon', async () => {
    const sendBeacon = vi.fn().mockReturnValue(true)
    vi.stubGlobal('navigator', { sendBeacon })
    startPoxeyHeartbeat('token-refresh')

    window.dispatchEvent(new Event('pagehide'))

    expect(sendBeacon).toHaveBeenCalledTimes(1)
    const [url, body] = sendBeacon.mock.calls[0]
    expect(url).toBe('/__poxey_session/session/end')
    expect(body).toBeInstanceOf(Blob)
    expect(body.type).toBe('application/json')
    const contents = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(String(reader.result))
      reader.onerror = () => reject(reader.error)
      reader.readAsText(body)
    })
    expect(JSON.parse(contents)).toEqual({ token: 'token-refresh' })
    expect(fetch).not.toHaveBeenCalledWith(
      expect.stringContaining('/session/create'), expect.anything(),
    )
  })

  it('removes stopped-session pagehide handlers without ending another active session', () => {
    const sendBeacon = vi.fn().mockReturnValue(true)
    vi.stubGlobal('navigator', { sendBeacon })
    startPoxeyHeartbeat('token-a')
    startPoxeyHeartbeat('token-b')
    stopPoxeyHeartbeat('token-a')

    window.dispatchEvent(new Event('pagehide'))
    expect(sendBeacon).toHaveBeenCalledTimes(1)
    stopPoxeyHeartbeat('token-b')
    window.dispatchEvent(new Event('pagehide'))
    expect(sendBeacon).toHaveBeenCalledTimes(1)
  })

  it('does not automatically end the session when a heartbeat request fails', async () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined)

    const fetchSpy = fetch as ReturnType<typeof vi.fn>
    fetchSpy.mockRejectedValueOnce(new Error('network failure'))

    startPoxeyHeartbeat('token-failed')

    await new Promise(resolve => setTimeout(resolve, 0))

    const endCalls = (fetch as ReturnType<typeof vi.fn>).mock.calls.filter(
      ([url]) => url === '/__poxey_session/session/end',
    )

    expect(endCalls).toHaveLength(0)
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      '[Poxey heartbeat FAILED]',
      expect.any(Error),
    )

    consoleErrorSpy.mockRestore()
  })

  it('keeps the heartbeat running after a temporary heartbeat failure', async () => {
    const fetchSpy = fetch as ReturnType<typeof vi.fn>
    const consoleErrorSpy = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined)

    let heartbeatCallback: (() => void) | undefined

    vi.spyOn(window, 'setInterval').mockImplementation(((callback: TimerHandler) => {
      heartbeatCallback = callback as () => void
      return 1 as unknown as number
    }) as typeof window.setInterval)

    fetchSpy
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          ok: true,
          remainingMs: 25 * 60 * 1000,
        }),
      })
      .mockRejectedValueOnce(new Error('temporary network failure'))
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          ok: true,
          remainingMs: 24 * 60 * 1000,
        }),
      })
      .mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          ok: true,
          remainingMs: 23 * 60 * 1000,
        }),
      })

    startPoxeyHeartbeat('token-recovery')

    await new Promise(resolve => setTimeout(resolve, 0))

    expect(heartbeatCallback).toBeDefined()

    heartbeatCallback?.()
    await new Promise(resolve => setTimeout(resolve, 0))

    heartbeatCallback?.()
    await new Promise(resolve => setTimeout(resolve, 0))

    const heartbeatCalls = fetchSpy.mock.calls.filter(
      ([url]) => url === '/__poxey_session/session/heartbeat',
    )

    expect(heartbeatCalls).toHaveLength(3)

    expect(consoleErrorSpy).toHaveBeenCalledWith(
      '[Poxey heartbeat FAILED]',
      expect.any(Error),
    )

    await stopPoxeyHeartbeat('token-recovery')

    consoleErrorSpy.mockRestore()
  })

  it('keeps each session token independent so a second session does not cancel the first', async () => {
    const setIntervalSpy = vi.spyOn(window, 'setInterval')

    startPoxeyHeartbeat('token-a')
    startPoxeyHeartbeat('token-b')

    expect(setIntervalSpy).toHaveBeenCalledTimes(2)

    const timerA = setIntervalSpy.mock.results[0]?.value as number
    const timerB = setIntervalSpy.mock.results[1]?.value as number

    expect(timerA).toBe(1)
    expect(timerB).toBe(2)

    await stopPoxeyHeartbeat('token-a')

    expect(window.clearInterval).toHaveBeenCalledWith(timerA)
    expect(window.clearInterval).not.toHaveBeenCalledWith(timerB)

    const endCalls = (fetch as ReturnType<typeof vi.fn>).mock.calls.filter(
      ([url]) => url === '/__poxey_session/session/end'
    )

    expect(endCalls).toHaveLength(0)
  })
})
