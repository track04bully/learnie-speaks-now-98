
import React from 'react';
import { cn } from '@/lib/utils';
import { Mic, MicOff, Speaker, WifiOff } from 'lucide-react';

interface RecordButtonProps {
  isRecording: boolean;
  isSpeaking: boolean;
  isConnecting: boolean;
  connectionError: boolean;
  onClick: () => void;
  disabled: boolean;
}

const RecordButton: React.FC<RecordButtonProps> = ({
  isRecording,
  isSpeaking,
  isConnecting,
  connectionError,
  onClick,
  disabled
}) => {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      aria-label={isConnecting ? "Connecting..." : isRecording ? "Stop talking" : isSpeaking ? "Interrupt Learnie" : "Start talking"}
      className={cn(
        "relative w-40 h-40 md:w-56 md:h-56 text-white text-2xl md:text-4xl",
        "font-baloo font-bold transition-all duration-300 shadow-lg",
        "flex flex-col items-center justify-center gap-2 p-0 overflow-hidden",
        "hover:scale-105 hover:shadow-[0_0_30px_rgba(107,102,255,0.3)] transition-all duration-300",
        "rounded-[45%_55%_52%_48%_/_48%_45%_55%_52%]",
        isConnecting ? "bg-gray-400 cursor-wait" :
        connectionError ? "bg-red-400 cursor-pointer" :
        isRecording ? "bg-kinder-red animate-pulse" : 
        isSpeaking ? "bg-kinder-purple opacity-90 cursor-pointer" :
        "bg-kinder-purple hover:bg-kinder-red",
        "cursor-pointer"
      )}
    >
      <div className="flex items-center justify-center w-full h-full relative">
        <img 
          src="/lovable-uploads/95e3efc8-6cb7-4d38-8114-856ee02055c1.png"
          alt="Learnie character"
          className={cn(
            "w-32 h-32 md:w-40 md:h-40 object-contain",
            isConnecting ? "" :
            connectionError ? "opacity-70" :
            isSpeaking ? "animate-bounce-soft" : 
            isRecording ? "animate-pulse" : 
            "transition-transform hover:scale-105"
          )}
        />
        <ButtonStatusIndicator 
          isConnecting={isConnecting}
          connectionError={connectionError}
          isSpeaking={isSpeaking}
          isRecording={isRecording}
        />
      </div>
    </button>
  );
};

interface ButtonStatusIndicatorProps {
  isConnecting: boolean;
  connectionError: boolean;
  isSpeaking: boolean;
  isRecording: boolean;
}

const ButtonStatusIndicator: React.FC<ButtonStatusIndicatorProps> = ({
  isConnecting,
  connectionError,
  isSpeaking,
  isRecording
}) => {
  return (
    <div className={cn(
      "absolute top-4 right-4 p-2 rounded-full",
      connectionError ? "bg-red-500" :
      isRecording || isSpeaking ? "bg-white/20" : "bg-white/10"
    )}>
      {isConnecting ? (
        <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
      ) : connectionError ? (
        <WifiOff className="w-6 h-6 text-white animate-pulse" />
      ) : isSpeaking ? (
        <Speaker className="w-6 h-6 text-white animate-pulse" />
      ) : isRecording ? (
        <Mic className="w-6 h-6 text-white animate-pulse" />
      ) : (
        <MicOff className="w-6 h-6 text-white/70" />
      )}
    </div>
  );
};

export default RecordButton;
