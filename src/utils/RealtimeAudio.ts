import { supabase } from "@/integrations/supabase/client";

export class AudioRecorder {
  private stream: MediaStream | null = null;
  private audioContext: AudioContext | null = null;
  private processor: ScriptProcessorNode | null = null;
  private source: MediaStreamAudioSourceNode | null = null;
  private ws: WebSocket | null = null;

  constructor() {}

  async start(webSocket: WebSocket) {
    this.ws = webSocket;
    
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          sampleRate: 16000,
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      });
      
      this.audioContext = new AudioContext({
        sampleRate: 16000,
      });
      
      this.source = this.audioContext.createMediaStreamSource(this.stream);
      this.processor = this.audioContext.createScriptProcessor(4096, 1, 1);
      
      this.processor.onaudioprocess = (e) => {
        const inputData = e.inputBuffer.getChannelData(0);
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
          this.ws.send(JSON.stringify({
            type: 'input_audio_buffer.append',
            audio: this.encodeAudioData(inputData)
          }));
        }
      };
      
      this.source.connect(this.processor);
      this.processor.connect(this.audioContext.destination);
    } catch (error) {
      console.error('Error accessing microphone:', error);
      throw error;
    }
  }

  stop() {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({
        type: 'audio_end'
      }));
    }

    if (this.source) {
      this.source.disconnect();
      this.source = null;
    }
    if (this.processor) {
      this.processor.disconnect();
      this.processor = null;
    }
    if (this.stream) {
      this.stream.getTracks().forEach(track => track.stop());
      this.stream = null;
    }
    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }
    this.ws = null;
  }

  private encodeAudioData(float32Array: Float32Array): string {
    const int16Array = new Int16Array(float32Array.length);
    for (let i = 0; i < float32Array.length; i++) {
      const s = Math.max(-1, Math.min(1, float32Array[i]));
      int16Array[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
    }
    
    const uint8Array = new Uint8Array(int16Array.buffer);
    let binary = '';
    const chunkSize = 0x8000;
    
    for (let i = 0; i < uint8Array.length; i += chunkSize) {
      const chunk = uint8Array.subarray(i, Math.min(i + chunkSize, uint8Array.length));
      binary += String.fromCharCode.apply(null, Array.from(chunk));
    }
    
    return btoa(binary);
  }
}

export class RealtimeChat {
  private ws: WebSocket | null = null;
  private recorder: AudioRecorder | null = null;
  private audioContext: AudioContext | null = null;
  private audioQueue: AudioChunk[] = [];
  private isPlaying = false;
  private isMicrophoneActive = false;
  private isConnected = false;
  
  constructor(
    private onConnectionChange: (connected: boolean) => void,
    private onTranscriptUpdate: (text: string) => void,
    private onSpeakingChange: (speaking: boolean) => void,
    private onProcessing: (processing: boolean) => void
  ) {
    this.recorder = new AudioRecorder();
  }

  async connect() {
    try {
      this.audioContext = new AudioContext({
        sampleRate: 16000,
      });
      
      this.audioQueue = [];
      this.isPlaying = false;
      
      const SUPABASE_PROJECT_REF = "ceofrvinluwymyuizztv";
      this.ws = new WebSocket(`wss://${SUPABASE_PROJECT_REF}.functions.supabase.co/realtime-chat`);
      
      this.ws.onopen = async () => {
        console.log("WebSocket connection opened");
        this.isConnected = true;
        this.onConnectionChange(true);
        
        if (this.recorder) {
          await this.recorder.start(this.ws!);
          this.isMicrophoneActive = true;
        }
      };
      
      this.ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          console.log("Received WebSocket message:", data.type);
          
          switch (data.type) {
            case "response.audio.delta":
              this.onSpeakingChange(true);
              const audioData = this.decodeBase64ToPCM(data.delta);
              this.addToQueue(audioData);
              break;
              
            case "response.audio_transcript.delta":
              this.onTranscriptUpdate(data.delta);
              break;
              
            case "response.audio.done":
              setTimeout(() => this.onSpeakingChange(false), 300);
              break;
              
            case "response.created":
              console.log("Assistant started responding");
              this.onProcessing(false);
              break;
              
            case "response.done":
              console.log("Assistant finished responding");
              this.onSpeakingChange(false);
              break;
              
            case "heartbeat":
              console.log("Received heartbeat from server");
              // Keep connection alive, no action needed
              break;
              
            case "speech_stopped":
              console.log("Speech input stopped");
              this.onProcessing(true);
              break;

            default:
              console.log("Other message type:", data.type);
          }
        } catch (error) {
          console.error("Error processing WebSocket message:", error);
        }
      };
      
      this.ws.onerror = (error) => {
        console.error("WebSocket error:", error);
        this.onConnectionChange(false);
        this.isConnected = false;
      };
      
      this.ws.onclose = () => {
        console.log("WebSocket connection closed");
        if (this.recorder) {
          this.recorder.stop();
        }
        this.onConnectionChange(false);
        this.isConnected = false;
        this.isMicrophoneActive = false;
      };
      
    } catch (error) {
      console.error("Error connecting to WebSocket:", error);
      this.onConnectionChange(false);
      throw error;
    }
  }

  disconnect() {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    if (this.recorder) {
      this.recorder.stop();
      this.isMicrophoneActive = false;
    }
    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }
    this.isConnected = false;
    this.onConnectionChange(false);
    this.audioQueue = [];
    this.isPlaying = false;
  }

  isActive(): boolean {
    return this.isConnected && this.isMicrophoneActive;
  }

  private decodeBase64ToPCM(base64Data: string): Float32Array {
    const binaryString = atob(base64Data);
    const bytes = new Uint8Array(binaryString.length);
    
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    
    const int16Data = new Int16Array(bytes.buffer);
    
    const float32Data = new Float32Array(int16Data.length);
    for (let i = 0; i < int16Data.length; i++) {
      float32Data[i] = int16Data[i] / 32768.0;
    }
    
    return float32Data;
  }

  private async addToQueue(audioData: Float32Array) {
    this.audioQueue.push({ data: audioData });
    
    if (!this.isPlaying && this.audioContext) {
      await this.playNext();
    }
  }

  private async playNext() {
    if (this.audioQueue.length === 0 || !this.audioContext) {
      this.isPlaying = false;
      return;
    }

    this.isPlaying = true;
    const chunk = this.audioQueue.shift();
    
    if (!chunk) {
      this.playNext();
      return;
    }

    try {
      const audioBuffer = this.audioContext.createBuffer(1, chunk.data.length, this.audioContext.sampleRate);
      audioBuffer.getChannelData(0).set(chunk.data);
      
      const source = this.audioContext.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(this.audioContext.destination);
      
      source.onended = () => {
        this.playNext();
      };
      
      source.start();
    } catch (error) {
      console.error("Error playing audio:", error);
      this.playNext();
    }
  }
}

interface AudioChunk {
  data: Float32Array;
}
