
import React, { useState, useRef, useEffect } from 'react';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

interface VoiceButtonProps {
  onRecordingComplete?: (blob: Blob) => void;
  disabled?: boolean;
}

const VoiceButton: React.FC<VoiceButtonProps> = ({ 
  onRecordingComplete,
  disabled = false
}) => {
  const [isRecording, setIsRecording] = useState(false);
  const [isReady, setIsReady] = useState(true);
  const [hasMicPermission, setHasMicPermission] = useState<boolean | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<BlobPart[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const silenceTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const { toast } = useToast();

  // Check for microphone permission on component mount
  useEffect(() => {
    checkMicrophonePermission();
  }, []);

  const checkMicrophonePermission = async () => {
    try {
      // Just check if we can access the microphone
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      setHasMicPermission(true);
      
      // Release the stream immediately as we're just checking permission
      stream.getTracks().forEach(track => track.stop());
    } catch (error) {
      console.error('Microphone permission check failed:', error);
      setHasMicPermission(false);
    }
  };

  const resetSilenceDetection = () => {
    if (silenceTimeoutRef.current) {
      clearTimeout(silenceTimeoutRef.current);
    }
    silenceTimeoutRef.current = setTimeout(() => {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
        console.log('Silence detected, stopping recording');
        mediaRecorderRef.current.stop();
      }
    }, 2000); // 2 seconds of silence
  };

  const setupVoiceActivityDetection = (stream: MediaStream) => {
    const audioContext = new AudioContext();
    audioContextRef.current = audioContext;
    const analyzer = audioContext.createAnalyser();
    const microphone = audioContext.createMediaStreamSource(stream);
    microphone.connect(analyzer);
    
    analyzer.fftSize = 256;
    const bufferLength = analyzer.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    
    const checkAudioLevel = () => {
      if (!isRecording) return;
      
      analyzer.getByteFrequencyData(dataArray);
      const average = dataArray.reduce((a, b) => a + b) / bufferLength;
      
      if (average > 10) { // Adjust this threshold as needed
        resetSilenceDetection();
      }
      
      requestAnimationFrame(checkAudioLevel);
    };
    
    checkAudioLevel();
  };

  const requestMicrophonePermission = async () => {
    try {
      await navigator.mediaDevices.getUserMedia({ audio: true });
      setHasMicPermission(true);
      return true;
    } catch (error) {
      console.error('Error requesting microphone permission:', error);
      toast({
        title: "Microphone Access Required",
        description: "Please allow microphone access to talk to Learnie",
        variant: "destructive"
      });
      setHasMicPermission(false);
      return false;
    }
  };

  const startRecording = async () => {
    try {
      setIsReady(false);
      
      // If we haven't checked permission or don't have it, request it
      if (!hasMicPermission) {
        const hasPermission = await requestMicrophonePermission();
        if (!hasPermission) {
          setIsReady(true);
          return;
        }
      }
      
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          sampleRate: 24000,
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        } 
      });
      streamRef.current = stream;
      
      setupVoiceActivityDetection(stream);
      
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
        if (audioContextRef.current) {
          audioContextRef.current.close();
          audioContextRef.current = null;
        }
        if (silenceTimeoutRef.current) {
          clearTimeout(silenceTimeoutRef.current);
          silenceTimeoutRef.current = null;
        }
        
        setIsRecording(false);
        setIsReady(true);
      };
      
      mediaRecorder.start(100); // Collect data every 100ms
      setIsRecording(true);
      resetSilenceDetection();
      
    } catch (error) {
      console.error('Error accessing microphone:', error);
      toast({
        title: "Microphone Error",
        description: "Please allow microphone access to talk to Learnie",
        variant: "destructive"
      });
      setIsReady(true);
      setHasMicPermission(false);
    }
  };

  const handleClick = () => {
    if (!isRecording && isReady && !disabled) {
      startRecording();
    }
  };

  return (
    <div className="relative">
      {/* Background sparkles */}
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

      {isRecording && (
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="absolute w-full h-full rounded-[42%_58%_48%_52%_/_48%_42%_58%_52%] bg-kinder-purple/20 animate-pulse-ring"></span>
          <span className="absolute w-full h-full rounded-[52%_48%_42%_58%_/_52%_48%_42%_58%] bg-kinder-pink/10 animate-pulse-ring" style={{ animationDelay: '500ms' }}></span>
        </div>
      )}
      
      <button
        onClick={handleClick}
        disabled={!isReady || disabled}
        className={cn(
          "relative w-40 h-40 md:w-56 md:h-56 text-white text-2xl md:text-4xl",
          "font-baloo font-bold transition-all duration-300 shadow-lg",
          "flex flex-col items-center justify-center gap-2 p-0 overflow-hidden",
          "hover:scale-105 hover:shadow-[0_0_30px_rgba(107,102,255,0.3)] transition-all duration-300",
          "rounded-[45%_55%_52%_48%_/_48%_45%_55%_52%]",
          isRecording 
            ? "bg-kinder-pink animate-bounce-soft" 
            : "bg-kinder-purple hover:bg-kinder-red",
          (!isReady || disabled) && "opacity-70 cursor-not-allowed",
          !hasMicPermission && "bg-kinder-red"
        )}
      >
        <div className={cn(
          "flex items-center justify-center w-full h-full",
          isRecording && "scale-110 transition-transform"
        )}>
          <img 
            src="/lovable-uploads/95e3efc8-6cb7-4d38-8114-856ee02055c1.png"
            alt="Learnie character"
            className="w-32 h-32 md:w-40 md:h-40 object-contain"
          />
        </div>
        
        {hasMicPermission === false && (
          <div className="absolute top-0 right-0 bg-kinder-red text-white p-1 rounded-full">
            <span className="text-xs font-bold">🎤❌</span>
          </div>
        )}
      </button>
    </div>
  );
};

export default VoiceButton;
