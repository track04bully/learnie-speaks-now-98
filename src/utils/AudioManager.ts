
export class AudioManager {
  private audioContext: AudioContext;
  private audioQueue: AudioBuffer[] = [];
  private isPlaying: boolean = false;
  private gainNode: GainNode;
  private processingChunk: boolean = false;
  private onSpeakingChange?: (isSpeaking: boolean) => void;

  constructor(onSpeakingChange?: (isSpeaking: boolean) => void) {
    this.audioContext = new AudioContext({
      sampleRate: 24000,
    });
    this.gainNode = this.audioContext.createGain();
    this.gainNode.connect(this.audioContext.destination);
    this.onSpeakingChange = onSpeakingChange;
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
        this.onSpeakingChange?.(true);
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
    const pcm16 = new Int16Array(bytes.buffer);
    
    // Step 3: Create an AudioBuffer with the correct specifications
    const frameCount = pcm16.length;
    const audioBuffer = this.audioContext.createBuffer(1, frameCount, 24000);
    
    // Step 4: Convert Int16 samples to Float32 [-1,1] range and copy to channel
    const float32Samples = new Float32Array(frameCount);
    for (let i = 0; i < frameCount; i++) {
      float32Samples[i] = pcm16[i] / 0x8000; // Normalize to [-1, 1]
    }
    audioBuffer.copyToChannel(float32Samples, 0, 0);
    
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
    this.onSpeakingChange?.(false);
  }

  stop() {
    this.audioQueue = [];
    this.isPlaying = false;
    this.processingChunk = false;
    this.onSpeakingChange?.(false);
    this.audioContext.close();
  }
}
