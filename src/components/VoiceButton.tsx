
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
  const [isConnecting, setIsConnecting] = useState(false);

  const handleClick = useCallback(async () => {
    try {
      const wsManager = WebSocketManager.getInstance();
      
      // If Learnie is speaking, interpret tap as wanting to interrupt and start talking
      if (isSpeaking) {
        wsManager.interruptSpeaking(); // This will stop the current audio
        // Small delay to ensure audio has stopped before starting new recording
        setTimeout(async () => {
          if (!wsManager.isConnected()) {
            await wsManager.connect();
          }
          await wsManager.startRecording(onSpeakingChange);
          onRecordingChange(true);
        }, 100);
        return;
      }
      
      // If already recording, stop it
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
  }, [isRecording, isSpeaking, toast, onRecordingChange, onSpeakingChange]);

  return (
    <button
      onClick={handleClick}
      disabled={isConnecting}
      aria-label={isConnecting ? "Connecting..." : isRecording ? "Stop talking" : isSpeaking ? "Tap to talk" : "Start talking"}
      className={cn(
        "relative w-40 h-40 md:w-56 md:h-56 text-white text-2xl md:text-4xl",
        "font-baloo font-bold transition-all duration-300 shadow-lg",
        "flex flex-col items-center justify-center gap-2 p-0 overflow-hidden",
        "hover:scale-105 hover:shadow-[0_0_30px_rgba(107,102,255,0.3)] transition-all duration-300",
        "rounded-[45%_55%_52%_48%_/_48%_45%_55%_52%]",
        isConnecting ? "bg-gray-400 cursor-wait" :
        isRecording ? "bg-kinder-red animate-pulse" : 
        isSpeaking ? "bg-kinder-purple hover:bg-kinder-red cursor-pointer" : 
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
            isSpeaking ? "animate-bounce-soft" : 
            isRecording ? "animate-pulse" : 
            "transition-transform hover:scale-105"
          )}
        />
        <div className={cn(
          "absolute top-4 right-4 p-2 rounded-full",
          isRecording || isSpeaking ? "bg-white/20" : "bg-white/10"
        )}>
          {isConnecting ? (
            <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
          ) : isSpeaking ? (
            <Speaker className="w-6 h-6 text-white animate-pulse" />
          ) : isRecording ? (
            <Mic className="w-6 h-6 text-white animate-pulse" />
          ) : (
            <MicOff className="w-6 h-6 text-white/70" />
          )}
        </div>
      </div>
      
      {/* Connection status */}
      {isConnecting && (
        <div className="absolute -bottom-12 left-0 right-0 text-center text-sm text-white/70 animate-fade-in">
          Connecting...
        </div>
      )}
      
      {/* Status labels for children */}
      <div className="absolute -bottom-12 left-0 right-0 text-center text-lg font-fredoka animate-fade-in">
        {isRecording ? (
          <span className="text-kinder-red">I'm listening!</span>
        ) : isSpeaking ? (
          <span className="text-kinder-purple">Tap to talk!</span>
        ) : isConnecting ? (
          <span>Getting ready...</span>
        ) : (
          <span>Tap to talk!</span>
        )}
      </div>
    </button>
  );
};

export default VoiceButton;
