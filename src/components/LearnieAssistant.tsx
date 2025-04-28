
import React, { useState, useEffect } from 'react';
import VoiceButton from './VoiceButton';
import AudioWaves from './AudioWaves';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useTTSStream } from '@/hooks/use-tts-stream';
import { Button } from './ui/button';

const LearnieAssistant: React.FC = () => {
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [micPermission, setMicPermission] = useState<boolean | null>(null);
  const { toast } = useToast();
  const { playStreamingTTS } = useTTSStream();

  // Check microphone permission on component mount
  useEffect(() => {
    checkMicrophonePermission();
  }, []);

  const checkMicrophonePermission = async () => {
    try {
      // Just check if we can access the microphone
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      setMicPermission(true);
      
      // Release the stream immediately as we're just checking permission
      stream.getTracks().forEach(track => track.stop());
    } catch (error) {
      console.error('Microphone permission check failed:', error);
      setMicPermission(false);
    }
  };

  const requestMicrophoneAccess = async () => {
    try {
      await navigator.mediaDevices.getUserMedia({ audio: true });
      setMicPermission(true);
      toast({
        title: "Microphone Access Granted",
        description: "You can now talk to Learnie!",
      });
    } catch (error) {
      console.error('Failed to get microphone permission:', error);
      toast({
        title: "Microphone Access Denied",
        description: "Please allow microphone access in your browser settings",
        variant: "destructive",
      });
    }
  };

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

      {micPermission === false && (
        <div className="mt-4">
          <Button 
            variant="destructive" 
            className="bg-kinder-red hover:bg-kinder-red/90"
            onClick={requestMicrophoneAccess}
          >
            Allow Microphone Access
          </Button>
          <p className="text-sm text-gray-500 mt-2 text-center">
            Learnie needs microphone access to hear you
          </p>
        </div>
      )}
    </div>
  );
};

export default LearnieAssistant;
