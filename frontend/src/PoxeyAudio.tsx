import { useEffect, useRef, useState } from 'react'

interface PoxeyAudioProps {
  audioToken: string | null
  enabled: boolean
  onEnabledChange: (enabled: boolean) => void
}

export default function PoxeyAudio({
  audioToken,
  enabled,
  onEnabledChange,
}: PoxeyAudioProps) {
  const [status, setStatus] = useState('Audio off')

  const contextRef = useRef<AudioContext | null>(null)
  const nodeRef = useRef<AudioWorkletNode | null>(null)
  const socketRef = useRef<WebSocket | null>(null)

  useEffect(() => {
    if (!enabled) return

    let cancelled = false
    let context: AudioContext | null = null
    let node: AudioWorkletNode | null = null
    let socket: WebSocket | null = null

    const startAudio = async () => {
      try {
        setStatus('Connecting...')

        context = new AudioContext({ sampleRate: 44100 })

        if (cancelled) {
          await context.close()
          return
        }

        contextRef.current = context

        await context.audioWorklet.addModule('/poxey-audio-worklet.js')

        if (cancelled) {
          await context.close()
          return
        }

        node = new AudioWorkletNode(context, 'poxey-audio-processor', {
          numberOfInputs: 0,
          numberOfOutputs: 1,
          outputChannelCount: [2],
        })

        node.connect(context.destination)
        nodeRef.current = node

        await context.resume()

        if (cancelled) {
          node.disconnect()
          await context.close()
          return
        }

        if (!audioToken) {
          throw new Error('Audio session token unavailable')
        }

        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
        const audioUrl = `${protocol}//${window.location.host}/audio?token=${encodeURIComponent(audioToken)}`

        socket = new WebSocket(audioUrl)
        socket.binaryType = 'arraybuffer'
        socketRef.current = socket

        socket.onopen = () => {
          if (cancelled) {
            socket?.close()
            return
          }

          setStatus('Audio on')
          console.log('[Poxey Audio] Connected')
        }

        socket.onmessage = (event) => {
          if (
            !cancelled &&
            event.data instanceof ArrayBuffer &&
            node
          ) {
            node.port.postMessage(event.data, [event.data])
          }
        }

        socket.onerror = () => {
          if (cancelled) return

          setStatus('Audio error')
          console.error('[Poxey Audio] WebSocket error')
          onEnabledChange(false)
        }

        socket.onclose = () => {
          if (cancelled) return

          setStatus('Audio disconnected')
          onEnabledChange(false)
        }
      } catch (error) {
        if (cancelled) return

        console.error('[Poxey Audio] Failed to start:', error)
        setStatus('Audio unavailable')
        onEnabledChange(false)
      }
    }

    startAudio()

    return () => {
      cancelled = true

      if (socket) {
        socket.onopen = null
        socket.onmessage = null
        socket.onerror = null
        socket.onclose = null
        socket.close()
      }

      if (node) {
        node.disconnect()
      }

      if (context) {
        void context.close()
      }

      if (socketRef.current === socket) {
        socketRef.current = null
      }

      if (nodeRef.current === node) {
        nodeRef.current = null
      }

      if (contextRef.current === context) {
        contextRef.current = null
      }
    }
  }, [enabled, audioToken, onEnabledChange])

  useEffect(() => {
    if (!enabled) {
      setStatus('Audio off')
    }
  }, [enabled])

  return null
}
