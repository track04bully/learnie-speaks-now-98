
const BUFFER_SIZE = 4096;
const SILENCE_THRESHOLD = 0.01;
const SAMPLE_RATE = 24000;

class PCMAudioProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.lastAudioTime = currentTime;
    this.silenceStartTime = null;
  }

  detectSilence(input) {
    const sumSquares = input.reduce((sum, sample) => sum + sample * sample, 0);
    const rms = Math.sqrt(sumSquares / input.length);
    return rms < SILENCE_THRESHOLD;
  }

  process(inputs, outputs, parameters) {
    const input = inputs[0][0];
    if (!input) return true;

    const isSilent = this.detectSilence(input);
    
    if (isSilent) {
      if (!this.silenceStartTime) {
        this.silenceStartTime = currentTime;
      } else if (currentTime - this.silenceStartTime > 2) {
        // 2 seconds of silence detected
        this.port.postMessage({ type: 'silence_detected' });
        return true;
      }
    } else {
      this.silenceStartTime = null;
      this.lastAudioTime = currentTime;
    }

    // Convert to 16-bit PCM
    const pcm16Buffer = new Int16Array(input.length);
    for (let i = 0; i < input.length; i++) {
      let s = input[i];
      s = Math.max(-1, Math.min(1, s));
      pcm16Buffer[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
    }

    this.port.postMessage({
      type: 'audio_data',
      data: pcm16Buffer.buffer
    }, [pcm16Buffer.buffer]);
    
    return true;
  }
}

registerProcessor('pcm-processor', PCMAudioProcessor);
