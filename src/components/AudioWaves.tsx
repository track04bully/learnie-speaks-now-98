
import React from 'react';
import { cn } from '@/lib/utils';

interface AudioWavesProps {
  isActive: boolean;
  className?: string;
}

const AudioWaves: React.FC<AudioWavesProps> = ({ isActive, className }) => {
  // Generate colors for the waves
  const waveColors = ['#FF6B6B', '#FFD93D', '#6BCB77', '#4D96FF', '#9B5DE5', '#F15BB5'];
  
  return (
    <div className={cn(
      "flex items-end justify-center h-14 gap-2 transition-opacity",
      className,
      isActive ? "opacity-100" : "opacity-60"
    )}>
      {[...Array(6)].map((_, i) => (
        <div
          key={i}
          className="flex flex-col items-center"
        >
          <div
            className={cn(
              "w-3 md:w-4 rounded-full transition-all duration-300",
              isActive ? "animate-[bounce_0.5s_ease-in-out_infinite]" : ""
            )}
            style={{ 
              backgroundColor: waveColors[i % waveColors.length],
              animationDelay: isActive ? `${i * 0.1}s` : '0s',
              height: isActive ? `${Math.max(10, ((i % 3) * 15) + 10)}px` : '8px'
            }}
          />
          {/* Add small circles at the bottom for a playful effect */}
          <div 
            className={cn(
              "w-2 h-2 rounded-full mt-1",
              isActive ? "opacity-100" : "opacity-50"
            )}
            style={{ 
              backgroundColor: waveColors[i % waveColors.length],
            }}
          />
        </div>
      ))}
    </div>
  );
};

export default AudioWaves;
