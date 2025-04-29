
import { WebSocketManager } from './WebSocketManager';
import { AudioRecorder } from './AudioRecorder';
import { AudioStateManager } from './audio/AudioStateManager';

export class AudioManager {
  private webSocketManager: WebSocketManager;
  private audioRecorder: AudioRecorder;
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
    
    this.audioRecorder = new AudioRecorder(
      (audioData) => this.sendAudioData(audioData),
      () => this.onSilenceDetected()
    );
    
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
      console.error('WebSocket error:', error);
      this.isConnected = false;
      this.isRecording = false;
      this.audioStateManager.setIsSpeaking(false);
    };
  }
  
  private onSilenceDetected(): void {
    this.silenceDetected = true;
    if (this.isRecording) {
      this.stopRecording();
    }
  }
  
  async connect(): Promise<void> {
    try {
      await this.webSocketManager.connect();
    } catch (error) {
      console.error('Failed to connect to WebSocket:', error);
      throw error;
    }
  }
  
  async startRecording(): Promise<void> {
    if (this.isRecording || this.isProcessing) {
      console.log('Already recording or processing');
      return;
    }
    
    if (!this.isConnected) {
      console.log('WebSocket not connected, attempting to connect...');
      try {
        await this.connect();
      } catch (error) {
        console.error('Failed to connect WebSocket for recording:', error);
        throw new Error('Failed to connect for recording');
      }
    }
    
    this.isRecording = true;
    this.silenceDetected = false;
    this.audioStateManager.setIsListening(true);
    
    try {
      await this.audioRecorder.start();
      console.log('Started recording audio');
    } catch (error) {
      this.isRecording = false;
      this.audioStateManager.setIsListening(false);
      console.error('Failed to start recording:', error);
      throw error;
    }
  }
  
  stopRecording(): void {
    if (!this.isRecording) {
      console.log('Not recording, nothing to stop');
      return;
    }
    
    this.isRecording = false;
    this.isProcessing = true;
    this.audioStateManager.setIsListening(false);
    
    this.audioRecorder.stop();
    console.log('Stopped recording audio');
    
    // If silence was detected, request a response
    if (this.silenceDetected && this.isConnected) {
      console.log('Requesting response after silence detection');
      this.requestResponse();
    } else if (this.isConnected) {
      console.log('Requesting response after manual stop');
      this.requestResponse();
    }
    
    this.isProcessing = false;
  }
  
  private sendAudioData(audioData: ArrayBuffer): void {
    if (!this.isConnected) {
      console.warn('Cannot send audio data: WebSocket not connected');
      return;
    }
    
    try {
      // Convert audio data to Float32Array for processing
      const view = new DataView(audioData);
      const floatArray = new Float32Array(view.byteLength / 2);
      for (let i = 0; i < floatArray.length; i++) {
        floatArray[i] = view.getInt16(i * 2, true) / 32768.0; // true = little endian
      }
      
      // Convert audio data to base64
      const base64Audio = this.encodeAudioData(floatArray);
      
      // Remove the 'name' field from the message per April 2025 update
      const audioMessage = {
        type: 'input_audio_buffer.append',
        audio: base64Audio
        // 'name: "mic"' field removed
      };
      
      this.webSocketManager.sendMessage(audioMessage);
    } catch (error) {
      console.error('Error sending audio data:', error);
    }
  }
  
  private encodeAudioData(float32Array: Float32Array): string {
    try {
      // Convert to 16-bit PCM
      const int16Array = new Int16Array(float32Array.length);
      for (let i = 0; i < float32Array.length; i++) {
        const s = Math.max(-1, Math.min(1, float32Array[i]));
        int16Array[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
      }
      
      // Convert to binary string
      const uint8Array = new Uint8Array(int16Array.buffer);
      let binary = '';
      const chunkSize = 0x8000;
      
      for (let i = 0; i < uint8Array.length; i += chunkSize) {
        const chunk = uint8Array.subarray(i, Math.min(i + chunkSize, uint8Array.length));
        binary += String.fromCharCode.apply(null, Array.from(chunk));
      }
      
      // Convert to base64
      return btoa(binary);
    } catch (error) {
      console.error('Error encoding audio data:', error);
      throw error;
    }
  }
  
  private requestResponse(): void {
    if (!this.isConnected) {
      console.warn('Cannot request response: WebSocket not connected');
      return;
    }
    
    try {
      // Send text message event
      const textMessage = {
        type: 'conversation.item.create',
        item: {
          type: 'message',
          role: 'user',
          content: [
            {
              type: 'input_audio_transcription'
            }
          ]
        }
      };
      
      this.webSocketManager.sendMessage(textMessage);
      
      // Send response creation request
      this.webSocketManager.sendMessage({
        type: 'response.create'
      });
      
      console.log('Response requested');
    } catch (error) {
      console.error('Error requesting response:', error);
    }
  }
  
  private handleWebSocketMessage(event: MessageEvent): void {
    try {
      const data = JSON.parse(event.data);
      
      // Handle different event types
      switch (data.type) {
        case 'response.audio.delta':
          this.audioStateManager.setIsSpeaking(true);
          break;
          
        case 'response.audio.done':
          this.audioStateManager.setIsSpeaking(false);
          break;
          
        case 'error':
          console.error('Error from WebSocket:', data.error);
          break;
          
        default:
          // Process other message types as needed
          break;
      }
    } catch (error) {
      console.error('Error handling WebSocket message:', error);
    }
  }
  
  getAudioStateManager(): AudioStateManager {
    return this.audioStateManager;
  }
  
  disconnect(): void {
    if (this.isRecording) {
      this.stopRecording();
    }
    
    if (this.isConnected) {
      this.webSocketManager.disconnect();
      this.isConnected = false;
    }
  }
}
