
export class AudioManager {
  private audioContext: AudioContext;
  private audioQueue: AudioBuffer[] = [];
  private isPlaying: boolean = false;
  private gainNode: GainNode;

  constructor() {
    this.audioContext = new AudioContext({
      sampleRate: 24000,
    });
    this.gainNode = this.audioContext.createGain();
    this.gainNode.connect(this.audioContext.destination);
  }

  async addAudioChunk(base64Audio: string) {
    try {
      // Convert base64 to array buffer
      const binaryString = atob(base64Audio);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }

      // Convert to Int16Array (PCM format)
      const int16Array = new Int16Array(bytes.buffer);
      const audioBuffer = await this.createAudioBuffer(int16Array);
      
      this.audioQueue.push(audioBuffer);
      
      if (!this.isPlaying) {
        this.playNextChunk();
      }
    } catch (error) {
      console.error('Error processing audio chunk:', error);
    }
  }

  private async createAudioBuffer(int16Array: Int16Array): Promise<AudioBuffer> {
    // Convert Int16Array to Float32Array
    const float32Array = new Float32Array(int16Array.length);
    for (let i = 0; i < int16Array.length; i++) {
      float32Array[i] = int16Array[i] / 32768.0;
    }

    const audioBuffer = this.audioContext.createBuffer(1, float32Array.length, 24000);
    audioBuffer.getChannelData(0).set(float32Array);
    return audioBuffer;
  }

  private async playNextChunk() {
    if (this.audioQueue.length === 0) {
      this.isPlaying = false;
      return;
    }

    this.isPlaying = true;
    const audioBuffer = this.audioQueue.shift()!;
    const source = this.audioContext.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(this.gainNode);
    
    source.onended = () => {
      this.playNextChunk();
    };

    source.start(0);
  }

  stop() {
    this.audioQueue = [];
    this.isPlaying = false;
    this.audioContext.close();
  }
}
