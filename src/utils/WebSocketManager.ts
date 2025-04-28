
import { AudioRecorder } from './AudioRecorder';
import { AudioManager } from './AudioManager';
import { WebSocketConnection } from './websocket/WebSocketConnection';
import { AudioStateManager } from './audio/AudioStateManager';
import { LearnieCallback } from './types/WebSocketTypes';

export class WebSocketManager {
  private static instance: WebSocketManager;
  private projectId = "ceofrvinluwymyuizztv";
  private audioRecorder: AudioRecorder | null = null;
  private audioManager: AudioManager;
  private lastLearnieCallback: LearnieCallback | null = null;
  private wsConnection: WebSocketConnection;
  private audioState: AudioStateManager;
  private inactivityTimeout: NodeJS.Timeout | null = null;
  private readonly sessionTimeoutDuration: number = 5 * 60 * 1000;

  private constructor() {
    this.audioState = new AudioStateManager(() => this.stopRecording("I didn't catch that. Tap to try again."));
    
    this.audioManager = new AudioManager((isSpeaking) => {
      if (this.lastLearnieCallback) {
        this.lastLearnieCallback.onSpeakingChange(isSpeaking);
      }
      this.resetInactivityTimeout();
    });

    this.wsConnection = new WebSocketConnection(
      this.projectId,
      this.handleMessage.bind(this),
      () => this.audioState.reset(),
      this.lastLearnieCallback
    );

    this.audioRecorder = new AudioRecorder(
      (audioData) => this.handleAudioData(audioData),
      () => this.audioState.handleSilence()
    );
  }

  static getInstance() {
    if (!WebSocketManager.instance) {
      WebSocketManager.instance = new WebSocketManager();
    }
    return WebSocketManager.instance;
  }

  private handleMessage = (data: any) => {
    this.resetInactivityTimeout();

    switch (data.type) {
      case 'response.audio.delta':
        if (data.delta) {
          if (!this.audioState.isProcessing()) {
            this.audioState.setProcessingResponse(true);
            if (this.lastLearnieCallback) {
              this.lastLearnieCallback.onSpeakingChange(true);
            }
          }
          this.audioManager.addAudioChunk(data.delta);
        }
        break;
      case 'response.done':
        console.log("Response completed");
        this.audioState.setProcessingResponse(false);
        setTimeout(() => {
          if (this.lastLearnieCallback && !this.audioState.isProcessing()) {
            this.lastLearnieCallback.onSpeakingChange(false);
          }
        }, 500);
        break;
      case 'session.created':
        console.log("Session created successfully");
        break;
      case 'session.updated':
        console.log("Session updated successfully");
        this.audioState.setSessionConfirmed(true);
        break;
      case 'error':
        console.error("Error message from server:", data.message);
        if (this.lastLearnieCallback?.onError) {
          this.lastLearnieCallback.onError(data.message || "An error occurred");
        }
        break;
    }
  };

  private handleAudioData(audioData: ArrayBuffer) {
    if (!this.wsConnection.isConnected()) return;
    
    if (!this.audioState.isSessionConfirmed()) {
      console.log("Session not confirmed yet, buffering audio");
      return;
    }
    
    this.audioState.resetSilenceTimeout();
    this.resetInactivityTimeout();
    
    if (!this.audioState.isAudioBufferCreated()) {
      const createMessage = {
        type: "input_audio_buffer.create",
        format: "pcm16",
        name: "mic"
      };
      
      const success = this.wsConnection.sendEvent(createMessage);
      if (success) {
        console.log('Created audio buffer with proper format');
        this.audioState.setAudioBufferCreated(true);
      } else {
        console.error('Failed to create audio buffer');
        return;
      }
    }
    
    const base64Audio = this.arrayBufferToBase64(audioData);
    const appendMessage = {
      type: "input_audio_buffer.append",
      name: "mic",
      audio: base64Audio
    };
    
    this.wsConnection.sendEvent(appendMessage);
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
    if (this.inactivityTimeout) {
      clearTimeout(this.inactivityTimeout);
      this.inactivityTimeout = null;
    }

    this.inactivityTimeout = setTimeout(() => {
      console.log(`Session inactive for ${this.sessionTimeoutDuration/60000} minutes, closing connection`);
      this.disconnect();
    }, this.sessionTimeoutDuration);
  }

  async connect(): Promise<void> {
    await this.wsConnection.connect();
    this.resetInactivityTimeout();
  }

  async startRecording(onSpeakingChange?: (isSpeaking: boolean) => void, onError?: (message: string) => void) {
    if (!this.audioRecorder) return;
    
    this.lastLearnieCallback = {
      onSpeakingChange: onSpeakingChange || (() => {}),
      onError: onError
    };
    
    this.audioState.setProcessingResponse(false);
    this.audioState.setAudioBufferCreated(false);
    
    if (!this.wsConnection.isConnected()) {
      await this.connect();
    }

    this.resetInactivityTimeout();
    this.audioState.setupAutoStop(() => this.stopRecording("Recording timed out. Tap to try again."));
    
    await this.audioRecorder.start();
    console.log('Recording started');
  }

  stopRecording(message?: string) {
    this.audioState.clearTimeouts();
    
    if (this.audioRecorder) {
      this.audioRecorder.stop();
      console.log('Recording stopped', message ? `with message: ${message}` : '');
    }

    this.resetInactivityTimeout();
  }

  disconnect() {
    console.log('Closing WebSocket connection and cleaning up resources');
    if (this.inactivityTimeout) {
      clearTimeout(this.inactivityTimeout);
      this.inactivityTimeout = null;
    }
    
    this.audioState.reset();
    this.wsConnection.close();
    this.audioManager.stop();
    this.stopRecording();
  }

  isConnected(): boolean {
    return this.wsConnection.isConnected();
  }

  manualStop() {
    console.log('Manual stop triggered');
    if (this.wsConnection.isConnected()) {
      this.wsConnection.sendEvent({
        type: 'input_audio_buffer.commit'
      });
    }
    this.stopRecording();
    this.resetInactivityTimeout();
  }

  interruptSpeaking() {
    console.log('Interrupt speaking triggered');
    
    this.audioManager.stop();

    if (this.wsConnection.isConnected()) {
      this.wsConnection.sendEvent({
        type: 'response.cancel'
      });
      console.log('Sent response.cancel event');
    }
    
    this.audioState.setProcessingResponse(false);
    
    if (this.lastLearnieCallback) {
      this.lastLearnieCallback.onSpeakingChange(false);
    }
    
    this.resetInactivityTimeout();
  }
}
