
export class WebSocketManager {
  private static instance: WebSocketManager | null = null;
  private webSocket: WebSocket | null = null;
  private clientSecret: string | null = null;
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
    
    // First, we need to get a client secret from our Edge function
    try {
      console.log('Fetching OpenAI session token...');
      
      // Call the Edge function to get a session token
      const response = await fetch('https://ceofrvinluwymyuizztv.functions.supabase.co/functions/v1/realtime-chat');
      
      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Failed to get session token: ${error}`);
      }
      
      const data = await response.json();
      
      if (!data.client_secret?.value) {
        throw new Error('No client secret in session response');
      }
      
      this.clientSecret = data.client_secret.value;
      console.log('Received client secret, connecting to OpenAI...');
      
      return this.createConnection();
    } catch (error) {
      console.error('Error getting session token:', error);
      throw error;
    }
  }
  
  private async createConnection(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        // Connect directly to OpenAI WebSocket API
        const wsUrl = 'wss://api.openai.com/v1/realtime';
        
        console.log('Connecting to OpenAI WebSocket at:', wsUrl);
        this.webSocket = new WebSocket(wsUrl);
        
        this.webSocket.onopen = () => {
          console.log('WebSocket connection established');
          
          // Authenticate with OpenAI using the client secret
          if (this.webSocket && this.clientSecret) {
            this.webSocket.send(JSON.stringify({
              type: 'authentication',
              client_secret: this.clientSecret
            }));
            console.log('Authentication message sent');
          }
          
          this.reconnectAttempts = 0;
          if (this.onOpen) this.onOpen();
          resolve();
        };
        
        this.webSocket.onmessage = (event) => {
          const data = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;
          console.log('WebSocket message received:', data.type || 'unknown type');
          
          if (data.type === 'session.created') {
            console.log('Session created, configuring...');
            // Configure the session
            const sessionConfig = {
              type: 'session.update',
              event_id: `evt_${Date.now()}`,
              session: {
                modalities: ['audio'],
                voice: 'echo',
                audio: {
                  input_format: 'pcm_16khz',
                  output_format: 'pcm_16khz',
                  sample_rate: 16000,
                  channel_count: 1
                },
                turn_detection: {
                  type: 'server',
                  vad_threshold: 0.5, 
                  prefix_padding_ms: 300,
                  silence_duration_ms: 1000
                },
                instructions: 'You are Learnie, a friendly tutor for children. Speak simply and clearly. Be encouraging and positive.'
              }
            };
            
            this.webSocket?.send(JSON.stringify(sessionConfig));
            console.log('Session configuration sent');
          }
          
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
      this.connect().catch(error => {
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
  
  manualStop(): void {
    console.log('Manual stop recording');
    
    // When manually stopping, send the commit event
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
    // We can send a special event to interrupt AI speaking when implemented
  }
}
