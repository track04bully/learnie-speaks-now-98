
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

      // Close any existing connection
      if (this.ws) {
        this.ws.close();
        this.ws = null;
      }

      const wsUrl = `wss://${this.projectId}.functions.supabase.co/functions/v1/realtime-chat`;
      console.log("Connecting to WebSocket:", wsUrl);
      
      try {
        this.ws = new WebSocket(wsUrl);
      } catch (error) {
        console.error("Failed to create WebSocket:", error);
        reject(new Error(`Failed to create WebSocket: ${error.message}`));
        return;
      }

      this.ws.onopen = () => {
        console.log("WebSocket connected successfully");
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

      this.ws.onerror = (event) => {
        console.error("WebSocket error:", event);
        
        if (this.lastLearnieCallback?.onError) {
          if (navigator.onLine === false) {
            this.lastLearnieCallback.onError("You appear to be offline. Please check your internet connection and try again.");
          } else {
            this.lastLearnieCallback.onError("Connection failed. Please try again in a moment.");
          }
        }
        
        // Don't reject the promise if it's already been resolved
        if (this.ws?.readyState !== WebSocket.OPEN) {
          reject(new Error("WebSocket connection failed"));
        }
      };
      
      this.ws.onclose = this.handleClose.bind(this);
      this.ws.onmessage = (event) => {
        try {
          const parsedData = JSON.parse(event.data);
          console.log("Received WebSocket message:", parsedData.type);
          this.onMessage(parsedData);
        } catch (error) {
          console.error("Error parsing message:", error);
        }
      };
    });
  }

  private handleClose(event: CloseEvent) {
    console.log("WebSocket closed with code:", event.code, "reason:", event.reason || "No reason provided");
    
    // Clear session timeout if it exists
    if (this.sessionResponseTimeout) {
      clearTimeout(this.sessionResponseTimeout);
      this.sessionResponseTimeout = null;
    }
    
    if (this.reconnectAttempts < this.maxReconnectAttempts && navigator.onLine) {
      this.reconnectAttempts++;
      console.log(`Attempting to reconnect (${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
      setTimeout(() => this.connect().catch(err => {
        console.error("Reconnection attempt failed:", err);
      }), 1000 * this.reconnectAttempts);
    } else {
      if (this.lastLearnieCallback?.onError) {
        if (navigator.onLine === false) {
          this.lastLearnieCallback.onError("You appear to be offline. Please check your internet connection.");
        } else if (event.code === 1006) {
          this.lastLearnieCallback.onError("Connection closed unexpectedly. Please check if the server is running and try again.");
        } else {
          this.lastLearnieCallback.onError(`Connection lost (code: ${event.code}). Tap to reconnect.`);
        }
      }
      this.onClose();
    }
  }

  sendEvent(event: any): boolean {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      console.error("Cannot send event: WebSocket not connected, readyState:", this.ws?.readyState);
      return false;
    }
    
    try {
      const jsonStr = JSON.stringify(event);
      JSON.parse(jsonStr); // Validate JSON
      this.lastSentEvent = event;
      this.ws.send(jsonStr);
      console.log("Sent WebSocket event:", event.type);
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
      console.log("Closing WebSocket connection");
      this.ws.close();
      this.ws = null;
    }
  }

  isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }
}
