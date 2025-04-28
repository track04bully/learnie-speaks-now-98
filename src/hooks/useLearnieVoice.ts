import { useEffect, useRef, useState } from 'react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

// Define all possible phases
type Phase = 'idle' | 'connecting' | 'listen' | 'speak';

export const useLearnieVoice = () => {
  const { toast } = useToast();
  const [phase, setPhase] = useState<Phase>('idle');
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const socketRef = useRef<WebSocket | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const audioQueueRef = useRef<Float32Array[]>([]);

  const startConversation = async () => {
    try {
      if (phase !== 'idle') return;
      setPhase('connecting');

      // Get ephemeral token from our edge function
      const { data, error } = await supabase.functions.invoke('realtime-chat');
      
      if (error || !data?.client_secret?.value) {
        throw new Error(error?.message || 'Failed to get auth token');
      }

      // Connect to OpenAI's realtime API using WebSocket directly
      // (Note: We're using a direct WebSocket connection, not invoke)
      const SUPABASE_PROJECT_REF = "ceofrvinluwymyuizztv";
      socketRef.current = new WebSocket(`wss://${SUPABASE_PROJECT_REF}.functions.supabase.co/realtime-chat`);
      socketRef.current.binaryType = 'arraybuffer';

      // Set up audio context for recording
      audioContextRef.current = new AudioContext({
        sampleRate: 24000, // OpenAI requires 24kHz
      });

      // Set up connection event handlers
      socketRef.current.onopen = async () => {
        console.log("WebSocket connection opened");
        
        try {
          const stream = await navigator.mediaDevices.getUserMedia({
            audio: {
              sampleRate: 24000,
              channelCount: 1,
              echoCancellation: true,
              noiseSuppression: true,
              autoGainControl: true,
            }
          });

          const source = audioContextRef.current!.createMediaStreamSource(stream);
          const processor = audioContextRef.current!.createScriptProcessor(4096, 1, 1);
          
          source.connect(processor);
          processor.connect(audioContextRef.current!.destination);

          // Create a local reference to track current phase for closures
          let currentPhase: Phase = 'listen';
          setPhase('listen');

          processor.onaudioprocess = (e) => {
            // Use the current phase reference instead of the state variable directly
            if (currentPhase === 'listen' && socketRef.current?.readyState === WebSocket.OPEN) {
              const inputData = e.inputBuffer.getChannelData(0);
              const pcmData = new Float32Array(inputData);
              
              // Convert to base64 and send
              socketRef.current.send(JSON.stringify({
                type: 'input_audio_buffer.append',
                audio: encodeAudioData(pcmData)
              }));
            }
          };
          
          toast({
            title: "Connected",
            description: "Ready to chat with Learnie!",
          });
        } catch (error) {
          console.error('Error accessing microphone:', error);
          cleanup();
          toast({
            title: "Microphone Error",
            description: error instanceof Error ? error.message : 'Failed to access microphone',
            variant: "destructive",
          });
        }
      };

      // Handle incoming messages
      socketRef.current.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          console.log("WebSocket message received:", data.type);
          
          if (data.type === 'response.audio.delta') {
            setPhase('speak');
            const audioData = decodeAudioData(data.delta);
            playAudioData(audioData);
          } else if (data.type === 'response.audio.done') {
            setPhase('listen');
          }
        } catch (error) {
          console.error('Error processing message:', error);
        }
      };

      // Handle connection errors
      socketRef.current.onerror = (event) => {
        console.error("WebSocket error:", event);
        cleanup();
        toast({
          title: "Connection Error",
          description: "Error connecting to AI service",
          variant: "destructive",
        });
      };

      // Handle WebSocket closure
      socketRef.current.onclose = () => {
        console.log("WebSocket connection closed");
        cleanup();
      };
      
    } catch (error) {
      console.error('Error starting conversation:', error);
      cleanup();
      toast({
        title: "Connection Error",
        description: error instanceof Error ? error.message : 'Failed to start conversation',
        variant: "destructive",
      });
    }
  };

  const cleanup = () => {
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
    
    if (socketRef.current) {
      if (socketRef.current.readyState === WebSocket.OPEN) {
        socketRef.current.close();
      }
      socketRef.current = null;
    }

    setPhase('idle');
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cleanup();
    };
  }, []);

  return {
    phase,
    startConversation,
    isConnected: phase !== 'idle',
  };
};

// Helper function to encode Float32Array to base64 string
const encodeAudioData = (float32Array: Float32Array): string => {
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
};

// Helper function to decode base64 to Float32Array
const decodeAudioData = (base64: string): Float32Array => {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  
  const int16 = new Int16Array(bytes.buffer);
  const float32 = new Float32Array(int16.length);
  for (let i = 0; i < int16.length; i++) {
    float32[i] = int16[i] / 0x8000;
  }
  
  return float32;
};

// Helper function to play audio data
const playAudioData = async (audioData: Float32Array) => {
  const audioContext = new AudioContext({ sampleRate: 24000 });
  const buffer = audioContext.createBuffer(1, audioData.length, 24000);
  buffer.getChannelData(0).set(audioData);
  
  const source = audioContext.createBufferSource();
  source.buffer = buffer;
  source.connect(audioContext.destination);
  source.start();
  
  return new Promise<void>((resolve) => {
    source.onended = () => {
      audioContext.close();
      resolve();
    };
  });
};
