
import { AudioRecorder } from './AudioRecorder';
import { AudioManager } from './AudioManager';

interface LearnieCallback {
  onSpeakingChange: (isSpeaking: boolean) => void;
}

export class WebSocketManager {
  private static instance: WebSocketManager;
  private ws: WebSocket | null = null;
  private projectId = "ceofrvinluwymyuizztv";
  private audioRecorder: AudioRecorder | null = null;
  private audioManager: AudioManager;
  private silenceTimeout: NodeJS.Timeout | null = null;
  private autoStopTimeout: NodeJS.Timeout | null = null;
  private lastLearnieCallback: LearnieCallback | null = null;
  private isProcessingResponse: boolean = false;
  private reconnectAttempts: number = 0;
  private maxReconnectAttempts: number = 3;
  private inactivityTimeout: NodeJS.Timeout | null = null;
  private sessionTimeoutDuration: number = 5 * 60 * 1000; // 5 minutes of inactivity

  private constructor() {
    this.audioManager = new AudioManager((isSpeaking) => {
      if (this.lastLearnieCallback) {
        this.lastLearnieCallback.onSpeakingChange(isSpeaking);
      }
      
      // Reset inactivity timeout when speaking starts/stops
      this.resetInactivityTimeout();
    });
    this.audioRecorder = new AudioRecorder(
      (audioData) => this.handleAudioData(audioData),
      () => this.handleSilence()
    );
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
        this.resetInactivityTimeout();
        resolve();
        return;
      }

      const wsUrl = `wss://${this.projectId}.functions.supabase.co/functions/v1/realtime-chat`;
      this.ws = new WebSocket(wsUrl);

      this.ws.onopen = () => {
        console.log("WebSocket connected");
        this.reconnectAttempts = 0;
        this.sendSessionConfig();
        this.resetInactivityTimeout();
        resolve();
      };

      this.ws.onerror = (error) => {
        console.error("WebSocket error:", error);
        reject(error);
      };

      this.ws.onclose = this.handleWebSocketClose.bind(this);
      this.ws.onmessage = this.handleMessage;
    });
  }

  private handleWebSocketClose() {
    console.log("WebSocket closed");
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      console.log(`Attempting to reconnect (${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
      setTimeout(() => this.connect(), 1000 * this.reconnectAttempts);
    } else {
      this.stopRecording("Connection lost. Tap to reconnect.");
    }
  }

  private handleMessage = (event: MessageEvent) => {
    try {
      const data = JSON.parse(event.data);
      console.log("Received message:", data);

      // Reset inactivity timeout on any message from server
      this.resetInactivityTimeout();

      switch (data.type) {
        case 'response.audio.delta':
          if (data.delta) {
            if (!this.isProcessingResponse) {
              this.isProcessingResponse = true;
              if (this.lastLearnieCallback) {
                this.lastLearnieCallback.onSpeakingChange(true);
              }
            }
            this.audioManager.addAudioChunk(data.delta);
          }
          break;
        case 'response.done':
          console.log("Response completed");
          this.isProcessingResponse = false;
          // Give a small delay before setting speaking to false to ensure all audio is played
          setTimeout(() => {
            if (this.lastLearnieCallback && !this.isProcessingResponse) {
              this.lastLearnieCallback.onSpeakingChange(false);
            }
          }, 500);
          break;
        case 'session.created':
          console.log("Session created successfully");
          break;
      }
    } catch (error) {
      console.error("Error handling message:", error);
    }
  };

  private handleSilence() {
    if (this.silenceTimeout) {
      clearTimeout(this.silenceTimeout);
    }

    this.silenceTimeout = setTimeout(() => {
      console.log('Extended silence detected, stopping recording');
      this.stopRecording("I didn't catch that. Tap to try again.");
    }, 5000); // 5 seconds of silence
  }

  private handleAudioData(audioData: ArrayBuffer) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    
    // Reset silence timeout since we received audio
    if (this.silenceTimeout) {
      clearTimeout(this.silenceTimeout);
    }
    
    // Reset inactivity timeout since user is active
    this.resetInactivityTimeout();
    
    // Send raw PCM data directly through WebSocket
    this.ws.send(audioData);
    console.log('Sent audio chunk:', audioData.byteLength, 'bytes');
  }

  private resetInactivityTimeout() {
    // Clear existing timeout if any
    if (this.inactivityTimeout) {
      clearTimeout(this.inactivityTimeout);
      this.inactivityTimeout = null;
    }

    // Set a new timeout
    this.inactivityTimeout = setTimeout(() => {
      console.log(`Session inactive for ${this.sessionTimeoutDuration/60000} minutes, closing connection`);
      this.disconnect();
    }, this.sessionTimeoutDuration);
  }

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

  async startRecording(onSpeakingChange?: (isSpeaking: boolean) => void) {
    if (!this.audioRecorder) return;
    
    this.lastLearnieCallback = {
      onSpeakingChange: onSpeakingChange || (() => {}),
    };
    
    this.isProcessingResponse = false;
    
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      await this.connect();
    }

    // Reset the inactivity timeout since the user is starting to interact
    this.resetInactivityTimeout();

    // Set a timeout to automatically stop recording after 30 seconds
    this.autoStopTimeout = setTimeout(() => {
      this.stopRecording("Recording timed out. Tap to try again.");
    }, 30000);
    
    await this.audioRecorder.start();
    console.log('Recording started');
  }

  stopRecording(message?: string) {
    // Clear all timeouts
    if (this.silenceTimeout) {
      clearTimeout(this.silenceTimeout);
      this.silenceTimeout = null;
    }
    if (this.autoStopTimeout) {
      clearTimeout(this.autoStopTimeout);
      this.autoStopTimeout = null;
    }

    if (this.audioRecorder) {
      this.audioRecorder.stop();
      console.log('Recording stopped', message ? `with message: ${message}` : '');
    }

    // Reset inactivity timeout since this is an interaction point
    this.resetInactivityTimeout();
  }

  disconnect() {
    console.log('Closing WebSocket connection and cleaning up resources');
    
    // Clear all timeouts
    if (this.inactivityTimeout) {
      clearTimeout(this.inactivityTimeout);
      this.inactivityTimeout = null;
    }
    if (this.silenceTimeout) {
      clearTimeout(this.silenceTimeout);
      this.silenceTimeout = null;
    }
    if (this.autoStopTimeout) {
      clearTimeout(this.autoStopTimeout);
      this.autoStopTimeout = null;
    }

    this.isProcessingResponse = false;
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.audioManager.stop();
    this.stopRecording();
  }

  isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }

  manualStop() {
    console.log('Manual stop triggered');
    if (this.ws?.readyState === WebSocket.OPEN) {
      // Tell the server to process whatever audio we have
      this.ws.send(JSON.stringify({
        type: 'input_audio_buffer.commit'
      }));
    }
    this.stopRecording();
    
    // Reset inactivity timeout since this is an interaction point
    this.resetInactivityTimeout();
  }

  interruptSpeaking() {
    console.log('Interrupt speaking triggered');
    
    // Stop current audio playback
    this.audioManager.stop();

    // Tell the server to cancel the current response
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({
        type: 'response.cancel'
      }));
      console.log('Sent response.cancel event');
    }
    
    this.isProcessingResponse = false;
    
    // Notify that speaking has stopped
    if (this.lastLearnieCallback) {
      this.lastLearnieCallback.onSpeakingChange(false);
    }
    
    // Reset inactivity timeout since this is an interaction point
    this.resetInactivityTimeout();
  }
}
