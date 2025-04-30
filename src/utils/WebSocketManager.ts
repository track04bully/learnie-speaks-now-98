
export class WebSocketManager {
  private static instance: WebSocketManager | null = null;
  private webSocket: WebSocket | null = null;
  private reconnectAttempts = 0;
  private readonly MAX_RECONNECT_ATTEMPTS = 5;
  private readonly RECONNECT_DELAY = 2000; // 2 seconds
  
  public onMessage: ((event: MessageEvent) => void) | null = null;
  public onOpen: (() => void) | null = null;
  public onClose: (() => void) | null = null;
  public onError: ((error: Event) => void) | null = null;
  
  // Singleton pattern
  public static getInstance(): WebSocketManager {
    if (!WebSocketManager.instance) {
      WebSocketManager.instance = new WebSocketManager();
    }
    return WebSocketManager.instance;
  }
  
  async connect(): Promise<void> {
    if (this.webSocket && (this.webSocket.readyState === WebSocket.OPEN || this.webSocket.readyState === WebSocket.CONNECTING)) {
      console.log('WebSocket already connected or connecting');
      return;
    }
    
    // Reset reconnection attempts if this is a new connection
    this.reconnectAttempts = 0;
    
    return this.createConnection();
  }
  
  private async createConnection(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        // For production use the deployed edge function URL with the correct path format
        // The format must include the /functions/v1/ path segment
        const wsUrl = `wss://ceofrvinluwymyuizztv.functions.supabase.co/functions/v1/realtime-chat`;
        
        console.log('Connecting to WebSocket at:', wsUrl);
        this.webSocket = new WebSocket(wsUrl);
        
        this.webSocket.onopen = () => {
          console.log('WebSocket connection established');
          this.reconnectAttempts = 0;
          if (this.onOpen) this.onOpen();
          resolve();
        };
        
        this.webSocket.onmessage = (event) => {
          console.log('WebSocket message received:', typeof event.data, 
                     typeof event.data === 'string' ? event.data.slice(0, 100) + '...' : '[binary data]');
          if (this.onMessage) this.onMessage(event);
        };
        
        this.webSocket.onclose = (event) => {
          console.log(`WebSocket closed with code ${event.code}, reason: ${event.reason}`);
          
          // Only attempt to reconnect if it wasn't closed intentionally
          if (event.code !== 1000) {
            this.attemptReconnect();
          }
          
          if (this.onClose) this.onClose();
        };
        
        this.webSocket.onerror = (error) => {
          console.error('WebSocket error:', error);
          // Add more detailed error logging
          const target = error.target as WebSocket;
          if (target && target.readyState !== undefined) {
            console.error(`WebSocket state at time of error: ${target.readyState}`);
          }
          if (this.onError) this.onError(error);
          reject(error);
        };
      } catch (error) {
        console.error('Error creating WebSocket connection:', error);
        reject(error);
      }
    });
  }
  
  private attemptReconnect(): void {
    if (this.reconnectAttempts >= this.MAX_RECONNECT_ATTEMPTS) {
      console.error('Maximum reconnection attempts reached');
      return;
    }
    
    this.reconnectAttempts++;
    console.log(`Attempting to reconnect (${this.reconnectAttempts}/${this.MAX_RECONNECT_ATTEMPTS})...`);
    
    setTimeout(() => {
      this.createConnection().catch(error => {
        console.error('Reconnection attempt failed:', error);
      });
    }, this.RECONNECT_DELAY * this.reconnectAttempts);
  }
  
  sendMessage(message: any): void {
    if (!this.webSocket || this.webSocket.readyState !== WebSocket.OPEN) {
      console.error('Cannot send message: WebSocket not open');
      return;
    }
    
    try {
      // If message is an ArrayBuffer (raw audio data), format it properly
      if (message instanceof ArrayBuffer) {
        // Convert ArrayBuffer to base64 string
        const uint8Array = new Uint8Array(message);
        let binaryString = '';
        for (let i = 0; i < uint8Array.length; i++) {
          binaryString += String.fromCharCode(uint8Array[i]);
        }
        
        const base64Audio = btoa(binaryString);
        
        // Format as JSON with base64 audio data
        const audioMessage = {
          type: 'input_audio_buffer.append',
          event_id: `audio_${Date.now()}`,
          audio: base64Audio
        };
        
        const messageString = JSON.stringify(audioMessage);
        this.webSocket.send(messageString);
        console.log('Sent audio data:', base64Audio.length, 'bytes');
      } else {
        // For regular JSON messages
        const messageString = JSON.stringify(message);
        this.webSocket.send(messageString);
        console.log('Sent message:', message.type);
      }
    } catch (error) {
      console.error('Error sending WebSocket message:', error);
    }
  }
  
  disconnect(): void {
    if (this.webSocket) {
      // Use 1000 (Normal Closure) to indicate intentional closing
      this.webSocket.close(1000, 'Disconnecting normally');
      this.webSocket = null;
    }
  }
  
  isConnected(): boolean {
    return this.webSocket?.readyState === WebSocket.OPEN;
  }
  
  startRecording(onSpeakingChange: (isSpeaking: boolean) => void, onError: (errorMessage?: string) => void): Promise<void> {
    console.log('Starting recording in WebSocketManager');
    return Promise.resolve();
  }
  
  manualStop(): void {
    console.log('Manual stop recording');
    
    // When manually stopping, send the commit event without the 'name' field
    if (this.isConnected()) {
      this.sendMessage({
        type: 'input_audio_buffer.commit',
        event_id: `commit_${Date.now()}`
      });
      
      // Immediately follow with a response creation request
      this.sendMessage({
        type: 'response.create',
        event_id: `resp_${Date.now()}`
      });
    }
  }
  
  interruptSpeaking(): void {
    console.log('Interrupting speaking');
    // Add any logic needed to interrupt the AI speaking
  }
}
