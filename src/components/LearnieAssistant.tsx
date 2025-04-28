
import React, { useState } from 'react';
import VoiceButton from './VoiceButton';
import AudioWaves from './AudioWaves';
import { useToast } from '@/hooks/use-toast';

const LearnieAssistant: React.FC = () => {
  const [isRecording, setIsRecording] = useState(false);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const { toast } = useToast();

  const handleRecordingComplete = (blob: Blob) => {
    setAudioBlob(blob);
    setIsRecording(false);
    
    // In a real app, you'd send this blob to your backend
    console.log("Recording complete, blob size:", blob.size);
    
    toast({
      title: "Recording Complete!",
      description: "Learnie heard you!",
      duration: 3000,
    });
  };

  const handleRecordingStart = () => {
    setIsRecording(true);
    setAudioBlob(null);
  };

  return (
    <div className="flex flex-col items-center justify-center gap-4">
      <div className="w-48 md:w-64">
        <img 
          src="/lovable-uploads/67cfaea7-3e82-4718-a6e1-342a6d724463.png"
          alt="Learnie"
          className="w-full h-auto"
        />
      </div>
      
      <div 
        className="relative p-4 md:p-6"
        onClick={() => !isRecording && handleRecordingStart()}
      >
        <VoiceButton 
          maxRecordingTime={8000} 
          onRecordingComplete={handleRecordingComplete} 
        />
      </div>
      
      <AudioWaves isActive={isRecording} />
      
      <p className="text-lg md:text-xl font-baloo text-center max-w-md text-kinder-black">
        {isRecording 
          ? "Learnie is listening! What would you like to know?" 
          : "Tap the button and ask Learnie anything!"}
      </p>
    </div>
  );
};

export default LearnieAssistant;

