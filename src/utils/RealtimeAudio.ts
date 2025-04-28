import { supabase } from "@/integrations/supabase/client";

export class AudioRecorder {
  private stream: MediaStream | null = null;
  private audioContext: AudioContext | null = null;
  private processor: ScriptProcessorNode | null = null;
  private source: MediaStreamAudioSourceNode | null = null;
  private ws: WebSocket | null = null;

  constructor() {}

  async start(webSocket: WebSocket) {
    this.ws = webSocket;
    
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          sampleRate: 16000,
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      });
      
      this.audioContext = new AudioContext({
        sampleRate: 16000,
      });
      
      this.source = this.audioContext.createMediaStreamSource(this.stream);
      this.processor = this.audioContext.createScriptProcessor(4096, 1, 1);
      
      this.processor.onaudioprocess = (e) => {
        const inputData = e.inputBuffer.getChannelData(0);
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
          this.ws.send(JSON.stringify({
            type: 'input_audio_buffer.append',
            audio: this.encodeAudioData(inputData)
          }));
        }
      };
      
      this.source.connect(this.processor);
      this.processor.connect(this.audioContext.destination);
    } catch (error) {
      console.error('Error accessing microphone:', error);
      throw error;
    }
  }

  stop() {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({
        type: 'audio_end'
      }));
    }

    if (this.source) {
      this.source.disconnect();
      this.source = null;
    }
    if (this.processor) {
      this.processor.disconnect();
      this.processor = null;
    }
    if (this.stream) {
      this.stream.getTracks().forEach(track => track.stop());
      this.stream = null;
    }
    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }
    this.ws = null;
  }

  private encodeAudioData(float32Array: Float32Array): string {
    const int16Array = new Int16Array(float32Array.length);
    for (let i = 0; i < float32Array.length; i++) {
      const s = Math.max(-1, Math.min(1, float32Array[i]));
      int16Array[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
    }
    
    const uint8Array = new Uint8Array(int16Array.buffer);
    let binary = '';
    const chunkSize = 0x8000;
    
    for (let i = 0; i < uint8Array.length; i += chunkSize) {
      const chunk = uint8Array.subarray(i, Math.min(i + chunkSize, uint8Array.length));
      binary += String.fromCharCode.apply(null, Array.from(chunk));
    }
    
    return btoa(binary);
  }
}

// Message interfaces for conversation history
export interface Message {
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
}

export class RealtimeChat {
  private ws: WebSocket | null = null;
  private recorder: AudioRecorder | null = null;
  private audioContext: AudioContext | null = null;
  private audioQueue: AudioChunk[] = [];
  private isPlaying = false;
  private isMicrophoneActive = false;
  private isConnected = false;
  private sessionId: string | null = null;
  private messageHistory: Message[] = [];
  private maxReconnectAttempts = 3;
  private reconnectAttempts = 0;
  private heartbeatInterval: number | null = null;
  
  constructor(
    private onConnectionChange: (connected: boolean) => void,
    private onTranscriptUpdate: (text: string) => void,
    private onSpeakingChange: (speaking: boolean) => void,
    private onProcessing: (processing: boolean) => void,
    private onMessageHistoryUpdate?: (messages: Message[]) => void
  ) {
    this.recorder = new AudioRecorder();
    
    // Try to load conversation history from localStorage
    this.loadConversationHistory();
  }

  async connect() {
    try {
      console.log("Initializing connection to Learnie...");
      this.audioContext = new AudioContext({
        sampleRate: 16000,
      });
      
      this.audioQueue = [];
      this.isPlaying = false;
      
      const SUPABASE_PROJECT_REF = "ceofrvinluwymyuizztv";
      this.ws = new WebSocket(`wss://${SUPABASE_PROJECT_REF}.functions.supabase.co/realtime-chat`);
      
      this.ws.onopen = async () => {
        console.log("WebSocket connection opened");
        this.isConnected = true;
        this.onConnectionChange(true);
        this.reconnectAttempts = 0;
        
        // Set up a heartbeat to keep the connection alive
        if (this.heartbeatInterval) {
          clearInterval(this.heartbeatInterval);
        }
        
        this.heartbeatInterval = setInterval(() => {
          if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify({type: "ping"}));
          }
        }, 30000) as unknown as number;
        
        if (this.recorder) {
          await this.recorder.start(this.ws!);
          this.isMicrophoneActive = true;
          console.log("Microphone activated");
        }
      };
      
