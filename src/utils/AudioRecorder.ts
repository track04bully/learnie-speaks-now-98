
import { SAMPLE_RATE } from './audioConstants';

export class AudioRecorder {
  private stream: MediaStream | null = null;
  private audioContext: AudioContext | null = null;
  private workletNode: AudioWorkletNode | null = null;
  private source: MediaStreamAudioSourceNode | null = null;
  private onSilenceCallback: (() => void) | null = null;
  public onAudioData: (audioData: ArrayBuffer) => void;
  public onSilenceDetected: () => void;

  constructor(
    onAudioData: (audioData: ArrayBuffer) => void,
    onSilence?: () => void
  ) {
    this.onAudioData = onAudioData;
    this.onSilenceCallback = onSilence || null;
    this.onSilenceDetected = () => {
      if (this.onSilenceCallback) {
        this.onSilenceCallback();
      }
    };
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
      
      // Create AudioContext with the correct sample rate
      this.audioContext = new AudioContext({
        sampleRate: SAMPLE_RATE,
      });
      
      console.log(`🎵 AudioContext initialized at ${this.audioContext.sampleRate}Hz`);
      
      // Explicitly load the AudioWorklet module with proper error handling
      console.log('Loading AudioWorklet module...');
      try {
        // Use absolute URL to ensure the path is correct
        const workletUrl = new URL('/audioWorkletProcessor.js', window.location.origin).href;
        console.log(`Loading AudioWorklet from ${workletUrl}`);
        
        await this.audioContext.audioWorklet.addModule('/audioWorkletProcessor.js');
        console.log('✅ Audio worklet processor loaded successfully');
      } catch (workletError) {
        console.error('❌ Failed to load AudioWorklet module:', workletError);
        throw new Error(`AudioWorklet failed to load: ${workletError.message}`);
      }
      
      // Create the worklet node and source
      this.source = this.audioContext.createMediaStreamSource(this.stream);
      
      try {
        console.log('Creating AudioWorkletNode with processor "pcm-processor"');
        this.workletNode = new AudioWorkletNode(this.audioContext, 'pcm-processor');
        console.log('✅ AudioWorkletNode created successfully');
      } catch (nodeError) {
        console.error('❌ Failed to create AudioWorkletNode:', nodeError);
        throw new Error(`Failed to create AudioWorkletNode: ${nodeError.message}`);
      }
      
      // Handle messages from the worklet
      this.workletNode.port.onmessage = (event) => {
        if (event.data.type === 'silence_detected' && this.onSilenceDetected) {
          console.log('🤫 Silence detected');
          this.onSilenceDetected();
        } else if (event.data.type === 'audio_data') {
          console.log('🎵 Audio chunk received:', event.data.data.byteLength, 'bytes');
          this.onAudioData(event.data.data);
        } else if (event.data.type === 'status') {
          console.log('📊 AudioWorklet status:', event.data.message);
        } else {
          console.log('📊 Unknown message from AudioWorklet:', event.data);
        }
      };
      
      // Connect the nodes
      this.source.connect(this.workletNode);
      this.workletNode.connect(this.audioContext.destination);
      
      console.log('🎤 Audio recording started successfully');
    } catch (error) {
      console.error('❌ Error accessing microphone:', error);
      throw error;
    }
  }

  stop() {
    console.log('Stopping AudioRecorder...');
    
    if (this.source) {
      this.source.disconnect();
      this.source = null;
      console.log('Source disconnected');
    }
    if (this.workletNode) {
      this.workletNode.disconnect();
      this.workletNode = null;
      console.log('WorkletNode disconnected');
    }
    if (this.stream) {
      this.stream.getTracks().forEach(track => track.stop());
      this.stream = null;
      console.log('Media stream tracks stopped');
    }
    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
      console.log('AudioContext closed');
    }
    console.log('🛑 Audio recording stopped completely');
  }
}
