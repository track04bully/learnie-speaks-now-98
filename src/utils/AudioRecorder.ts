
export class AudioRecorder {
  private stream: MediaStream | null = null;
  private audioContext: AudioContext | null = null;
  private workletNode: AudioWorkletNode | null = null;
  private source: MediaStreamAudioSourceNode | null = null;
  private onSilenceCallback: (() => void) | null = null;

  constructor(
    private onAudioData: (audioData: ArrayBuffer) => void,
    onSilence?: () => void
  ) {
    this.onSilenceCallback = onSilence || null;
  }

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
      
      await this.audioContext.audioWorklet.addModule('/audioWorkletProcessor.js');
      
      this.workletNode = new AudioWorkletNode(this.audioContext, 'pcm-processor');
      this.source = this.audioContext.createMediaStreamSource(this.stream);
      
      // Handle messages from the worklet
      this.workletNode.port.onmessage = (event) => {
        if (event.data.type === 'silence_detected' && this.onSilenceCallback) {
          this.onSilenceCallback();
        } else if (event.data.type === 'audio_data') {
          this.onAudioData(event.data.data);
        }
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
