import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { startPoxeyHeartbeat, stopPoxeyHeartbeat } from './sessionHeartbeat'

describe('sessionHeartbeat', () => {
  let nextTimerId = 0

  beforeEach(() => {
    vi.restoreAllMocks()
    nextTimerId = 0
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: true, status: 200 })
    )
    vi.spyOn(window, 'setInterval').mockImplementation(((..._args: any[]) => {
      nextTimerId += 1
      return nextTimerId as unknown as number
    }) as typeof window.setInterval)
    vi.spyOn(window, 'clearInterval').mockImplementation(() => undefined)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
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
      ([url]) => url === '/__poxey_session/end'
    )

    expect(endCalls).toHaveLength(1)
    expect(endCalls[0]?.[1]).toMatchObject({
      body: JSON.stringify({ token: 'token-a' }),
    })
  })
})
