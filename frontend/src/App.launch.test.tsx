import React from 'react'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { App } from './App'

vi.mock('./components/VNCViewer', () => ({ default: React.forwardRef(({ token }: any, _ref) => <div data-testid="viewer">{token}</div>) }))
vi.mock('./PoxeyAudio', () => ({ default: ({ audioToken }: any) => <div data-testid="audio">{audioToken}</div> }))
vi.mock('./sessionHeartbeat', () => ({ startPoxeyHeartbeat: vi.fn(), stopPoxeyHeartbeat: vi.fn(), endPoxeySession: vi.fn() }))
let transport: ReturnType<typeof vi.fn>
beforeEach(() => {
  vi.useFakeTimers()
  vi.spyOn(Math, 'random').mockReturnValue(0)
  vi.spyOn(console, 'error').mockImplementation(() => {})
  transport = vi.fn()
  vi.stubGlobal('fetch', transport)
})
afterEach(() => { cleanup(); vi.useRealTimers(); vi.restoreAllMocks(); vi.unstubAllGlobals() })
function start() {
  const rendered = render(<App />)
  fireEvent.click(screen.getByRole('checkbox'))
  fireEvent.click(screen.getByRole('button', { name: 'Launch Browser' }))
  return rendered
}
it('keeps launch disabled through contention and passes the original token to VNC and audio', async () => {
  transport.mockResolvedValueOnce({ status: 429, ok: false, json: async () => ({ error: 'SESSION_CREATION_BUSY' }) })
    .mockResolvedValue({ status: 201, ok: true, json: async () => ({ token: 'session-one', remainingMs: 1500000 }) })
  start()
  const button = screen.getByRole('button', { name: 'Starting Browser...' }) as HTMLButtonElement
  expect(button.disabled).toBe(true)
  fireEvent.click(button)
  expect(transport).toHaveBeenCalledTimes(1)
  await act(() => vi.advanceTimersByTimeAsync(500))
  expect(screen.getByTestId('viewer').textContent).toBe('session-one')
  expect(screen.getByTestId('audio').textContent).toBe('session-one')
  expect(screen.getByText('25:00')).toBeTruthy()
  expect(transport).toHaveBeenCalledTimes(2)
})
it.each([
  ['ALLOWANCE_EXHAUSTED', 'Your 25-minute Free allowance has been used. Please wait for your 24-hour allowance to reset.'],
  ['ACTIVE_SESSION', 'This device already has an active Poxey session.'],
  ['MAX_SESSIONS', 'Session creation failed: 429'],
])('preserves the %s message and enables a future user action without retry', async (error, message) => {
  transport.mockResolvedValue({ status: 429, ok: false, json: async () => ({ error }) })
  start()
  await act(() => vi.advanceTimersByTimeAsync(0))
  expect(screen.getByText(message)).toBeTruthy()
  expect((screen.getByRole('button', { name: 'Launch Browser' }) as HTMLButtonElement).disabled).toBe(false)
  expect(transport).toHaveBeenCalledTimes(1)
})
it('unmount cancels busy retries and removes all launch timers', async () => {
  transport.mockResolvedValue({ status: 429, ok: false, json: async () => ({ error: 'SESSION_CREATION_BUSY' }) })
  const rendered = start()
  await act(() => vi.advanceTimersByTimeAsync(0))
  rendered.unmount()
  await act(() => vi.runAllTimersAsync())
  expect(transport).toHaveBeenCalledTimes(1)
  expect(vi.getTimerCount()).toBe(0)
})
it('unmount aborts the in-flight request without retrying', async () => {
  let requestSignal: AbortSignal
  transport.mockImplementation((_url, { signal }) => {
    requestSignal = signal
    return new Promise((_resolve, reject) => signal.addEventListener('abort', () => reject(signal.reason)))
  })
  const rendered = start()
  rendered.unmount()
  await act(() => vi.runAllTimersAsync())
  expect(requestSignal!.aborted).toBe(true)
  expect(transport).toHaveBeenCalledTimes(1)
  expect(vi.getTimerCount()).toBe(0)
})
