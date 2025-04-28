
import React, { useState } from 'react';
import VoiceButton from './VoiceButton';
import AudioWaves from './AudioWaves';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useTTSStream } from '@/hooks/use-tts-stream';

const LearnieAssistant: React.FC = () => {
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const { toast } = useToast();
  const { playStreamingTTS } = useTTSStream();

  const handleRecordingComplete = async (blob: Blob) => {
    setIsRecording(false);
    setIsProcessing(true);
    
    try {
      // Convert blob to base64
      const buffer = await blob.arrayBuffer();
      const base64Audio = Buffer.from(buffer).toString('base64');
      
      // Call Supabase Edge Function
      const { data, error } = await supabase.functions.invoke('process-audio', {
        body: { audioData: base64Audio }
      });

      if (error) throw error;

      // Play the response using TTS
      setIsSpeaking(true);
      await playStreamingTTS(data.message);
      
    } catch (error) {
      console.error('Error processing audio:', error);
      toast({
        title: "Error",
        description: "Could not process your voice message. Please try again later.",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
      setIsSpeaking(false);
    }
  };

  const handleRecordingStart = () => {
    setIsRecording(true);
  };

  return (
    <div className="flex flex-col items-center justify-center gap-2">      
      <div 
        className="relative p-4"
        onClick={() => !isRecording && !isProcessing && !isSpeaking && handleRecordingStart()}
      >
        <VoiceButton 
          onRecordingComplete={handleRecordingComplete} 
          disabled={isProcessing || isSpeaking}
        />
      </div>
      
      <AudioWaves isActive={isRecording} />
      
      <p className="text-lg md:text-xl font-fredoka text-center max-w-md text-kinder-black">
        {isProcessing 
          ? "Learnie is thinking..." 
          : isSpeaking
            ? "Learnie is speaking..."
            : isRecording 
              ? "Learnie is listening! What would you like to know?" 
              : "Tap the button and ask Learnie anything!"}
      </p>
    </div>
  );
};

export default LearnieAssistant;
