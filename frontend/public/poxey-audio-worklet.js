class PoxeyAudioProcessor extends AudioWorkletProcessor {
  constructor() {
    super()
    this.queue = []
    this.current = null
    this.offset = 0
    this.inputSampleRate = 44100
    this.inputChannels = 2
    this.resamplePosition = 0

    this.port.onmessage = (event) => {
      if (event.data instanceof ArrayBuffer) {
        this.queue.push(new Int16Array(event.data))
      }
    }
  }

  getInputFrame(frameIndex) {
    if (!this.current || this.offset >= this.current.length) {
      this.current = this.queue.shift() || null
      this.offset = 0
    }

    if (!this.current) {
      return null
    }

    const index = frameIndex * this.inputChannels

    if (index + 1 >= this.current.length) {
      return null
    }

    return [
      this.current[index] / 32768,
      this.current[index + 1] / 32768
    ]
  }

  process(_inputs, outputs) {
    const output = outputs[0]
    const left = output[0]
    const right = output[1] || output[0]

    const ratio = this.inputSampleRate / sampleRate

    for (let i = 0; i < left.length; i++) {
      const sourcePosition = this.resamplePosition
      const sourceFrame = Math.floor(sourcePosition)
      const fraction = sourcePosition - sourceFrame

      const a = this.getInputFrame(sourceFrame)
      const b = this.getInputFrame(sourceFrame + 1)

      if (!a || !b) {
        left[i] = 0
        right[i] = 0
        continue
      }

      left[i] = a[0] + (b[0] - a[0]) * fraction
      right[i] = a[1] + (b[1] - a[1]) * fraction

      this.resamplePosition += ratio

      const consumedFrames = Math.floor(this.resamplePosition)

      if (consumedFrames > 0 && this.current) {
        const consumedSamples = consumedFrames * this.inputChannels

        if (this.offset + consumedSamples <= this.current.length) {
          this.offset += consumedSamples
          this.resamplePosition -= consumedFrames
        }
      }
    }

    return true
  }
}

registerProcessor('poxey-audio-processor', PoxeyAudioProcessor)
