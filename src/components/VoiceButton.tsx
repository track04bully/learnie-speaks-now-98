
import React from 'react';
import { cn } from '@/lib/utils';

const VoiceButton: React.FC = () => {
  return (
    <button
      className={cn(
        "relative w-40 h-40 md:w-56 md:h-56 text-white text-2xl md:text-4xl",
        "font-baloo font-bold transition-all duration-300 shadow-lg",
        "flex flex-col items-center justify-center gap-2 p-0 overflow-hidden",
        "hover:scale-105 hover:shadow-[0_0_30px_rgba(107,102,255,0.3)] transition-all duration-300",
        "rounded-[45%_55%_52%_48%_/_48%_45%_55%_52%]",
        "bg-kinder-purple hover:bg-kinder-red cursor-pointer"
      )}
    >
      <div className="flex items-center justify-center w-full h-full">
        <img 
          src="/lovable-uploads/95e3efc8-6cb7-4d38-8114-856ee02055c1.png"
          alt="Learnie character"
          className="w-32 h-32 md:w-40 md:h-40 object-contain"
        />
      </div>
    </button>
  );
};

export default VoiceButton;
