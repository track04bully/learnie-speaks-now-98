
import React, { useState, useEffect, useRef } from 'react';
import AudioWaves from './AudioWaves';
import { useToast } from '@/hooks/use-toast';
import { RealtimeChat } from '@/utils/RealtimeAudio';
import { Button } from './ui/button';
import { Mic, MicOff, Loader2 } from 'lucide-react';

const LearnieAssistant: React.FC = () => {
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [micPermission, setMicPermission] = useState<boolean | null>(null);
  const [transcript, setTranscript] = useState<string>("");
  const [lastError, setLastError] = useState<string | null>(null);
  const realtimeChatRef = useRef<RealtimeChat | null>(null);
  const { toast } = useToast();

  // Check microphone permission on component mount
  useEffect(() => {
    checkMicrophonePermission();
    
    // Initialize RealtimeChat
    realtimeChatRef.current = new RealtimeChat(
      // Connection status handler
      (connected) => {
        setIsConnected(connected);
        setIsConnecting(false);
        if (connected) {
          setLastError(null);
        }
      },
      // Transcript handler
      (text) => {
        setTranscript((prev) => prev + text);
      },
      // Speaking status handler
      (speaking) => {
        setIsSpeaking(speaking);
        if (!speaking) {
          // Clear transcript when AI stops speaking
          setTimeout(() => setTranscript(""), 2000);
        }
      }
    );
    
    // Cleanup on unmount
    return () => {
      if (realtimeChatRef.current) {
        realtimeChatRef.current.disconnect();
      }
    };
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

  const startConversation = async () => {
    if (!micPermission) {
      await requestMicrophoneAccess();
      if (!micPermission) return;
    }
    
    try {
      setIsConnecting(true);
      setLastError(null);
      
      if (realtimeChatRef.current) {
        await realtimeChatRef.current.connect();
      }
    } catch (error: any) {
      console.error('Error starting conversation:', error);
      setLastError(error.message || "Connection failed");
      setIsConnecting(false);
      
      toast({
        title: "Connection Error",
        description: error.message || "Could not connect to the voice service",
        variant: "destructive",
      });
    }
  };

  const stopConversation = () => {
    if (realtimeChatRef.current) {
      realtimeChatRef.current.disconnect();
    }
    setIsConnected(false);
    setIsSpeaking(false);
  };

  return (
    <div className="flex flex-col items-center justify-center gap-2">      
      <div className="relative p-8">
        <Button
          onClick={isConnected ? stopConversation : startConversation}
          disabled={isConnecting || micPermission === false}
          className={`w-40 h-40 md:w-56 md:h-56 text-white text-2xl md:text-4xl
                    font-baloo font-bold transition-all duration-300 shadow-lg
                    flex flex-col items-center justify-center gap-2 p-0 overflow-hidden
                    hover:scale-105 hover:shadow-[0_0_30px_rgba(107,102,255,0.3)] transition-all duration-300
                    rounded-[45%_55%_52%_48%_/_48%_45%_55%_52%]
                    ${isConnected 
                      ? (isSpeaking ? "bg-kinder-pink animate-bounce-soft" : "bg-kinder-purple") 
                      : "bg-kinder-purple hover:bg-kinder-purple/90"}
                    ${(isConnecting || micPermission === false) && "opacity-70 cursor-not-allowed"}
                    ${micPermission === false && "bg-kinder-red"}`}
        >
          <div className="absolute inset-0 -z-10 overflow-hidden">
            {[...Array(6)].map((_, i) => (
              <div
                key={i}
                className="absolute w-2 h-2 rounded-full bg-kinder-yellow/20"
                style={{
                  left: `${Math.random() * 100}%`,
                  top: `${Math.random() * 100}%`,
                  animation: `sparkle ${2 + Math.random() * 2}s ease-in-out infinite`,
                  animationDelay: `${i * 0.3}s`
                }}
              />
            ))}
          </div>
          
          {isConnected && (
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="absolute w-full h-full rounded-[42%_58%_48%_52%_/_48%_42%_58%_52%] bg-kinder-purple/20 animate-pulse-ring"></span>
              <span className="absolute w-full h-full rounded-[52%_48%_42%_58%_/_52%_48%_42%_58%] bg-kinder-pink/10 animate-pulse-ring" style={{ animationDelay: '500ms' }}></span>
            </div>
          )}
          
          <div className={`flex items-center justify-center w-full h-full ${isConnected && "scale-110 transition-transform"}`}>
            <img 
              src="/lovable-uploads/95e3efc8-6cb7-4d38-8114-856ee02055c1.png"
              alt="Learnie character"
              className="w-32 h-32 md:w-40 md:h-40 object-contain"
            />
          </div>
          
          {isConnecting && (
            <div className="absolute bottom-4 flex items-center justify-center">
              <Loader2 className="w-6 h-6 text-white animate-spin" />
            </div>
          )}
          
          {!isConnecting && (
            <div className="absolute bottom-4 flex items-center justify-center">
              {isConnected ? (
                <Mic className="w-6 h-6 text-white" />
              ) : (
                <MicOff className="w-6 h-6 text-white" />
              )}
            </div>
          )}
        </Button>
      </div>
      
      <AudioWaves isActive={isConnected && !isSpeaking} />
      
      <p className="text-lg md:text-xl font-fredoka text-center max-w-md text-kinder-black">
        {isConnecting 
          ? "Connecting to Learnie..." 
          : isConnected
            ? isSpeaking
              ? "Learnie is speaking..."
              : "Learnie is listening! What would you like to know?"
            : "Tap the button to talk to Learnie!"}
      </p>

      {transcript && (
        <div className="mt-4 p-3 bg-white/80 rounded-lg shadow-sm max-w-md w-full">
          <p className="text-sm text-gray-700">
            {transcript}
          </p>
        </div>
      )}

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
