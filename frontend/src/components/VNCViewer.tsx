import React, { useEffect, useRef, useState } from 'react'

interface VNCViewerProps {
  token?: string
}

const VNCViewer: React.FC<VNCViewerProps> = ({ token }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null)
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
        setStatus('Failed to load noVNC library')
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
    if (!canvasRef.current || !RFB) {
      setStatus('Canvas or RFB not ready')
      return
    }

    const vncUrl =
      'wss://urban-garbanzo-qvp6wvxqrxgrfx7jv-6081.app.github.dev/websockify'

    setStatus('Connecting to remote Chromium...')

    try {
      const rfb = new RFB(
        canvasRef.current,
        vncUrl,
        {
          credentials: {
            password: '',
          },
        }
      )

      rfb.scaleViewport = true
      rfb.resizeSession = false
      rfb.clipViewport = false
      rfb.viewOnly = false

      rfb.addEventListener('connect', () => {
        console.log('VNC connected')
        setStatus('Connected')
        setConnected(true)
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
        style={{
          padding: '10px',
          backgroundColor: '#f0f0f0',
          borderBottom: '1px solid #ccc',
          fontSize: '12px',
          color: connected ? 'green' : 'red',
        }}
      >
        Status: {status}
      </div>

      <canvas
        ref={canvasRef}
        className="vnc-canvas"
        onTouchStart={focusMobileKeyboard}
        style={{
          flex: 1,
          width: '100%',
          height: '100%',
          display: 'block',
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
  )
}

export default VNCViewer
