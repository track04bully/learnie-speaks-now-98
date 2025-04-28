
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
  const [lastError, setLastError] = useState<string | null>(null);
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
      setLastError(null);
      toast({
        title: "Microphone Access Granted",
        description: "You can now talk to Learnie!",
      });
    } catch (error) {
      console.error('Failed to get microphone permission:', error);
      setLastError("Microphone access denied");
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
      
      console.log('Sending audio data to Edge Function, length:', base64Audio.length);
      
      // Call Supabase Edge Function
      const { data, error } = await supabase.functions.invoke('process-audio', {
        body: { audioData: base64Audio }
      });

      if (error) {
        console.error('Supabase Function error:', error);
        throw new Error(error.message || 'Error processing audio');
      }

      if (!data || !data.message) {
        throw new Error('No response from speech processing service');
      }

      console.log('Received response:', data);
      
      // Play the response using TTS
      setIsSpeaking(true);
      setLastError(null);
      await playStreamingTTS(data.message);
      
    } catch (error: any) {
      console.error('Error processing audio:', error);
      setLastError(error.message || "Failed to process audio");
      toast({
        title: "Error",
        description: error.message || "Could not process your voice message. Please try again later.",
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
        onClick={() => !isRecording && !isProcessing && !isSpeaking && micPermission === true && handleRecordingStart()}
      >
        <VoiceButton 
          onRecordingComplete={handleRecordingComplete} 
          disabled={isProcessing || isSpeaking || micPermission !== true}
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

      {lastError && (
        <p className="text-sm text-red-500 text-center max-w-md mt-1">
          {lastError}
        </p>
      )}

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
