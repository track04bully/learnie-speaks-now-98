
import { LearnieCallback } from '../types/WebSocketTypes';

export class WebSocketConnection {
  private ws: WebSocket | null = null;
  private reconnectAttempts: number = 0;
  private readonly maxReconnectAttempts: number = 3;
  private lastSentEvent: any = null;
  private sessionResponseTimeout: NodeJS.Timeout | null = null;

  constructor(
    private readonly projectId: string,
    private readonly onMessage: (data: any) => void,
    private readonly onClose: () => void,
    private readonly lastLearnieCallback: LearnieCallback | null
  ) {}

  async connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.ws?.readyState === WebSocket.OPEN) {
        resolve();
        return;
      }

      const wsUrl = `wss://${this.projectId}.functions.supabase.co/functions/v1/realtime-chat`;
      console.log("Connecting to WebSocket:", wsUrl);
      this.ws = new WebSocket(wsUrl);

      this.ws.onopen = () => {
        console.log("WebSocket connected");
        this.reconnectAttempts = 0;
        
        this.sessionResponseTimeout = setTimeout(() => {
          console.error("No response received after session configuration");
          if (this.lastLearnieCallback?.onError) {
            this.lastLearnieCallback.onError("Connection timed out. Please try again.");
          }
          this.close();
          reject(new Error("Session configuration timeout"));
        }, 10000);
        
        resolve();
      };

      this.ws.onerror = this.handleError.bind(this);
      this.ws.onclose = this.handleClose.bind(this);
      this.ws.onmessage = (event) => this.onMessage(JSON.parse(event.data));
    });
  }

  private handleError(error: Event) {
    console.error("WebSocket error:", error);
    if (this.lastLearnieCallback?.onError) {
      this.lastLearnieCallback.onError("Connection failed. Please check your network and try again.");
    }
  }

  private handleClose(event: CloseEvent) {
    console.log("WebSocket closed with code:", event.code, "reason:", event.reason);
    
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      console.log(`Attempting to reconnect (${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
      setTimeout(() => this.connect(), 1000 * this.reconnectAttempts);
    } else {
      if (this.lastLearnieCallback?.onError) {
        this.lastLearnieCallback.onError("Connection lost. Tap to reconnect.");
      }
    }
    this.onClose();
  }

  sendEvent(event: any): boolean {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      console.error("Cannot send event: WebSocket not connected");
      return false;
    }
    
    try {
      const jsonStr = JSON.stringify(event);
      JSON.parse(jsonStr); // Validate JSON
      this.lastSentEvent = event;
      this.ws.send(jsonStr);
      return true;
    } catch (error) {
      console.error("Failed to send JSON event:", error);
      return false;
    }
  }

  close() {
    if (this.sessionResponseTimeout) {
      clearTimeout(this.sessionResponseTimeout);
      this.sessionResponseTimeout = null;
    }
    
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }
}
