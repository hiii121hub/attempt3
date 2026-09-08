import React, {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from 'react'

export interface VNCViewerHandle {
  navigate: (url: string) => void
  back: () => void
  forward: () => void
  reload: () => void
  stop: () => void
  newTab: () => void
  closeTab: () => void
  nextTab: () => void
  previousTab: () => void
}

interface VNCViewerProps {
  onConnected?: () => void
}

const VNCViewer = forwardRef<VNCViewerHandle, VNCViewerProps>(
  ({ onConnected }, ref) => {
  const targetRef = useRef<HTMLDivElement>(null)
  const rfbRef = useRef<any>(null)
  const mobileInputRef = useRef<HTMLInputElement>(null)
  const previousInputRef = useRef('')
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const mountedRef = useRef(false)
  const keysymLookupRef = useRef<(codePoint: number) => number>((codePoint) =>
    codePoint <= 0xff ? codePoint : 0x01000000 | codePoint
  )

  const [status, setStatus] = useState('Loading noVNC...')
  const [connected, setConnected] = useState(false)
    const [remoteSize, setRemoteSize] = useState(100)
  const [isTouchDevice, setIsTouchDevice] = useState(false)
  const scrollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    const checkTouchDevice = () => {
      const mediaQueryList = typeof window !== 'undefined' && typeof window.matchMedia === 'function'
        ? window.matchMedia('(pointer: coarse)')
        : null

      setIsTouchDevice(Boolean(mediaQueryList?.matches) || navigator.maxTouchPoints > 0)
    }

    checkTouchDevice()
    window.addEventListener('resize', checkTouchDevice)

    return () => {
      window.removeEventListener('resize', checkTouchDevice)

      if (scrollTimerRef.current !== null) {
        clearInterval(scrollTimerRef.current)
        scrollTimerRef.current = null
      }
    }
  }, [])

  const sendWheelStep = (direction: 'up' | 'down') => {
    const target = targetRef.current

    if (!target || !connected) return

    const canvas = target.querySelector('canvas') as HTMLCanvasElement | null

    if (!canvas) return

    const rect = canvas.getBoundingClientRect()

    const clientX = rect.left + rect.width / 2
    const clientY = rect.top + rect.height / 2

    canvas.dispatchEvent(
      new WheelEvent('wheel', {
        bubbles: true,
        cancelable: true,
        clientX,
        clientY,
        deltaX: 0,
        deltaY: direction === 'down' ? 50 : -50,
        deltaMode: 0,
      })
    )
  }

  const startScrolling = (direction: 'up' | 'down') => {
    if (scrollTimerRef.current !== null) return

    sendWheelStep(direction)

    scrollTimerRef.current = setInterval(() => {
      sendWheelStep(direction)
    }, 90)
  }

  const stopScrolling = () => {
    if (scrollTimerRef.current !== null) {
      clearInterval(scrollTimerRef.current)
      scrollTimerRef.current = null
    }
  }

  useEffect(() => {
    let cancelled = false
    mountedRef.current = true

    const loadVNC = async () => {
      try {
        const moduleUrl = new URL('/rfb.js', window.location.origin).href
        const module = await import(/* @vite-ignore */ moduleUrl)
        const keysymUrl = new URL('/core/input/keysymdef.js', window.location.origin).href
        const keysymModule = await import(/* @vite-ignore */ keysymUrl)

        keysymLookupRef.current = keysymModule.default.lookup

        if (!cancelled) {
          initializeVNC(module.default)
        }
      } catch (error) {
        console.error('Failed to load noVNC:', error)
        setStatus(`noVNC error: ${error instanceof Error ? error.message : String(error)}`)
      }
    }

    loadVNC()

    return () => {
      cancelled = true
      mountedRef.current = false

      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current)
        reconnectTimerRef.current = null
      }

      if (rfbRef.current) {
        rfbRef.current.disconnect()
      }
    }
  }, [])

  const initializeVNC = (RFB: any) => {
    if (!targetRef.current || !RFB) {
      setStatus('VNC display or RFB not ready')
      return
    }

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    const vncUrl = `${protocol}//${window.location.host}/websockify`

    setStatus('Connecting to remote Chromium...')

    try {
      const rfb = new RFB(
        targetRef.current,
        vncUrl,
        {
          credentials: {
            password: '',
          },
        }
      )

      rfb.scaleViewport = false
      rfb.resizeSession = false
      rfb.clipViewport = false
      rfb.viewOnly = false

      rfb.addEventListener('connect', () => {
        console.log('VNC connected')
        setStatus('Connected')
        setConnected(true)
        window.setTimeout(() => onConnected?.(), 0)
      })

      rfb.addEventListener('disconnect', () => {
        console.log('VNC disconnected')
        setStatus('Disconnected')
        setConnected(false)
        if (rfbRef.current === rfb) {
          rfbRef.current = null
        }
        scheduleReconnect(RFB)
      })

      rfb.addEventListener('securityfailure', (event: any) => {
        console.error('VNC security failure:', event)
        setStatus('VNC security failure')
      })

      rfb.addEventListener('error', (event: any) => {
        console.error('VNC error:', event)
        setStatus('VNC error')
        scheduleReconnect(RFB)
      })

      rfbRef.current = rfb
    } catch (error) {
      console.error('Failed to create VNC connection:', error)
      setStatus('Failed to connect')
    }
  }

  const scheduleReconnect = (RFB: any) => {
    if (!mountedRef.current || reconnectTimerRef.current || rfbRef.current) return

    setStatus('Reconnecting...')
    reconnectTimerRef.current = setTimeout(() => {
      reconnectTimerRef.current = null
      if (mountedRef.current && !rfbRef.current) {
        initializeVNC(RFB)
      }
    }, 3000)
  }

  const focusMobileKeyboard = () => {
    const input = mobileInputRef.current

    if (!input) return

    input.value = ''
    previousInputRef.current = ''
    input.focus()
  }

  const sendKey = (keysym: number, code: string) => {
    const rfb = rfbRef.current

    if (rfb && connected) {
      rfb.sendKey(keysym, code)
    }
  }

  const pressKey = (keysym: number, code: string) => {
    const rfb = rfbRef.current

    if (!rfb || !connected) return

    rfb.sendKey(keysym, code, true)
    rfb.sendKey(keysym, code, false)
  }

  const sendShortcut = (
    modifier: [number, string],
    key: [number, string]
  ) => {
    const rfb = rfbRef.current

    if (!rfb || !connected) return

    rfb.sendKey(modifier[0], modifier[1], true)
    rfb.sendKey(key[0], key[1], true)
    rfb.sendKey(key[0], key[1], false)
    rfb.sendKey(modifier[0], modifier[1], false)
  }

  const sendModifiedShortcut = (
    modifiers: [number, string][],
    key: [number, string]
  ) => {
    const rfb = rfbRef.current

    if (!rfb || !connected) return

    for (const modifier of modifiers) {
      rfb.sendKey(modifier[0], modifier[1], true)
    }
    rfb.sendKey(key[0], key[1], true)
    rfb.sendKey(key[0], key[1], false)
    for (const modifier of [...modifiers].reverse()) {
      rfb.sendKey(modifier[0], modifier[1], false)
    }
  }

  const sendText = (text: string) => {
    for (const character of Array.from(text)) {
      const codePoint = character.codePointAt(0)
      if (codePoint === undefined) continue
      pressKey(keysymLookupRef.current(codePoint), 'Unidentified')
    }
  }

  const navigate = (url: string) => {
    sendShortcut(keysyms.Control, keysyms.L)
    sendText(url)
    pressKey(keysyms.Enter[0], keysyms.Enter[1])
  }

  const browserCommands: VNCViewerHandle = {
    navigate,
    back: () => sendShortcut(keysyms.Alt, keysyms.ArrowLeft),
    forward: () => sendShortcut(keysyms.Alt, keysyms.ArrowRight),
    reload: () => sendShortcut(keysyms.Control, keysyms.R),
    stop: () => pressKey(keysyms.Escape[0], keysyms.Escape[1]),
    newTab: () => sendShortcut(keysyms.Control, keysyms.T),
    closeTab: () => sendShortcut(keysyms.Control, keysyms.W),
    nextTab: () => sendShortcut(keysyms.Control, keysyms.Tab),
    previousTab: () =>
      sendModifiedShortcut([keysyms.Control, keysyms.Shift], keysyms.Tab),
  }

  useImperativeHandle(ref, () => browserCommands, [connected])

  const keysyms: Record<string, [number, string]> = {
    Backspace: [0xff08, 'Backspace'],
    Delete: [0xffff, 'Delete'],
    Enter: [0xff0d, 'Enter'],
    Escape: [0xff1b, 'Escape'],
    Tab: [0xff09, 'Tab'],
    ArrowLeft: [0xff51, 'ArrowLeft'],
    ArrowUp: [0xff52, 'ArrowUp'],
    ArrowRight: [0xff53, 'ArrowRight'],
    ArrowDown: [0xff54, 'ArrowDown'],
    Shift: [0xffe1, 'ShiftLeft'],
    Control: [0xffe3, 'ControlLeft'],
    Alt: [0xffe9, 'AltLeft'],
    Meta: [0xffeb, 'MetaLeft'],
    CapsLock: [0xffe5, 'CapsLock'],
    L: [0x6c, 'KeyL'],
    R: [0x72, 'KeyR'],
    T: [0x74, 'KeyT'],
    W: [0x77, 'KeyW'],
  }

  const handleMobileKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    const key = keysyms[event.key]

    if (!key) return

    event.preventDefault()
    if (event.key === 'CapsLock') {
      sendKey(key[0], key[1])
    } else {
      rfbRef.current?.sendKey(key[0], key[1], true)
    }
  }

  const handleMobileKeyUp = (event: React.KeyboardEvent<HTMLInputElement>) => {
    const key = keysyms[event.key]

    if (!key || event.key === 'CapsLock') return

    event.preventDefault()
    rfbRef.current?.sendKey(key[0], key[1], false)
  }

  const handleMobileInput = (event: React.FormEvent<HTMLInputElement>) => {
    const input = event.currentTarget
    const oldValue = previousInputRef.current
    const newValue = input.value
    let commonPrefix = 0

    while (
      commonPrefix < oldValue.length &&
      commonPrefix < newValue.length &&
      oldValue[commonPrefix] === newValue[commonPrefix]
    ) {
      commonPrefix += 1
    }

    for (let index = commonPrefix; index < oldValue.length; index += 1) {
      sendKey(0xff08, 'Backspace')
    }

    for (const character of Array.from(newValue.slice(commonPrefix))) {
      sendKey(keysymLookupRef.current(character.codePointAt(0)!), 'Unidentified')
    }

    previousInputRef.current = newValue
  }

    return (
      <>
      <div
        style={{
          position: 'absolute',
          top: 12,
          right: 12,
          zIndex: 1000,
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '8px 12px',
          borderRadius: 12,
          background: 'rgba(20,20,20,.85)',
          backdropFilter: 'blur(10px)',
          color: '#fff',
          fontSize: 13,
        }}
      >
        <span>Remote Chrome Size</span>
        <input
          type="range"
          min="60"
          max="140"
          step="5"
          value={remoteSize}
          onChange={(e) => setRemoteSize(Number(e.target.value))}
          style={{ width: 120 }}
        />
        <span style={{ minWidth: 38, textAlign: 'right' }}>
          {remoteSize}%
        </span>
      </div>

      <div
      className="vnc-container"
      style={{
        position: 'relative',
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        backgroundColor: '#000',
      }}
    >
      <div
        className="vnc-status"
      >
        Status: {status}
      </div>
        {isTouchDevice && (
          <div
            style={{
              position: 'absolute',
              right: 14,
              top: '50%',
              transform: 'translateY(-50%)',
              zIndex: 1100,
              display: 'flex',
              flexDirection: 'column',
              gap: 2,
              padding: 4,
              borderRadius: 14,
              background: 'rgba(20,20,20,.82)',
              backdropFilter: 'blur(10px)',
              boxShadow: '0 4px 18px rgba(0,0,0,.35)',
              touchAction: 'none',
              userSelect: 'none',
            }}
          >
            <button
              type="button"
              aria-label="Scroll remote browser up"
              onPointerDown={(event) => {
                event.preventDefault()
                startScrolling('up')
              }}
              onPointerUp={stopScrolling}
              onPointerCancel={stopScrolling}
              onPointerLeave={stopScrolling}
              style={{
                width: 48,
                height: 48,
                border: 0,
                borderRadius: 10,
                background: 'rgba(255,255,255,.12)',
                color: '#fff',
                fontSize: 24,
                fontWeight: 600,
                touchAction: 'none',
              }}
            >
              ↑
            </button>

            <button
              type="button"
              aria-label="Scroll remote browser down"
              onPointerDown={(event) => {
                event.preventDefault()
                startScrolling('down')
              }}
              onPointerUp={stopScrolling}
              onPointerCancel={stopScrolling}
              onPointerLeave={stopScrolling}
              style={{
                width: 48,
                height: 48,
                border: 0,
                borderRadius: 10,
                background: 'rgba(255,255,255,.12)',
                color: '#fff',
                fontSize: 24,
                fontWeight: 600,
                touchAction: 'none',
              }}
            >
              ↓
            </button>
          </div>
        )}

      <div
        style={{
          width: '100%',
          height: '100%',
          overflow: 'auto',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'flex-start',
        }}
      >
        <div
          style={{
            transform: `scale(${remoteSize / 100})`,
            transformOrigin: 'top center',
            transition: 'transform 120ms ease-out',
          }}
        >
<div
        ref={targetRef}
        className="vnc-target"
        onTouchStart={focusMobileKeyboard}
        style={{
          flex: 1,
          minHeight: 0,
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'stretch',
          justifyContent: 'stretch',
          touchAction: 'none',
        }}
      />

      <input
        ref={mobileInputRef}
        type="text"
        inputMode="text"
        autoCapitalize="sentences"
        autoCorrect="on"
        autoComplete="off"
        spellCheck={false}
        onKeyDown={handleMobileKeyDown}
        onKeyUp={handleMobileKeyUp}
        onInput={handleMobileInput}
        aria-label="Remote browser keyboard"
        style={{
          position: 'absolute',
          left: '0',
          bottom: '0',
          width: '1px',
          height: '1px',
          opacity: 0,
          pointerEvents: 'none',
        }}
      />
    </div>
        </div>
      </div>
      </>
    )
  }
)

VNCViewer.displayName = 'VNCViewer'

export default VNCViewer
