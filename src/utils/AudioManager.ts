
import { WebSocketManager } from './WebSocketManager';
import { AudioRecorder } from './AudioRecorder';
import { AudioStateManager } from './audio/AudioStateManager';
import { AudioManagerEvents } from './audio/AudioManagerEvents';
import { AudioCommunication } from './audio/AudioCommunication';

export class AudioManager {
  private webSocketManager: WebSocketManager;
  private audioRecorder: AudioRecorder | null = null;
  private audioStateManager: AudioStateManager;
  private audioManagerEvents: AudioManagerEvents;
  private audioCommunication: AudioCommunication;
  private isRecording = false;
  private isProcessing = false;
  private isConnected = false;
  private silenceDetected = false;
  private reconnectingPromise: Promise<void> | null = null;
  
  constructor() {
    this.audioStateManager = new AudioStateManager(() => {
      this.onSilenceDetected();
    });
    
    this.webSocketManager = WebSocketManager.getInstance();
    this.audioManagerEvents = new AudioManagerEvents(this.webSocketManager, this.audioStateManager);
    this.audioCommunication = new AudioCommunication(this.webSocketManager);
    
    this.webSocketManager.onOpen = () => {
      this.isConnected = true;
      console.log('WebSocket connection opened in AudioManager');
    };

    this.webSocketManager.onClose = () => {
      this.isConnected = false;
      this.isRecording = false;
      console.log('WebSocket connection closed in AudioManager');
      this.audioStateManager.setIsSpeaking(false);
    };

    this.webSocketManager.onError = (error) => {
      console.error('WebSocket error in AudioManager:', error);
      this.isConnected = false;
      this.isRecording = false;
      this.audioStateManager.setIsSpeaking(false);
    };
    
    this.webSocketManager.onMessage = (event) => {
      try {
        if (typeof event.data === 'string') {
          const data = JSON.parse(event.data);
          console.log('AudioManager received message type:', data.type);
          
          if (data.type === 'response.audio.delta') {
            this.audioStateManager.setIsSpeaking(true);
          } else if (data.type === 'response.audio.done') {
            this.audioStateManager.setIsSpeaking(false);
          }
        }
      } catch (error) {
        console.error('Error handling WebSocket message:', error);
      }
    };
  }
  
  private onSilenceDetected(): void {
    console.log('Silence detected in AudioManager');
    this.silenceDetected = true;
    if (this.isRecording) {
      this.stopRecording();
    }
  }
  
  async connect(): Promise<void> {
    try {
      if (this.reconnectingPromise) {
        return this.reconnectingPromise;
      }
      
      console.log('AudioManager: Connecting to WebSocket...');
      this.reconnectingPromise = this.webSocketManager.connect();
      await this.reconnectingPromise;
      this.reconnectingPromise = null;
      console.log('AudioManager: Successfully connected to WebSocket');
      this.isConnected = true;
    } catch (error) {
      this.reconnectingPromise = null;
      console.error('AudioManager: Failed to connect to WebSocket:', error);
      this.isConnected = false;
      throw error;
    }
  }
  
  async startRecording(): Promise<void> {
    if (this.isRecording || this.isProcessing) {
      console.log('AudioManager: Already recording or processing');
      return;
    }
    
    if (!this.isConnected) {
      console.log('AudioManager: WebSocket not connected, attempting to connect...');
      try {
        await this.connect();
      } catch (error) {
        console.error('AudioManager: Failed to connect WebSocket for recording:', error);
        throw new Error('Failed to connect for recording');
      }
    }
    
    this.isRecording = true;
    this.silenceDetected = false;
    this.audioStateManager.setIsListening(true);
    
    try {
      // Instantiate a new AudioRecorder for this session
      this.audioRecorder = new AudioRecorder(
        (audioData) => this.audioCommunication.sendAudioData(audioData),
        () => this.onSilenceDetected()
      );
      
      await this.audioRecorder.start();
      console.log('AudioManager: Started recording audio');
    } catch (error) {
      this.isRecording = false;
      this.audioStateManager.setIsListening(false);
      console.error('AudioManager: Failed to start recording:', error);
      throw error;
    }
  }
  
  stopRecording(): void {
    if (!this.isRecording) {
      console.log('AudioManager: Not recording, nothing to stop');
      return;
    }
    
    this.isRecording = false;
    this.isProcessing = true;
    this.audioStateManager.setIsListening(false);
    
    if (this.audioRecorder) {
      this.audioRecorder.stop();
      this.audioRecorder = null;
      console.log('AudioManager: Stopped recording audio');
    }
    
    // If silence was detected or manually stopped, request a response
    if (this.isConnected) {
      console.log('AudioManager: Requesting response after audio recording stopped');
      this.audioCommunication.requestResponse();
    }
    
    this.isProcessing = false;
  }
  
  getAudioStateManager(): AudioStateManager {
    return this.audioStateManager;
  }
  
  disconnect(): void {
    if (this.isRecording && this.audioRecorder) {
      this.audioRecorder.stop();
      this.audioRecorder = null;
      this.isRecording = false;
    }
    
    if (this.isConnected) {
      this.webSocketManager.disconnect();
      this.isConnected = false;
    }
    
    this.audioStateManager.reset();
  }
}
