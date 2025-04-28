import React from 'react';
import { cn } from '@/lib/utils';

interface VoiceButtonProps {
  isRecording: boolean;
  onStopRecording: () => void;
}

const VoiceButton: React.FC<VoiceButtonProps> = ({ 
  isRecording,
  onStopRecording
}) => {
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
          <span className="absolute w-full h-full rounded-[52%_48%_42%_58%_/_52%_48%_42%_58%] bg-kinder-pink/10 animate-pulse-ring" style={{ animationDelay: '0.5s' }}></span>
        </div>
      )}
      
      <button
        onClick={onStopRecording}
        disabled={!isRecording}
        className={cn(
          "relative w-40 h-40 md:w-56 md:h-56 text-white text-2xl md:text-4xl",
          "font-baloo font-bold transition-all duration-300 shadow-lg",
          "flex flex-col items-center justify-center gap-2 p-0 overflow-hidden",
          "hover:scale-105 hover:shadow-[0_0_30px_rgba(107,102,255,0.3)] transition-all duration-300",
          "rounded-[45%_55%_52%_48%_/_48%_45%_55%_52%]",
          isRecording 
            ? "bg-kinder-pink animate-bounce-soft" 
            : "bg-kinder-purple hover:bg-kinder-red",
          !isRecording && "opacity-70 cursor-not-allowed"
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
        
        {isRecording && (
          <div className="absolute bottom-4 text-base md:text-lg opacity-80">
            Listening...
          </div>
        )}
      </button>
    </div>
  );
};

export default VoiceButton;
