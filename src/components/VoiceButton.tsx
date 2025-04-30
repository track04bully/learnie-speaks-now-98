
import React, { useCallback, useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { WebSocketManager } from '@/utils/WebSocketManager';
import { AudioManager } from '@/utils/AudioManager';
import { useToast } from '@/hooks/use-toast';
import { Mic, MicOff, Speaker, WifiOff } from 'lucide-react';

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
    <button
      onClick={handleClick}
      disabled={isConnecting || !audioManager}
      aria-label={isConnecting ? "Connecting..." : isRecording ? "Stop talking" : isSpeaking ? "Interrupt Learnie" : "Start talking"}
      className={cn(
        "relative w-40 h-40 md:w-56 md:h-56 text-white text-2xl md:text-4xl",
        "font-baloo font-bold transition-all duration-300 shadow-lg",
        "flex flex-col items-center justify-center gap-2 p-0 overflow-hidden",
        "hover:scale-105 hover:shadow-[0_0_30px_rgba(107,102,255,0.3)] transition-all duration-300",
        "rounded-[45%_55%_52%_48%_/_48%_45%_55%_52%]",
        isConnecting ? "bg-gray-400 cursor-wait" :
        connectionError ? "bg-red-400 cursor-pointer" :
        isRecording ? "bg-kinder-red animate-pulse" : 
        isSpeaking ? "bg-kinder-purple opacity-90 cursor-pointer" :
        "bg-kinder-purple hover:bg-kinder-red",
        "cursor-pointer"
      )}
    >
      <div className="flex items-center justify-center w-full h-full relative">
        <img 
          src="/lovable-uploads/95e3efc8-6cb7-4d38-8114-856ee02055c1.png"
          alt="Learnie character"
          className={cn(
            "w-32 h-32 md:w-40 md:h-40 object-contain",
            isConnecting ? "" :
            connectionError ? "opacity-70" :
            isSpeaking ? "animate-bounce-soft" : 
            isRecording ? "animate-pulse" : 
            "transition-transform hover:scale-105"
          )}
        />
        <div className={cn(
          "absolute top-4 right-4 p-2 rounded-full",
          connectionError ? "bg-red-500" :
          isRecording || isSpeaking ? "bg-white/20" : "bg-white/10"
        )}>
          {isConnecting ? (
            <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
          ) : connectionError ? (
            <WifiOff className="w-6 h-6 text-white animate-pulse" />
          ) : isSpeaking ? (
            <Speaker className="w-6 h-6 text-white animate-pulse" />
          ) : isRecording ? (
            <Mic className="w-6 h-6 text-white animate-pulse" />
          ) : (
            <MicOff className="w-6 h-6 text-white/70" />
          )}
        </div>
      </div>
      {errorMessage && (
        <div className="absolute -bottom-12 left-0 right-0 text-center text-sm text-red-500 animate-fade-in">
          {errorMessage}
        </div>
      )}
      
      {/* Connection status */}
      {isConnecting && (
        <div className="absolute -bottom-12 left-0 right-0 text-center text-sm text-white/70 animate-fade-in">
          Connecting...
        </div>
      )}
      
      {/* Status labels */}
      <div className="absolute -bottom-12 left-0 right-0 text-center text-lg font-fredoka animate-fade-in">
        {isRecording ? (
          <span className="text-kinder-red">I'm listening!</span>
        ) : isSpeaking ? (
          <span className="text-kinder-purple">Tap to interrupt</span>
        ) : isConnecting ? (
          <span>Getting ready...</span>
        ) : connectionError ? (
          <span className="text-red-500">Tap to try again</span>
        ) : (
          <span>Tap to talk!</span>
        )}
      </div>
    </button>
  );
};

export default VoiceButton;
