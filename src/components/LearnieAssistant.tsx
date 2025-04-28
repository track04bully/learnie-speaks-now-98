
import React, { useState } from 'react';
import VoiceButton from './VoiceButton';
import AudioWaves from './AudioWaves';

const LearnieAssistant: React.FC = () => {
  const [isRecording, setIsRecording] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);

  const getStatusText = () => {
    if (isRecording) return "I'm listening...";
    if (isSpeaking) return "I'm answering...";
    return "Tap the button and ask Learnie anything!";
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
    </div>
  );
};

export default LearnieAssistant;