      this.ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          console.log("Received WebSocket message:", data.type);
          
          switch (data.type) {
            case "response.audio.delta":
              this.onSpeakingChange(true);
              const audioData = this.decodeBase64ToPCM(data.delta);
              this.addToQueue(audioData);
              break;
              
            case "response.audio_transcript.delta":
              // Store assistant message in history
              this.addOrUpdateMessage('assistant', data.delta);
              this.onTranscriptUpdate(data.delta);
              break;
              
            case "response.audio.done":
              setTimeout(() => this.onSpeakingChange(false), 300);
              break;
              
            case "response.created":
              console.log("Assistant started responding");
              this.onProcessing(false);
              break;
              
            case "response.done":
              console.log("Assistant finished responding");
              this.onSpeakingChange(false);
              
              // Save conversation history after assistant response
              this.saveConversationHistory();
              break;
              
            case "heartbeat":
            case "pong":
              console.log("Received heartbeat/pong from server");
              // Keep connection alive, no action needed
              break;
              
            case "speech_stopped":
              console.log("Speech input stopped");
              this.onProcessing(true);
              break;
            
            case "input_audio_transcript.update":
              console.log("Received transcript update:", data.transcript);
              if (data.transcript) {
                // Store user message in history
                this.addOrUpdateMessage('user', data.transcript);
              }
              break;
              
            case "token_received":
              // Store the session ID for context persistence
              if (data.session_id) {
                this.sessionId = data.session_id;
                console.log("Received session ID:", this.sessionId);
              }
              break;
              
            case "moderation.violation":
              console.warn("Content moderation violation:", data.message);
              // Handle moderation violation
              this.addOrUpdateMessage('assistant', "I'm sorry, I can't respond to that request.");
              break;

            case "error":
              console.error("Error from server:", data.message);
              this.onConnectionChange(false);
              break;

            default:
              console.log("Other message type:", data.type);
          }
        } catch (error) {
          console.error("Error processing WebSocket message:", error);
        }
      };
      
      this.ws.onerror = (error) => {
        console.error("WebSocket error:", error);
        this.onConnectionChange(false);
        this.isConnected = false;
        
        // Attempt reconnection
        if (this.reconnectAttempts < this.maxReconnectAttempts) {
          console.log(`Attempting to reconnect (${this.reconnectAttempts + 1}/${this.maxReconnectAttempts})...`);
          this.reconnectAttempts++;
          setTimeout(() => this.connect(), 2000);
        }
      };
      
      this.ws.onclose = (event) => {
        console.log("WebSocket connection closed. Code:", event.code, "Reason:", event.reason);
        if (this.heartbeatInterval) {
          clearInterval(this.heartbeatInterval);
          this.heartbeatInterval = null;
        }
        
        if (this.recorder) {
          this.recorder.stop();
        }
        this.onConnectionChange(false);
        this.isConnected = false;
        this.isMicrophoneActive = false;
        
        // Attempt reconnection for unexpected closures
        if (event.code !== 1000 && event.code !== 1001 && this.reconnectAttempts < this.maxReconnectAttempts) {
          console.log(`Connection closed unexpectedly. Attempting to reconnect (${this.reconnectAttempts + 1}/${this.maxReconnectAttempts})...`);
          this.reconnectAttempts++;
          setTimeout(() => this.connect(), 2000);
        }
      };
      
    } catch (error) {
      console.error("Error connecting to WebSocket:", error);
      this.onConnectionChange(false);
      throw error;
    }
  }

  disconnect() {
    // Save conversation history before disconnecting
    this.saveConversationHistory();
    
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
    
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    if (this.recorder) {
      this.recorder.stop();
      this.isMicrophoneActive = false;
    }
    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }
    this.isConnected = false;
    this.onConnectionChange(false);
    this.audioQueue = [];
    this.isPlaying = false;
    console.log("Connection to Learnie closed");
  }

  isActive(): boolean {
    return this.isConnected && this.isMicrophoneActive;
  }

  // Get the current message history
  getMessageHistory(): Message[] {
    return [...this.messageHistory];
  }
  
  // Clear conversation history
  clearHistory() {
    this.messageHistory = [];
    localStorage.removeItem('conversation_history');
    
    if (this.onMessageHistoryUpdate) {
      this.onMessageHistoryUpdate(this.messageHistory);
    }
  }

  private addOrUpdateMessage(role: 'user' | 'assistant', content: string) {
    const now = Date.now();
    
    // If the last message is from the same role and within 10 seconds, update it
    const lastMessage = this.messageHistory.length > 0 ? 
      this.messageHistory[this.messageHistory.length - 1] : null;
      
    if (lastMessage && lastMessage.role === role && now - lastMessage.timestamp < 10000) {
      // Update existing message
      lastMessage.content += content;
      lastMessage.timestamp = now;
    } else {
      // Add new message
      this.messageHistory.push({
        role,
        content,
        timestamp: now
      });
      
      // Limit history size
      if (this.messageHistory.length > 50) {
        this.messageHistory.shift();
      }
    }
    
    // Notify about history update
    if (this.onMessageHistoryUpdate) {
      this.onMessageHistoryUpdate([...this.messageHistory]);
    }
  }

  private saveConversationHistory() {
    try {
      localStorage.setItem('conversation_history', JSON.stringify(this.messageHistory));
    } catch (error) {
      console.error('Error saving conversation history:', error);
    }
  }

  private loadConversationHistory() {
    try {
      const savedHistory = localStorage.getItem('conversation_history');
      if (savedHistory) {
        this.messageHistory = JSON.parse(savedHistory);
        
        // Notify about loaded history
        if (this.onMessageHistoryUpdate) {
          this.onMessageHistoryUpdate([...this.messageHistory]);
        }
      }
    } catch (error) {
      console.error('Error loading conversation history:', error);
      // Reset if there's an error
      this.messageHistory = [];
    }
  }

  private decodeBase64ToPCM(base64Data: string): Float32Array {
    const binaryString = atob(base64Data);
    const bytes = new Uint8Array(binaryString.length);
    
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    
    const int16Data = new Int16Array(bytes.buffer);
    
    const float32Data = new Float32Array(int16Data.length);
    for (let i = 0; i < int16Data.length; i++) {
      float32Data[i] = int16Data[i] / 32768.0;
    }
    
    return float32Data;
  }

  private async addToQueue(audioData: Float32Array) {
    this.audioQueue.push({ data: audioData });
    
    if (!this.isPlaying && this.audioContext) {
      await this.playNext();
    }
  }

  private async playNext() {
    if (this.audioQueue.length === 0 || !this.audioContext) {
      this.isPlaying = false;
      return;
    }

    this.isPlaying = true;
    const chunk = this.audioQueue.shift();
    
    if (!chunk) {
      this.playNext();
      return;
    }

    try {
      const audioBuffer = this.audioContext.createBuffer(1, chunk.data.length, this.audioContext.sampleRate);
      audioBuffer.getChannelData(0).set(chunk.data);
      
      const source = this.audioContext.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(this.audioContext.destination);
      
      source.onended = () => {
        this.playNext();
      };
      
      source.start();
    } catch (error) {
      console.error("Error playing audio:", error);
      this.playNext();
    }
  }
}

interface AudioChunk {
  data: Float32Array;
}
