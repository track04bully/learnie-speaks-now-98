import { AudioRecorder } from './AudioRecorder';

export class WebSocketManager {
  private static instance: WebSocketManager;
  private ws: WebSocket | null = null;
  private projectId = "ceofrvinluwymyuizztv";
  private audioRecorder: AudioRecorder | null = null;

  private constructor() {
    this.audioRecorder = new AudioRecorder((audioData) => {
      this.handleAudioData(audioData);
    });
  }

  static getInstance() {
    if (!WebSocketManager.instance) {
      WebSocketManager.instance = new WebSocketManager();
    }
    return WebSocketManager.instance;
  }

  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.ws?.readyState === WebSocket.OPEN) {
        resolve();
        return;
      }

      const wsUrl = `wss://${this.projectId}.functions.supabase.co/functions/v1/realtime-chat`;
      this.ws = new WebSocket(wsUrl);

      this.ws.onopen = () => {
        console.log("WebSocket connected");
        this.sendSessionConfig();
        resolve();
      };

      this.ws.onerror = (error) => {
        console.error("WebSocket error:", error);
        reject(error);
      };

      this.ws.onmessage = this.handleMessage;
    });
  }

  private handleMessage = (event: MessageEvent) => {
    try {
      const data = JSON.parse(event.data);
      console.log("Received message:", data);

      switch (data.type) {
        case 'response.audio.delta':
          // Handle incoming audio
          break;
        case 'response.audio_transcript.delta':
          // Handle transcription updates
          break;
        case 'session.created':
          console.log("Session created successfully");
          break;
        default:
          console.log("Unhandled message type:", data.type);
      }
    } catch (error) {
      console.error("Error handling message:", error);
    }
  };

  private sendSessionConfig() {
    if (this.ws?.readyState !== WebSocket.OPEN) return;

    const sessionConfig = {
      type: "session.update",
      event_id: `evt_${Date.now()}`,
      session: {
        modalities: ["text", "audio"],
        instructions: "You are Learnie, a friendly and patient tutor for children. Always speak in simple, clear language that a child can understand. Be encouraging and supportive. If a concept is complex, break it down into smaller, easy-to-understand pieces. Use examples from everyday life that children can relate to. Never use complex vocabulary - if you need to introduce a new word, explain what it means in simple terms. Always maintain a positive, encouraging tone.",
        voice: "echo",
        input_audio_format: "pcm16",
        output_audio_format: "pcm16",
        input_audio_transcription: {
          model: "whisper-1"
        },
        turn_detection: {
          type: "server_vad",
          threshold: 0.5,
          prefix_padding_ms: 300,
          silence_duration_ms: 1000
        },
        temperature: 0.8,
        max_response_output_tokens: "inf"
      }
    };

    console.log("Sending session config:", sessionConfig);
    this.ws.send(JSON.stringify(sessionConfig));
  }

  private handleAudioData(audioData: ArrayBuffer) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    
    // Send raw PCM data directly through WebSocket
    this.ws.send(audioData);
    
    console.log('Sent audio chunk:', audioData.byteLength, 'bytes');
  }

  async startRecording() {
    if (!this.audioRecorder) return;
    
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      await this.connect();
    }
    
    await this.audioRecorder.start();
    console.log('Recording started');
  }

  stopRecording() {
    if (this.audioRecorder) {
      this.audioRecorder.stop();
      console.log('Recording stopped');
    }
  }

  disconnect() {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }
}
