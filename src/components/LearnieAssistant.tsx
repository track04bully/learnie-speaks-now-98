
import React, { useState, useEffect } from 'react';
import VoiceButton from './VoiceButton';
import AudioWaves from './AudioWaves';
import { useToast } from '@/hooks/use-toast';
import { createClient } from '@supabase/supabase-js';

// Get environment variables
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Only create the client if both URL and key are available
let supabase: ReturnType<typeof createClient> | null = null;

if (supabaseUrl && supabaseAnonKey) {
  supabase = createClient(supabaseUrl, supabaseAnonKey);
}

const LearnieAssistant: React.FC = () => {
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [isSupabaseConfigured, setIsSupabaseConfigured] = useState(!!supabase);
  const { toast } = useToast();

  // Check Supabase configuration on component mount
  useEffect(() => {
    if (!isSupabaseConfigured) {
      toast({
        title: "Configuration Error",
        description: "Supabase URL and/or Anon Key are missing. Please check your environment variables.",
        variant: "destructive",
        duration: 5000,
      });
    }
  }, [isSupabaseConfigured, toast]);

  const handleRecordingComplete = async (blob: Blob) => {
    setAudioBlob(blob);
    setIsRecording(false);
    setIsProcessing(true);
    
    try {
      // Check if Supabase is configured before attempting to use it
      if (!supabase) {
        throw new Error("Supabase is not configured properly");
      }

      // Convert blob to base64
      const buffer = await blob.arrayBuffer();
      const base64Audio = Buffer.from(buffer).toString('base64');
      
      // Call Supabase Edge Function
      const { data, error } = await supabase.functions.invoke('process-audio', {
        body: { audioData: base64Audio }
      });

      if (error) throw error;

      toast({
        title: "Learnie's Response",
        description: data.message || "I understood what you said!",
        duration: 3000,
      });
      
    } catch (error) {
      console.error('Error processing audio:', error);
      toast({
        title: "Error",
        description: "Could not process your voice message",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleRecordingStart = () => {
    // Don't allow recording if Supabase isn't configured
    if (!isSupabaseConfigured) {
      toast({
        title: "Configuration Error",
        description: "Cannot record audio. Supabase is not configured properly.",
        variant: "destructive",
      });
      return;
    }
    
    setIsRecording(true);
    setAudioBlob(null);
  };

  return (
    <div className="flex flex-col items-center justify-center gap-2">      
      <div 
        className="relative p-4"
        onClick={() => !isRecording && handleRecordingStart()}
      >
        <VoiceButton 
          maxRecordingTime={8000} 
          onRecordingComplete={handleRecordingComplete} 
        />
      </div>
      
      <AudioWaves isActive={isRecording} />
      
      <p className="text-lg md:text-xl font-fredoka text-center max-w-md text-kinder-black">
        {isProcessing 
          ? "Learnie is thinking..." 
          : isRecording 
            ? "Learnie is listening! What would you like to know?" 
            : isSupabaseConfigured
              ? "Tap the button and ask Learnie anything!"
              : "Please configure Supabase to start using Learnie."}
      </p>
    </div>
  );
};

export default LearnieAssistant;
