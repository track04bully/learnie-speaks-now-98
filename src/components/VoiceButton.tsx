
import React, { useCallback, useState } from 'react';
import { cn } from '@/lib/utils';
import { WebSocketManager } from '@/utils/WebSocketManager';
import { useToast } from '@/components/ui/use-toast';

const VoiceButton: React.FC = () => {
  const [isRecording, setIsRecording] = useState(false);
  const { toast } = useToast();

  const handleClick = useCallback(async () => {
    try {
      const wsManager = WebSocketManager.getInstance();
      
      if (!wsManager.isConnected()) {
        await wsManager.connect();
      }

      if (!isRecording) {
        await wsManager.startRecording();
        setIsRecording(true);
        toast({
          title: "Recording started",
          description: "Speak into your microphone",
        });
      } else {
        wsManager.stopRecording();
        setIsRecording(false);
        toast({
          title: "Recording stopped",
        });
      }
    } catch (error) {
      console.error("Error:", error);
      toast({
        title: "Error",
        description: "Could not access microphone. Please make sure it's connected and allowed.",
        variant: "destructive",
      });
    }
  }, [isRecording, toast]);

  return (
    <button
      onClick={handleClick}
      className={cn(
        "relative w-40 h-40 md:w-56 md:h-56 text-white text-2xl md:text-4xl",
        "font-baloo font-bold transition-all duration-300 shadow-lg",
        "flex flex-col items-center justify-center gap-2 p-0 overflow-hidden",
        "hover:scale-105 hover:shadow-[0_0_30px_rgba(107,102,255,0.3)] transition-all duration-300",
        "rounded-[45%_55%_52%_48%_/_48%_45%_55%_52%]",
        isRecording ? "bg-kinder-red" : "bg-kinder-purple hover:bg-kinder-red",
        "cursor-pointer"
      )}
    >
      <div className="flex items-center justify-center w-full h-full">
        <img 
          src="/lovable-uploads/95e3efc8-6cb7-4d38-8114-856ee02055c1.png"
          alt="Learnie character"
          className="w-32 h-32 md:w-40 md:h-40 object-contain"
        />
      </div>
    </button>
  );
};

export default VoiceButton;
