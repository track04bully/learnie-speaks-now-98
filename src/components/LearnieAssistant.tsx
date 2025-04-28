
import React, { useState, useEffect, useRef } from 'react';
import VoiceButton from './VoiceButton';
import AudioWaves from './AudioWaves';
import { useToast } from '@/hooks/use-toast';
import { createClient } from '@supabase/supabase-js';
import { AudioRecorder, encodeAudioForAPI } from '@/utils/RealtimeAudio';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

const LearnieAssistant: React.FC = () => {
  const [isRecording, setIsRecording] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const webSocketRef = useRef<WebSocket | null>(null);
  const recorderRef = useRef<AudioRecorder | null>(null);
  const { toast } = useToast();

  const connectToWebSocket = async () => {
    try {
      setIsConnecting(true);
      const ws = new WebSocket(`wss://${supabaseUrl.split('//')[1]}/functions/v1/realtime-chat`);
      
      ws.onopen = () => {
        console.log('WebSocket connected');
        setIsConnecting(false);
        webSocketRef.current = ws;
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
          // Handle transcription updates
          console.log('Transcript:', data.delta);
        } else if (data.type === 'response.audio.delta') {
          // Handle audio playback
          const audioData = atob(data.delta);
          // Audio playback logic here
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
      
      <AudioWaves isActive={isRecording} />
      
      <p className="text-lg md:text-xl font-fredoka text-center max-w-md text-kinder-black">
        {isConnecting 
          ? "Connecting..." 
          : isProcessing 
            ? "Learnie is thinking..." 
            : isRecording 
              ? "Learnie is listening! What would you like to know?" 
              : "Tap the button and ask Learnie anything!"}
      </p>
    </div>
  );
};

export default LearnieAssistant;
