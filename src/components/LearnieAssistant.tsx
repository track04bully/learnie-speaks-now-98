
import React, { useState } from 'react';
import VoiceButton from './VoiceButton';
import AudioWaves from './AudioWaves';

const LearnieAssistant: React.FC = () => {
  const [isRecording, setIsRecording] = useState(false);

  return (
    <div className="flex flex-col items-center justify-center gap-2">      
      <div className="relative p-4">
        <VoiceButton />
      </div>
      
      <AudioWaves isActive={isRecording} />
      
      <p className="text-lg md:text-xl font-fredoka text-center max-w-md text-kinder-black">
        {isRecording ? "I'm listening..." : "Tap the button and ask Learnie anything!"}
      </p>
    </div>
  );
};

export default LearnieAssistant;
