
import { WebSocketManager } from '../WebSocketManager';

export class AudioCommunication {
  constructor(private readonly webSocketManager: WebSocketManager) {}
  
  sendAudioData(audioData: ArrayBuffer): void {
    if (!this.webSocketManager.isConnected()) {
      console.warn('AudioCommunication: Cannot send audio data: WebSocket not connected');
      return;
    }
    
    try {
      // Send the audio data directly to the WebSocketManager
      this.webSocketManager.sendMessage(audioData);
    } catch (error) {
      console.error('AudioCommunication: Error sending audio data:', error);
    }
  }
  
  requestResponse(): void {
    if (!this.webSocketManager.isConnected()) {
      console.warn('AudioCommunication: Cannot request response: WebSocket not connected');
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
      
      console.log('AudioCommunication: Response requested');
    } catch (error) {
      console.error('AudioCommunication: Error requesting response:', error);
    }
  }
}
