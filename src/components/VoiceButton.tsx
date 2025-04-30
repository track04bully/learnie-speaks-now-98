import React, { useCallback, useState, useEffect } from 'react';
import { WebSocketManager } from '@/utils/WebSocketManager';
import { AudioManager } from '@/utils/AudioManager';
import { useToast } from '@/hooks/use-toast';
import RecordButton from './buttons/RecordButton';
import StatusMessage from './status/StatusMessage';

interface VoiceButtonProps {
  isRecording: boolean;
  isSpeaking: boolean;
  onSpeakingChange: (isSpeaking: boolean) => void;
  onRecordingChange: (isRecording: boolean) => void;
}

const VoiceButton: React.FC<VoiceButtonProps> = ({
  isRecording,
  isSpeaking,
  onSpeakingChange,
  onRecordingChange
}) => {
  const { toast } = useToast();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [connectionError, setConnectionError] = useState(false);
  const [audioManager, setAudioManager] = useState<AudioManager | null>(null);

  // Initialize AudioManager on component mount
  useEffect(() => {
    const manager = new AudioManager();
    setAudioManager(manager);
    
    return () => {
      // Clean up on unmount
      manager.disconnect();
    };
  }, []);

  const handleError = useCallback((message: string) => {
    setErrorMessage(message);
    onRecordingChange(false);
    setIsConnecting(false);
    setConnectionError(true);
    toast({
      title: "Oops! Something went wrong",
      description: message || "Let's try again!",
      variant: "destructive",
    });
  }, [toast, onRecordingChange]);

  const handleClick = useCallback(async () => {
    if (!audioManager) return;
    
    // Reset error states on new interaction
    setErrorMessage(null);
    setConnectionError(false);

    try {
      const wsManager = WebSocketManager.getInstance();
      
      // If speaking, stop and start recording immediately
      if (isSpeaking) {
        wsManager.interruptSpeaking();
        onSpeakingChange(false);
        setIsConnecting(true);
        
        try {
          await audioManager.startRecording();
          setIsConnecting(false);
          onRecordingChange(true);
        } catch (error) {
          setIsConnecting(false);
          handleError(error.message || "Couldn't start recording. Let's try again!");
          return;
        }
        return;
      }

      // If recording, stop recording
      if (isRecording) {
        audioManager.stopRecording();
        onRecordingChange(false);
        return;
      }

      // Start new recording
      if (!wsManager.isConnected()) {
        setIsConnecting(true);
        toast({
          title: "Hi there!",
          description: "Learnie is getting ready to talk with you",
        });
        
        try {
          await wsManager.connect();
          setIsConnecting(false);
        } catch (error) {
          setIsConnecting(false);
          handleError(error.message || "Connection failed. Please try again.");
          return;
        }
      }

      setIsConnecting(true);
      try {
        await audioManager.startRecording();
        onRecordingChange(true);
        setIsConnecting(false);
      } catch (error) {
        setIsConnecting(false);
        handleError(error.message || "Couldn't start recording. Please try again.");
      }
      
    } catch (error) {
      console.error("Error:", error);
      handleError(error.message || "Something went wrong. Please try again.");
    }
  }, [isRecording, isSpeaking, toast, onRecordingChange, onSpeakingChange, handleError, audioManager]);

  return (
    <div className="relative">
      <RecordButton
        isRecording={isRecording}
        isSpeaking={isSpeaking}
        isConnecting={isConnecting}
        connectionError={connectionError}
        onClick={handleClick}
        disabled={isConnecting || !audioManager}
      />
      
      <StatusMessage
        errorMessage={errorMessage}
        isConnecting={isConnecting}
        isRecording={isRecording}
        isSpeaking={isSpeaking}
        connectionError={connectionError}
      />
    </div>
  );
};

export default VoiceButton;
