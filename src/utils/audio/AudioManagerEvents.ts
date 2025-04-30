
import { WebSocketManager } from '../WebSocketManager';
import { AudioStateManager } from './AudioStateManager';

export class AudioManagerEvents {
  constructor(
    private readonly webSocketManager: WebSocketManager,
    private readonly audioStateManager: AudioStateManager
  ) {
    this.initializeEventHandlers();
  }

  private initializeEventHandlers(): void {
    this.webSocketManager.onMessage = (event) => {
      this.handleWebSocketMessage(event);
    };

    this.webSocketManager.onOpen = () => {
      console.log('WebSocket connection opened');
    };

    this.webSocketManager.onClose = () => {
      console.log('WebSocket connection closed');
      this.audioStateManager.setIsSpeaking(false);
    };

    this.webSocketManager.onError = (error) => {
      console.error('WebSocket error in AudioManager:', error);
      this.audioStateManager.setIsSpeaking(false);
    };
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
}
