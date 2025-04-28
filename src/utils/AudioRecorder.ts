
export class AudioRecorder {
  private stream: MediaStream | null = null;
  private audioContext: AudioContext | null = null;
  private workletNode: AudioWorkletNode | null = null;
  private source: MediaStreamAudioSourceNode | null = null;

  constructor(private onAudioData: (audioData: Float32Array) => void) {}

  async start() {
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          sampleRate: 24000,
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      });
      
      this.audioContext = new AudioContext({
        sampleRate: 24000,
      });
      
      // Load and initialize the audio worklet
      await this.audioContext.audioWorklet.addModule('/audioWorkletProcessor.js');
      
      this.workletNode = new AudioWorkletNode(this.audioContext, 'pcm-processor');
      this.source = this.audioContext.createMediaStreamSource(this.stream);
      
      // Handle PCM data from the worklet
      this.workletNode.port.onmessage = (event) => {
        const pcmData = event.data;
        this.onAudioData(new Float32Array(pcmData));
      };
      
      this.source.connect(this.workletNode);
      this.workletNode.connect(this.audioContext.destination);
      
      console.log('Audio recording started');
    } catch (error) {
      console.error('Error accessing microphone:', error);
      throw error;
    }
  }

  stop() {
    if (this.source) {
      this.source.disconnect();
      this.source = null;
    }
    if (this.workletNode) {
      this.workletNode.disconnect();
      this.workletNode = null;
    }
    if (this.stream) {
      this.stream.getTracks().forEach(track => track.stop());
      this.stream = null;
    }
    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }
    console.log('Audio recording stopped');
  }
}
