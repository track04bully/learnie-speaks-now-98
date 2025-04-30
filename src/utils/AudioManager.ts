
import { WebSocketManager } from './WebSocketManager';
import { AudioRecorder } from './AudioRecorder';
import { AudioStateManager } from './audio/AudioStateManager';

export class AudioManager {
  private webSocketManager: WebSocketManager;
  private audioRecorder: AudioRecorder | null = null;
  private audioStateManager: AudioStateManager;
  private isRecording = false;
  private isProcessing = false;
  private isConnected = false;
  private silenceDetected = false;
  
  constructor() {
    this.audioStateManager = new AudioStateManager(() => {
      this.onSilenceDetected();
    });
    
    this.webSocketManager = WebSocketManager.getInstance();
    
    this.webSocketManager.onMessage = (event) => {
      this.handleWebSocketMessage(event);
    };

    this.webSocketManager.onOpen = () => {
      this.isConnected = true;
      console.log('WebSocket connection opened');
    };

    this.webSocketManager.onClose = () => {
      this.isConnected = false;
      this.isRecording = false;
      console.log('WebSocket connection closed');
      this.audioStateManager.setIsSpeaking(false);
    };

    this.webSocketManager.onError = (error) => {
      console.error('WebSocket error in AudioManager:', error);
      this.isConnected = false;
      this.isRecording = false;
      this.audioStateManager.setIsSpeaking(false);
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
      console.log('AudioManager: Connecting to WebSocket...');
      await this.webSocketManager.connect();
      console.log('AudioManager: Successfully connected to WebSocket');
    } catch (error) {
      console.error('AudioManager: Failed to connect to WebSocket:', error);
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
        (audioData) => this.sendAudioData(audioData),
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
      this.requestResponse();
    }
    
    this.isProcessing = false;
  }
  
  private sendAudioData(audioData: ArrayBuffer): void {
    if (!this.isConnected) {
      console.warn('AudioManager: Cannot send audio data: WebSocket not connected');
      return;
    }
    
    try {
      // Send the audio data directly to the WebSocketManager
      this.webSocketManager.sendMessage(audioData);
    } catch (error) {
      console.error('AudioManager: Error sending audio data:', error);
    }
  }
  
  private requestResponse(): void {
    if (!this.isConnected) {
      console.warn('AudioManager: Cannot request response: WebSocket not connected');
      return;
    }
    
    try {
      // Send commit event to finalize the audio buffer
      this.webSocketManager.sendMessage({
        type: 'input_audio_buffer.commit',
        event_id: `commit_${Date.now()}`
      });
      
      // Send text message event
      this.webSocketManager.sendMessage({
        type: 'conversation.item.create',
        event_id: `conv_${Date.now()}`,
        item: {
          type: 'message',
          role: 'user',
          content: [
            {
              type: 'input_audio_transcription'
            }
          ]
        }
      });
      
      // Send response creation request
      this.webSocketManager.sendMessage({
        type: 'response.create',
        event_id: `resp_${Date.now()}`
      });
      
      console.log('AudioManager: Response requested');
    } catch (error) {
      console.error('AudioManager: Error requesting response:', error);
    }
  }
  
  private handleWebSocketMessage(event: MessageEvent): void {
    try {
      const data = JSON.parse(event.data);
      console.log('AudioManager: Received WebSocket event:', data.type);
      
      // Handle different event types
      switch (data.type) {
        case 'response.audio.delta':
          this.audioStateManager.setIsSpeaking(true);
          break;
          
        case 'response.audio.done':
          this.audioStateManager.setIsSpeaking(false);
          break;
          
        case 'error':
          console.error('AudioManager: Error from WebSocket:', data.error);
          break;
          
        default:
          // Process other message types as needed
          break;
      }
    } catch (error) {
      console.error('AudioManager: Error handling WebSocket message:', error);
    }
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
