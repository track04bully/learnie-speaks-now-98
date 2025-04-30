
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
      console.warn(`AudioWorklet running at ${sampleRate}Hz instead of expected ${SAMPLE_RATE}Hz. Resampling will be required.`);
      this.needsResampling = true;
    } else {
      this.needsResampling = false;
    }
    
    // Send a startup message
    this.port.postMessage({
      type: 'status',
      message: `AudioWorklet started with sampleRate=${sampleRate}`
    });
  }

  detectSilence(input) {
    // Calculate RMS amplitude
    const sumSquares = input.reduce((sum, sample) => sum + sample * sample, 0);
    const rms = Math.sqrt(sumSquares / input.length);
    return rms < SILENCE_THRESHOLD;
  }
  
  // Simple resampling function if needed
  resample(input, fromSampleRate, toSampleRate) {
    const ratio = fromSampleRate / toSampleRate;
    const newLength = Math.round(input.length / ratio);
    const result = new Float32Array(newLength);
    
    for (let i = 0; i < newLength; i++) {
      // Simple linear interpolation
      const exactIndex = i * ratio;
      const lowerIndex = Math.floor(exactIndex);
      const fraction = exactIndex - lowerIndex;
      const upperIndex = Math.min(lowerIndex + 1, input.length - 1);
      
      result[i] = input[lowerIndex] * (1 - fraction) + input[upperIndex] * fraction;
    }
    
    return result;
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

    // Process the audio
    let processedInput = input;
    
    // Apply resampling if needed
    if (this.needsResampling) {
      processedInput = this.resample(input, sampleRate, SAMPLE_RATE);
    }
    
    const isSilent = this.detectSilence(processedInput);
    
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
    const pcm16Buffer = new Int16Array(processedInput.length);
    for (let i = 0; i < processedInput.length; i++) {
      let s = processedInput[i];
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
