
import React, { useState, useEffect } from 'react';
import VoiceButton from './VoiceButton';
import AudioWaves from './AudioWaves';
import { WebSocketManager } from '@/utils/WebSocketManager';
import { useToast } from '@/hooks/use-toast';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Mic } from 'lucide-react';

const LearnieAssistant: React.FC = () => {
  const [isRecording, setIsRecording] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [showPermissionDialog, setShowPermissionDialog] = useState(false);
  const { toast } = useToast();
  
  // Check for microphone permission on component mount
  useEffect(() => {
    const checkMicPermission = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        stream.getTracks().forEach(track => track.stop());
      } catch (error) {
        console.log("Microphone not yet granted:", error);
        setShowPermissionDialog(true);
      }
    };
    
    checkMicPermission();
    
    // Cleanup websocket on unmount
    return () => {
      const wsManager = WebSocketManager.getInstance();
      if (wsManager.isConnected()) {
        wsManager.disconnect();
      }
      setIsRecording(false);
      setIsSpeaking(false);
    };
  }, []);

  const handlePermissionRequest = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach(track => track.stop());
      setShowPermissionDialog(false);
      toast({
        title: "Perfect!",
        description: "Now you can talk with Learnie!",
      });
    } catch (error) {
      toast({
        title: "I need to hear you",
        description: "Please allow your microphone so we can talk!",
        variant: "destructive",
      });
    }
  };

  const getStatusText = () => {
    if (isRecording) return "I'm listening to you!";
    if (isSpeaking) return "I'm talking!";
    return "Tap the button and let's talk!";
  };

  return (
    <div className="flex flex-col items-center justify-center gap-4">      
      <div className="relative p-4">
        <VoiceButton 
          isRecording={isRecording} 
          isSpeaking={isSpeaking}
          onSpeakingChange={setIsSpeaking}
          onRecordingChange={setIsRecording}
        />
      </div>
      
      <AudioWaves 
        isActive={isRecording || isSpeaking} 
      />
      
      <p className="text-lg md:text-xl font-fredoka text-center max-w-md text-kinder-black animate-fade-in">
        {getStatusText()}
      </p>

      <Dialog open={showPermissionDialog} onOpenChange={setShowPermissionDialog}>
        <DialogContent className="bg-[#F8F7FF] border-kinder-purple border-2 rounded-3xl p-6">
          <DialogTitle className="text-2xl font-fredoka text-center text-kinder-purple">
            Let's talk with Learnie!
          </DialogTitle>
          <div className="flex justify-center my-4">
            <img 
              src="/lovable-uploads/95e3efc8-6cb7-4d38-8114-856ee02055c1.png"
              alt="Learnie character"
              className="w-32 h-32 object-contain"
            />
          </div>
          <DialogDescription className="text-center text-lg font-baloo">
            Learnie needs to hear your voice to chat with you. 
            Can we use your microphone?
          </DialogDescription>
          <div className="flex justify-center mt-4">
            <Button 
              onClick={handlePermissionRequest}
              className="bg-kinder-purple hover:bg-kinder-red text-white font-fredoka text-lg px-6 py-2 rounded-full"
            >
              <Mic className="mr-2 h-5 w-5" />
              Yes, let's talk!
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default LearnieAssistant;
