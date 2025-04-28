
export class AudioManager {
  private audioContext: AudioContext;
  private audioQueue: AudioBuffer[] = [];
  private isPlaying: boolean = false;
  private gainNode: GainNode;
  private processingChunk: boolean = false;

  constructor() {
    this.audioContext = new AudioContext({
      sampleRate: 24000,
    });
    this.gainNode = this.audioContext.createGain();
    this.gainNode.connect(this.audioContext.destination);
  }

  async addAudioChunk(base64Audio: string) {
    if (this.processingChunk) {
      console.log('Already processing a chunk, queueing...');
      this.audioQueue.push(await this.decodeBase64ToPCM(base64Audio));
      return;
    }

    try {
      this.processingChunk = true;
      const audioBuffer = await this.decodeBase64ToPCM(base64Audio);
      
      if (!this.isPlaying) {
        await this.playBuffer(audioBuffer);
        this.processQueuedChunks();
      } else {
        this.audioQueue.push(audioBuffer);
      }
    } catch (error) {
      console.error('Error processing audio chunk:', error);
    } finally {
      this.processingChunk = false;
    }
  }

  private async decodeBase64ToPCM(base64Audio: string): Promise<AudioBuffer> {
    // Step 1: Decode base64 to binary
    const binaryString = atob(base64Audio);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }

    // Step 2: Create Int16Array from the binary data
    const int16Array = new Int16Array(bytes.buffer);
    
    // Step 3: Convert to normalized Float32Array for Web Audio API
    const float32Array = new Float32Array(int16Array.length);
    for (let i = 0; i < int16Array.length; i++) {
      // Normalize Int16 (-32768 to 32767) to Float32 (-1.0 to 1.0)
      float32Array[i] = int16Array[i] / 32768.0;
    }

    // Step 4: Create and return AudioBuffer
    const audioBuffer = this.audioContext.createBuffer(1, float32Array.length, 24000);
    audioBuffer.getChannelData(0).set(float32Array);
    return audioBuffer;
  }

  private async playBuffer(audioBuffer: AudioBuffer) {
    this.isPlaying = true;
    const source = this.audioContext.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(this.gainNode);
    
    return new Promise<void>((resolve) => {
      source.onended = async () => {
        this.isPlaying = false;
        resolve();
      };
      source.start(0);
    });
  }

  private async processQueuedChunks() {
    while (this.audioQueue.length > 0) {
      const nextBuffer = this.audioQueue.shift();
      if (nextBuffer) {
        await this.playBuffer(nextBuffer);
      }
    }
  }

  stop() {
    this.audioQueue = [];
    this.isPlaying = false;
    this.processingChunk = false;
    this.audioContext.close();
  }
}
