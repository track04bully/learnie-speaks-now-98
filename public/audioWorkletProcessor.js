
const BUFFER_SIZE = 4096;
const SILENCE_THRESHOLD = 0.01;
const SAMPLE_RATE = 16000;
const SILENCE_DURATION = 2000; // ms

class PCMAudioProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.lastAudioTime = currentTime;
    this.silenceStartTime = null;
    this.processingCount = 0;
    
    console.log(`AudioWorklet initialized with sampleRate: ${sampleRate}`);
    
    // Verify that we're using the correct sample rate
    if (sampleRate !== SAMPLE_RATE) {
      console.warn(`AudioWorklet running at ${sampleRate}Hz instead of expected ${SAMPLE_RATE}Hz. This may cause audio issues.`);
    }
    
    // Send a startup message
    this.port.postMessage({
      type: 'status',
      message: `AudioWorklet started with sampleRate=${sampleRate}`
    });
  }

  detectSilence(input) {
    const sumSquares = input.reduce((sum, sample) => sum + sample * sample, 0);
    const rms = Math.sqrt(sumSquares / input.length);
    return rms < SILENCE_THRESHOLD;
  }

  process(inputs, outputs, parameters) {
    const input = inputs[0][0];
    if (!input) {
      if (this.processingCount % 100 === 0) {
        console.log('No input data received in AudioWorklet');
      }
      return true;
    }

    this.processingCount++;
    if (this.processingCount % 100 === 0) {
      console.log(`Processed ${this.processingCount} audio chunks`);
    }

    const isSilent = this.detectSilence(input);
    
    if (isSilent) {
      if (!this.silenceStartTime) {
        this.silenceStartTime = currentTime;
        console.log('Silence started at', this.silenceStartTime);
      } else if (currentTime - this.silenceStartTime > SILENCE_DURATION/1000) { // Convert ms to seconds
        // Silence duration threshold reached
        this.port.postMessage({ type: 'silence_detected' });
        console.log('Silence detected in AudioWorklet, notifying main thread');
        // Reset silence timer after notification
        this.silenceStartTime = null;
      }
    } else {
      // If not silent, reset the silence timer
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
