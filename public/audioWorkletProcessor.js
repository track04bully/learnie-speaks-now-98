
class PCMAudioProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
  }

  process(inputs, outputs, parameters) {
    const input = inputs[0][0];
    if (!input) return true;

    // Convert to 16-bit PCM directly
    const pcm16Buffer = new Int16Array(input.length);
    for (let i = 0; i < input.length; i++) {
      let s = input[i];
      s = Math.max(-1, Math.min(1, s));
      pcm16Buffer[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
    }

    // Send the raw PCM data to the main thread
    this.port.postMessage(pcm16Buffer.buffer, [pcm16Buffer.buffer]);
    
    return true;
  }
}

registerProcessor('pcm-processor', PCMAudioProcessor);
