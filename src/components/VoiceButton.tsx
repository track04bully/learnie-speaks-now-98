
import React, { useState, useEffect, useRef } from 'react';
import { Mic, MicOff } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';

interface VoiceButtonProps {
  maxRecordingTime?: number;
  onRecordingComplete?: (blob: Blob) => void;
}

const VoiceButton: React.FC<VoiceButtonProps> = ({ 
  maxRecordingTime = 8000, 
  onRecordingComplete 
}) => {
  const [isRecording, setIsRecording] = useState(false);
  const [isReady, setIsReady] = useState(true);
  const [countdown, setCountdown] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<BlobPart[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    let countdownInterval: number;
    
    if (isRecording) {
      setCountdown(Math.floor(maxRecordingTime / 1000));
      countdownInterval = window.setInterval(() => {
        setCountdown(prev => (prev > 0 ? prev - 1 : 0));
      }, 1000);
    }

    return () => {
      if (countdownInterval) clearInterval(countdownInterval);
    };
  }, [isRecording, maxRecordingTime]);

  const startRecording = async () => {
    try {
      setIsReady(false);
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];
      
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };
      
      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        
        if (onRecordingComplete) {
          onRecordingComplete(audioBlob);
        }
        
        // Clean up
        if (streamRef.current) {
          streamRef.current.getTracks().forEach(track => track.stop());
          streamRef.current = null;
        }
        
        setIsRecording(false);
        setIsReady(true);
      };
      
      mediaRecorder.start();
      setIsRecording(true);
      
      // Automatically stop recording after maxRecordingTime
      setTimeout(() => {
        if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
          mediaRecorderRef.current.stop();
        }
      }, maxRecordingTime);
      
    } catch (error) {
      console.error('Error accessing microphone:', error);
      toast({
        title: "Microphone Error",
        description: "Please allow microphone access to talk to Learnie",
        variant: "destructive"
      });
      setIsReady(true);
    }
  };

  const handleClick = () => {
    if (!isRecording && isReady) {
      startRecording();
    }
  };

  return (
    <div className="relative">
      {isRecording && (
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="absolute w-full h-full rounded-full bg-learnie-blue opacity-20 animate-pulse-ring"></span>
          <span className="absolute w-full h-full rounded-full bg-learnie-purple opacity-10 animate-pulse-ring" style={{ animationDelay: '0.5s' }}></span>
        </div>
      )}
      
      <button
        onClick={handleClick}
        disabled={!isReady}
        className={cn(
          "relative w-40 h-40 md:w-56 md:h-56 rounded-full text-white text-2xl md:text-4xl",
          "font-baloo font-bold transition-all duration-300 shadow-lg",
          "flex flex-col items-center justify-center gap-2",
          isRecording 
            ? "bg-gradient-to-br from-learnie-pink to-learnie-purple animate-bounce-soft" 
            : "bg-gradient-to-br from-learnie-blue to-learnie-purple hover:from-learnie-purple hover:to-learnie-blue",
          !isReady && "opacity-70 cursor-not-allowed"
        )}
      >
        <div className={cn(
          "flex items-center justify-center",
          isRecording && "scale-110 transition-transform"
        )}>
          {isRecording ? (
            <Mic size={40} className="mr-2" />
          ) : (
            <Mic size={36} className="mr-2" />
          )}
          <span>{isRecording ? "Listening..." : "Ask Learnie!"}</span>
        </div>
        
        {isRecording && (
          <div className="text-base md:text-lg opacity-80">
            {countdown > 0 ? `${countdown}...` : "Processing..."}
          </div>
        )}
      </button>
    </div>
  );
};

export default VoiceButton;
