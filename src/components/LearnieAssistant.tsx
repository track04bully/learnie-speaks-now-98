
import React, { useState } from 'react';
import VoiceButton from './VoiceButton';
import AudioWaves from './AudioWaves';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

const LearnieAssistant: React.FC = () => {
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const { toast } = useToast();

  const handleRecordingComplete = async (blob: Blob) => {
    setAudioBlob(blob);
    setIsRecording(false);
    setIsProcessing(true);
    
    try {
      console.log("Processing audio recording...");
      
      // Convert blob to base64
      const buffer = await blob.arrayBuffer();
      const base64Audio = Buffer.from(buffer).toString('base64');
      
      console.log("Audio converted to base64, calling Supabase function...");
      
      // Call Supabase Edge Function
      const { data, error } = await supabase.functions.invoke('process-audio', {
        body: { audioData: base64Audio }
      });

      if (error) {
        console.error('Supabase function error:', error);
        throw error;
      }

      console.log("Function response:", data);

      toast({
        title: "Learnie's Response",
        description: data.message || "I understood what you said!",
        duration: 3000,
      });
      
    } catch (error) {
      console.error('Error processing audio:', error);
      toast({
        title: "Error",
        description: "Could not process your voice message. Please try again later.",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleRecordingStart = () => {
    setIsRecording(true);
    setAudioBlob(null);
  };

  return (
    <div className="flex flex-col items-center justify-center gap-2">      
      <div 
        className="relative p-4"
        onClick={() => !isRecording && !isProcessing && handleRecordingStart()}
      >
        <VoiceButton 
          maxRecordingTime={8000} 
          onRecordingComplete={handleRecordingComplete} 
          disabled={isProcessing}
        />
      </div>
      
      <AudioWaves isActive={isRecording} />
      
      <p className="text-lg md:text-xl font-fredoka text-center max-w-md text-kinder-black">
        {isProcessing 
          ? "Learnie is thinking..." 
          : isRecording 
            ? "Learnie is listening! What would you like to know?" 
            : "Tap the button and ask Learnie anything!"}
      </p>
    </div>
  );
};

export default LearnieAssistant;
