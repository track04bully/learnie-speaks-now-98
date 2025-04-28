import { SAMPLE_RATE } from './audioConstants';

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
      console.log('🎤 Requesting microphone access...');
      this.stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          sampleRate: SAMPLE_RATE,
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      });
      console.log('✅ Microphone access granted');
      
      this.audioContext = new AudioContext({
        sampleRate: SAMPLE_RATE,
      });
      
      console.log(`🎵 AudioContext initialized at ${this.audioContext.sampleRate}Hz`);
      
      await this.audioContext.audioWorklet.addModule('/audioWorkletProcessor.js');
      console.log('✅ Audio worklet processor loaded');
      
      this.workletNode = new AudioWorkletNode(this.audioContext, 'pcm-processor');
      this.source = this.audioContext.createMediaStreamSource(this.stream);
      
      // Handle messages from the worklet
      this.workletNode.port.onmessage = (event) => {
        if (event.data.type === 'silence_detected' && this.onSilenceCallback) {
          console.log('🤫 Silence detected');
          this.onSilenceCallback();
        } else if (event.data.type === 'audio_data') {
          console.log('🎵 Audio chunk received:', event.data.data.byteLength, 'bytes');
          this.onAudioData(event.data.data);
        }
      };
      
      this.source.connect(this.workletNode);
      this.workletNode.connect(this.audioContext.destination);
      
      console.log('🎤 Audio recording started successfully');
    } catch (error) {
      console.error('❌ Error accessing microphone:', error);
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
    console.log('🛑 Audio recording stopped');
  }
}
