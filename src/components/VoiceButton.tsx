
import React, { useCallback, useState } from 'react';
import { cn } from '@/lib/utils';
import { WebSocketManager } from '@/utils/WebSocketManager';
import { useToast } from '@/hooks/use-toast';
import { Mic, MicOff, Speaker } from 'lucide-react';

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

  const handleClick = useCallback(async () => {
    // Reset error message on new interaction
    setErrorMessage(null);

    try {
      const wsManager = WebSocketManager.getInstance();
      
      if (!wsManager.isConnected()) {
        await wsManager.connect();
      }

      // If the assistant is speaking, interrupt it
      if (isSpeaking) {
        wsManager.interruptSpeaking();
        // Move straight to recording mode
        onSpeakingChange(false);
        await wsManager.startRecording(onSpeakingChange);
        onRecordingChange(true);
        toast({
          title: "I'm listening now",
          description: "What would you like to ask?",
        });
        return;
      }

      // Handle recording state toggle
      if (!isRecording) {
        await wsManager.startRecording(onSpeakingChange);
        onRecordingChange(true);
        toast({
          title: "Listening...",
          description: "Speak into your microphone",
        });
      } else {
        // Manual stop - this will trigger response generation with captured audio
        wsManager.manualStop();
        onRecordingChange(false);
        toast({
          title: "Processing...",
          description: "Getting your response ready",
        });
      }
    } catch (error) {
      console.error("Error:", error);
      setErrorMessage("Connection lost. Tap to reconnect.");
      onRecordingChange(false);
      toast({
        title: "Error",
        description: "Could not access microphone. Please make sure it's connected and allowed.",
        variant: "destructive",
      });
    }
  }, [isRecording, isSpeaking, toast, onRecordingChange, onSpeakingChange]);

  return (
    <button
      onClick={handleClick}
      className={cn(
        "relative w-40 h-40 md:w-56 md:h-56 text-white text-2xl md:text-4xl",
        "font-baloo font-bold transition-all duration-300 shadow-lg",
        "flex flex-col items-center justify-center gap-2 p-0 overflow-hidden",
        "hover:scale-105 hover:shadow-[0_0_30px_rgba(107,102,255,0.3)] transition-all duration-300",
        "rounded-[45%_55%_52%_48%_/_48%_45%_55%_52%]",
        isRecording ? "bg-kinder-red animate-pulse" : 
        isSpeaking ? "bg-kinder-purple opacity-90 cursor-pointer" : // Make it clear it's clickable when speaking
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
            isSpeaking ? "animate-bounce-soft" : 
            isRecording ? "animate-pulse" : 
            "transition-transform hover:scale-105"
          )}
        />
        <div className={cn(
          "absolute top-4 right-4 p-2 rounded-full",
          isRecording || isSpeaking ? "bg-white/20" : "bg-white/10"
        )}>
          {isSpeaking ? (
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
      
      {/* Add hint text for when speaking */}
      {isSpeaking && (
        <div className="absolute -bottom-12 left-0 right-0 text-center text-sm text-white/70 animate-fade-in">
          Tap to interrupt
        </div>
      )}
    </button>
  );
};

export default VoiceButton;
