import { useEffect, useRef, useState } from 'react'

export default function PoxeyAudio() {
  const [enabled, setEnabled] = useState(false)
  const [status, setStatus] = useState('Audio off')

  const contextRef = useRef<AudioContext | null>(null)
  const nodeRef = useRef<AudioWorkletNode | null>(null)
  const socketRef = useRef<WebSocket | null>(null)

  useEffect(() => {
    return () => {
      socketRef.current?.close()
      nodeRef.current?.disconnect()
      contextRef.current?.close()
    }
  }, [])

  const enableAudio = async () => {
    try {
      setStatus('Connecting...')

      const context = new AudioContext({ sampleRate: 44100 })
      contextRef.current = context

      await context.audioWorklet.addModule('/poxey-audio-worklet.js')

      const node = new AudioWorkletNode(context, 'poxey-audio-processor', {
        numberOfInputs: 0,
        numberOfOutputs: 1,
        outputChannelCount: [2],
      })

      node.connect(context.destination)
      nodeRef.current = node

      await context.resume()

      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
      const audioUrl = `${protocol}//${window.location.host}/audio`

      const socket = new WebSocket(audioUrl)
      socket.binaryType = 'arraybuffer'
      socketRef.current = socket

      socket.onopen = () => {
        setEnabled(true)
        setStatus('Audio on')
        console.log('[Poxey Audio] Connected')
      }

      socket.onmessage = (event) => {
        if (event.data instanceof ArrayBuffer && nodeRef.current) {
          nodeRef.current.port.postMessage(event.data, [event.data])
        }
      }

      socket.onerror = () => {
        setStatus('Audio error')
        console.error('[Poxey Audio] WebSocket error')
      }

      socket.onclose = () => {
        setEnabled(false)
        setStatus('Audio disconnected')
      }
    } catch (error) {
      console.error('[Poxey Audio] Failed to start:', error)
      setStatus('Audio unavailable')
      setEnabled(false)
    }
  }

  const disableAudio = () => {
    socketRef.current?.close()
    socketRef.current = null

    nodeRef.current?.disconnect()
    nodeRef.current = null

    contextRef.current?.close()
    contextRef.current = null

    setEnabled(false)
    setStatus('Audio off')
  }

  return (
    <button
      onClick={enabled ? disableAudio : enableAudio}
      style={{
        position: 'fixed',
        top: 16,
        right: 16,
        zIndex: 9999,
        padding: '10px 16px',
        borderRadius: 10,
        border: '1px solid rgba(255,255,255,0.15)',
        background: 'rgba(20, 12, 35, 0.92)',
        color: '#fff',
        fontSize: 14,
        fontWeight: 600,
        cursor: 'pointer',
        backdropFilter: 'blur(12px)',
      }}
      title={status}
    >
      {enabled ? '🔊 Audio On' : '🔇 Enable Audio'}
    </button>
  )
}
