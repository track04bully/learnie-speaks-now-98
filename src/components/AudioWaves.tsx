
import React from 'react';
import { cn } from '@/lib/utils';

interface AudioWavesProps {
  isActive: boolean;
  className?: string;
}

const AudioWaves: React.FC<AudioWavesProps> = ({ isActive, className }) => {
  return (
    <div className={cn(
      "flex items-end justify-center h-12 gap-1", 
      className,
      isActive && "animate-bounce-soft"
    )}>
      {[...Array(6)].map((_, i) => (
        <div
          key={i}
          className={cn(
            "w-2 md:w-3 rounded-full transition-all duration-300",
            isActive ? "bg-kinder-red animate-[bounce-soft_0.5s_ease-in-out_infinite]" 
                    : "bg-kinder-purple h-2"
          )}
          style={{ 
            animationDelay: isActive ? `${i * 0.1}s` : '0s',
            height: isActive ? `${Math.max(8, ((i % 3) * 10) + 8)}px` : '8px'
          }}
        />
      ))}
    </div>
  );
};

export default AudioWaves;
