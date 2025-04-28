
import React, { useState, useEffect, useRef } from 'react';
import VoiceButton from './VoiceButton';
import AudioWaves from './AudioWaves';
import { useToast } from '@/hooks/use-toast';
import { createClient } from '@supabase/supabase-js';
import { AudioRecorder, encodeAudioForAPI } from '@/utils/RealtimeAudio';

// Fix the Supabase URL by ensuring it has the proper format with https://
const supabaseUrl = 'https://ceofrvinluwymyuizztv.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNlb2ZydmlubHV3eW15dWl6enR2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDU4MjAxMzQsImV4cCI6MjA2MTM5NjEzNH0.XjtcGkSeRUyFFQhnFgduCnqUcz_pM0j7W6d-tDG-7lY';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

const LearnieAssistant: React.FC = () => {
  const [isRecording, setIsRecording] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const webSocketRef = useRef<WebSocket | null>(null);
  const recorderRef = useRef<AudioRecorder | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    audioContextRef.current = new AudioContext({
      sampleRate: 24000,
    });
    return () => {
      audioContextRef.current?.close();
    };
  }, []);

  const playAudioChunk = async (base64Audio: string) => {
    if (!audioContextRef.current) return;
    
    const binaryString = atob(base64Audio);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    
    try {
      const audioBuffer = await audioContextRef.current.decodeAudioData(bytes.buffer);
      const source = audioContextRef.current.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(audioContextRef.current.destination);
      source.start(0);
      setIsSpeaking(true);
      source.onended = () => setIsSpeaking(false);
    } catch (error) {
      console.error('Error playing audio chunk:', error);
    }
  };

  const connectToWebSocket = async () => {
    try {
      setIsConnecting(true);
      const wsUrl = `wss://ceofrvinluwymyuizztv.functions.supabase.co/realtime-chat`;
      const ws = new WebSocket(wsUrl);
      
      ws.onopen = () => {
        console.log('WebSocket connected');
        setIsConnecting(false);
        webSocketRef.current = ws;

        // Send initial session configuration
        ws.send(JSON.stringify({
          event_id: "event_123",
          type: "session.update",
          session: {
            modalities: ["text", "audio"],
            instructions: "You are Learnie, a friendly and knowledgeable AI assistant. Your voice is warm and approachable. Keep your responses concise and helpful.",
            voice: "alloy",
            input_audio_format: "pcm16",
            output_audio_format: "pcm16",
            input_audio_transcription: {
              model: "whisper-1"
            },
            turn_detection: {
              type: "server_vad",
              threshold: 0.5,
              prefix_padding_ms: 300,
              silence_duration_ms: 1000
            },
            temperature: 0.8,
            max_response_output_tokens: "inf"
          }
        }));
      };

      ws.onclose = () => {
        console.log('WebSocket closed');
        setIsConnecting(false);
        setIsRecording(false);
        webSocketRef.current = null;
      };

      ws.onerror = (error) => {
        console.error('WebSocket error:', error);
        toast({
          title: "Connection Error",
          description: "Failed to connect to the voice service",
          variant: "destructive",
        });
        setIsConnecting(false);
        setIsRecording(false);
      };

      ws.onmessage = (event) => {
        const data = JSON.parse(event.data);
        console.log('Received message:', data);
        
        if (data.type === 'response.audio_transcript.delta') {
          console.log('Transcript:', data.delta);
        } else if (data.type === 'response.audio.delta') {
          playAudioChunk(data.delta);
        } else if (data.type === 'response.audio.done') {
          setIsSpeaking(false);
        }
      };

    } catch (error) {
      console.error('Error connecting to WebSocket:', error);
      toast({
        title: "Connection Error",
        description: "Failed to connect to the voice service",
        variant: "destructive",
      });
      setIsConnecting(false);
    }
  };

  const startRecording = async () => {
    try {
      if (!webSocketRef.current) {
        await connectToWebSocket();
      }

      recorderRef.current = new AudioRecorder((audioData) => {
        if (webSocketRef.current?.readyState === WebSocket.OPEN) {
          webSocketRef.current.send(JSON.stringify({
            type: 'input_audio_buffer.append',
            audio: encodeAudioForAPI(audioData)
          }));
        }
      });

      await recorderRef.current.start();
      setIsRecording(true);
    } catch (error) {
      console.error('Error starting recording:', error);
      toast({
        title: "Recording Error",
        description: "Could not start recording",
        variant: "destructive",
      });
    }
  };

  const stopRecording = () => {
    if (recorderRef.current) {
      recorderRef.current.stop();
      recorderRef.current = null;
    }
    setIsRecording(false);
  };

  useEffect(() => {
    return () => {
      if (webSocketRef.current) {
        webSocketRef.current.close();
      }
      if (recorderRef.current) {
        recorderRef.current.stop();
      }
    };
  }, []);

  return (
    <div className="flex flex-col items-center justify-center gap-2">      
      <div 
        className="relative p-4"
        onClick={() => !isRecording && !isConnecting && startRecording()}
      >
        <VoiceButton 
          isRecording={isRecording}
          onStopRecording={stopRecording}
        />
      </div>
      
      <AudioWaves isActive={isRecording || isSpeaking} />
      
      <p className="text-lg md:text-xl font-fredoka text-center max-w-md text-kinder-black">
        {isConnecting 
          ? "Connecting..." 
          : isProcessing 
            ? "Learnie is thinking..." 
            : isRecording 
              ? "Learnie is listening! What would you like to know?" 
              : isSpeaking
                ? "Learnie is speaking..."
                : "Tap the button and ask Learnie anything!"}
      </p>
    </div>
  );
};

export default LearnieAssistant;
