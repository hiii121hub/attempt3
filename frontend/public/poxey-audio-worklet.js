class PoxeyAudioProcessor extends AudioWorkletProcessor {
  constructor() {
    super()
    this.queue = []
    this.current = null
    this.offset = 0
    this.started = false
    this.bufferedSamples = 0

    this.port.onmessage = (event) => {
      if (!(event.data instanceof ArrayBuffer)) return

      const samples = new Int16Array(event.data)
      if (!samples.length) return

      this.queue.push(samples)
      this.bufferedSamples += samples.length
    }
  }

  readSample() {
    if (!this.current || this.offset >= this.current.length) {
      this.current = this.queue.shift() || null
      this.offset = 0
    }

    if (!this.current) return 0

    const value = this.current[this.offset++] / 32768

    if (this.offset >= this.current.length) {
      this.current = null
      this.offset = 0
    }

    return value
  }

  process(_inputs, outputs) {
    const output = outputs[0]
    const left = output[0]
    const right = output[1] || output[0]

    if (!this.started) {
      if (this.bufferedSamples < 44100 * 2 * 0.25) {
        left.fill(0)
        if (output[1]) right.fill(0)
        return true
      }

      this.started = true
    }

    for (let i = 0; i < left.length; i++) {
      if (!this.current && this.queue.length === 0) {
        left[i] = 0
        right[i] = 0
        continue
      }

      const l = this.readSample()
      const r = this.readSample()

      left[i] = l
      right[i] = r
    }

    return true
  }
}

registerProcessor('poxey-audio-processor', PoxeyAudioProcessor)
