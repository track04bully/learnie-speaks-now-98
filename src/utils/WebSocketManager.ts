
import { AudioRecorder } from './AudioRecorder';
import { AudioManager } from './AudioManager';

interface LearnieCallback {
  onSpeakingChange: (isSpeaking: boolean) => void;
  onError?: (message: string) => void;
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
  private sessionResponseTimeout: NodeJS.Timeout | null = null;
  private lastSentEvent: any = null;
  private audioBufferCreated: boolean = false;
  private connectionStartTime: number = 0;
  private sessionConfirmed: boolean = false;

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
      console.log("Connecting to WebSocket:", wsUrl);
      this.connectionStartTime = Date.now();
      this.sessionConfirmed = false;  // Reset session confirmation flag
      this.audioBufferCreated = false; // Reset audio buffer flag
      this.ws = new WebSocket(wsUrl);

      this.ws.onopen = () => {
        console.log("WebSocket connected in", Date.now() - this.connectionStartTime, "ms");
        this.reconnectAttempts = 0;
        
        // Setup response timeout for session creation
        this.sessionResponseTimeout = setTimeout(() => {
          console.error("No response received after session configuration");
          if (this.lastLearnieCallback?.onError) {
            this.lastLearnieCallback.onError("Connection timed out. Please try again.");
          }
          this.disconnect();
          reject(new Error("Session configuration timeout"));
        }, 10000);
        
        // We don't send session config here as the server will handle it
        this.resetInactivityTimeout();
        resolve();
      };

      this.ws.onerror = (error) => {
        const errorTime = Date.now() - this.connectionStartTime;
        console.error(`WebSocket error after ${errorTime}ms:`, error);
        console.error("Connection details:", {
          url: wsUrl,
          readyState: this.ws?.readyState,
          reconnectAttempts: this.reconnectAttempts
        });
        
        // Log the last sent event that might have caused the error
        if (this.lastSentEvent) {
          console.error("Last sent event that might have caused the error:", this.lastSentEvent);
        }
        
        if (this.lastLearnieCallback?.onError) {
          this.lastLearnieCallback.onError("Connection failed. Please check your network and try again.");
        }
        reject(error);
      };

      this.ws.onclose = this.handleWebSocketClose.bind(this);
      this.ws.onmessage = this.handleMessage;
    });
  }

  private handleWebSocketClose(event: CloseEvent) {
    console.log("WebSocket closed with code:", event.code, "reason:", event.reason);
    this.clearTimeouts();
    this.sessionConfirmed = false;
    this.audioBufferCreated = false;
    
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      console.log(`Attempting to reconnect (${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
      setTimeout(() => this.connect(), 1000 * this.reconnectAttempts);
    } else {
      this.stopRecording("Connection lost. Tap to reconnect.");
      if (this.lastLearnieCallback?.onError) {
        this.lastLearnieCallback.onError("Connection lost. Tap to reconnect.");
      }
    }
  }

  private handleMessage = (event: MessageEvent) => {
    try {
      // Clear session response timeout if it exists - we received something
      if (this.sessionResponseTimeout) {
        clearTimeout(this.sessionResponseTimeout);
        this.sessionResponseTimeout = null;
      }
      
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
        case 'session.updated':
          console.log("Session updated successfully");
          this.sessionConfirmed = true; // Mark session as confirmed
          break;
        case 'error':
          console.error("Error message from server:", data.message);
          if (this.lastLearnieCallback?.onError) {
            this.lastLearnieCallback.onError(data.message || "An error occurred");
          }
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
    
    // Only proceed if the session is confirmed
    if (!this.sessionConfirmed) {
      console.log("Session not confirmed yet, buffering audio");
      return;
    }
    
    // Reset silence timeout since we received audio
    if (this.silenceTimeout) {
      clearTimeout(this.silenceTimeout);
    }
    
    // Reset inactivity timeout since user is active
    this.resetInactivityTimeout();
    
    // First, create the audio buffer if it hasn't been created yet
    if (!this.audioBufferCreated) {
      const createMessage = {
        type: "input_audio_buffer.create",
        format: "pcm16",
        name: "mic"
      };
      
      const success = this.sendJsonEvent(createMessage);
      if (success) {
        console.log('Created audio buffer with proper format');
        this.audioBufferCreated = true;
      } else {
        console.error('Failed to create audio buffer');
        return;
      }
    }
    
    // Convert ArrayBuffer to base64 for JSON transmission
    const base64Audio = this.arrayBufferToBase64(audioData);
    
    // Send JSON formatted message according to OpenAI's WebSocket API spec
    const appendMessage = {
      type: "input_audio_buffer.append",
      name: "mic", // Must match the name in create message
      audio: base64Audio
    };
    
    this.sendJsonEvent(appendMessage);
    console.log('Sent audio chunk with proper JSON formatting:', audioData.byteLength, 'bytes');
  }
  
  private arrayBufferToBase64(buffer: ArrayBuffer): string {
    let binary = '';
    const bytes = new Uint8Array(buffer);
    const len = bytes.byteLength;
    
    for (let i = 0; i < len; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    
    return btoa(binary);
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

  private clearTimeouts() {
    if (this.sessionResponseTimeout) {
      clearTimeout(this.sessionResponseTimeout);
      this.sessionResponseTimeout = null;
    }
    
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
  }

  sendJsonEvent(event: any) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      console.error("Cannot send event: WebSocket not connected");
      return false;
    }
    
    try {
      // Validate JSON by stringifying then parsing
      const jsonStr = JSON.stringify(event);
      JSON.parse(jsonStr); // Just to make sure it's valid
      
      // Keep track of the last sent event for debugging
      this.lastSentEvent = event;
      
      this.ws.send(jsonStr);
      console.log("Sent JSON event:", event);
      return true;
    } catch (error) {
      console.error("Failed to send JSON event:", error);
      return false;
    }
  }

  async startRecording(onSpeakingChange?: (isSpeaking: boolean) => void, onError?: (message: string) => void) {
    if (!this.audioRecorder) return;
    
    this.lastLearnieCallback = {
      onSpeakingChange: onSpeakingChange || (() => {}),
      onError: onError
    };
    
    this.isProcessingResponse = false;
    this.audioBufferCreated = false; // Reset flag when starting a new recording
    
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
    this.clearTimeouts();
    this.isProcessingResponse = false;
    this.audioBufferCreated = false;
    this.sessionConfirmed = false;
    
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
      this.sendJsonEvent({
        type: 'input_audio_buffer.commit'
      });
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
      this.sendJsonEvent({
        type: 'response.cancel'
      });
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
