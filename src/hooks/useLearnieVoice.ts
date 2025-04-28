
import { useCallback, useState } from 'react';
import { WebSocketManager } from '@/utils/WebSocketManager';
import { useToast } from '@/hooks/use-toast';

export const useLearnieVoice = () => {
  const [isConnecting, setIsConnecting] = useState(false);
  const { toast } = useToast();

  const handleStartVoice = useCallback(async (
    onSpeakingChange: (isSpeaking: boolean) => void,
    onRecordingChange: (isRecording: boolean) => void,
    isSpeaking: boolean,
    isRecording: boolean,
  ) => {
    try {
      const wsManager = WebSocketManager.getInstance();
      
      // If Learnie is speaking, interrupt and start recording
      if (isSpeaking) {
        wsManager.interruptSpeaking();
        setTimeout(async () => {
          if (!wsManager.isConnected()) {
            await wsManager.connect();
          }
          await wsManager.startRecording(onSpeakingChange);
          onRecordingChange(true);
        }, 100);
        return;
      }
      
      // If already recording, stop
      if (isRecording) {
        wsManager.disconnect();
        onRecordingChange(false);
        onSpeakingChange(false);
        return;
      }

      // Start new recording
      if (!wsManager.isConnected()) {
        setIsConnecting(true);
        toast({
          title: "Hi there!",
          description: "Learnie is getting ready to listen",
        });
        
        try {
          await wsManager.connect();
          setIsConnecting(false);
        } catch (error) {
          setIsConnecting(false);
          toast({
            title: "Oops!",
            description: "Let's try that again!",
            variant: "destructive",
          });
          return;
        }
      }

      await wsManager.startRecording(onSpeakingChange, (error) => {
        toast({
          title: "Oops!",
          description: "Let's try that again!",
          variant: "destructive",
        });
      });
      onRecordingChange(true);
      
    } catch (error) {
      console.error("Error:", error);
      toast({
        title: "Oops!",
        description: "Let's try that again!",
        variant: "destructive",
      });
    }
  }, [toast]);

  return {
    isConnecting,
    handleStartVoice,
  };
};
