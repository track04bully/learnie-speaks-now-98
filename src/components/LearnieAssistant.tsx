
import React from 'react';
import { Button } from './ui/button';
import AudioWaves from './AudioWaves';
import { useLearnieVoice } from '@/hooks/useLearnieVoice';

const LearnieAssistant: React.FC = () => {
  const { phase, startConversation } = useLearnieVoice();

  return (
    <div className="flex flex-col items-center justify-center gap-2">      
      <div className="relative p-8">
        <Button
          onClick={startConversation}
          disabled={phase === 'connecting'}
          className={`w-40 h-40 md:w-56 md:h-56 text-white text-2xl md:text-4xl
                    font-baloo font-bold transition-all duration-300 shadow-lg
                    flex flex-col items-center justify-center gap-2 p-0 overflow-hidden
                    hover:scale-105 hover:shadow-[0_0_30px_rgba(107,102,255,0.3)] transition-all duration-300
                    rounded-[45%_55%_52%_48%_/_48%_45%_55%_52%]
                    ${phase === 'listen' 
                      ? "bg-kinder-purple animate-bounce-soft" 
                      : phase === 'speak'
                        ? "bg-kinder-pink animate-pulse"
                        : "bg-kinder-purple hover:bg-kinder-purple/90"}
                    ${phase === 'connecting' && "opacity-70 cursor-not-allowed"}`}
        >
          <div className={`flex items-center justify-center w-full h-full ${phase !== 'idle' && "scale-110 transition-transform"}`}>
            <img 
              src="/lovable-uploads/95e3efc8-6cb7-4d38-8114-856ee02055c1.png"
              alt="Learnie character"
              className="w-32 h-32 md:w-40 md:h-40 object-contain"
            />
          </div>
          
          <div className="absolute bottom-4 text-sm font-normal">
            {phase === 'connecting' ? 'Connecting...' :
             phase === 'listen' ? 'Listening...' :
             phase === 'speak' ? 'Speaking...' :
             'Click to talk!'}
          </div>
        </Button>
      </div>
      
      <AudioWaves isActive={phase === 'listen'} />
    </div>
  );
};

export default LearnieAssistant;
