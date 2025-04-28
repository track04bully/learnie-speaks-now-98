
import React from 'react';
import VoiceButton from './VoiceButton';
import AudioWaves from './AudioWaves';

const LearnieAssistant: React.FC = () => {
  return (
    <div className="flex flex-col items-center justify-center gap-2">      
      <div className="relative p-4">
        <VoiceButton />
      </div>
      
      <AudioWaves isActive={false} />
      
      <p className="text-lg md:text-xl font-fredoka text-center max-w-md text-kinder-black">
        Tap the button and ask Learnie anything!
      </p>
    </div>
  );
};

export default LearnieAssistant;
