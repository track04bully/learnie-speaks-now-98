
import React from 'react';
import { cn } from '@/lib/utils';

interface StatusMessageProps {
  errorMessage: string | null;
  isConnecting: boolean;
  isRecording: boolean;
  isSpeaking: boolean;
  connectionError: boolean;
}

const StatusMessage: React.FC<StatusMessageProps> = ({
  errorMessage,
  isConnecting,
  isRecording,
  isSpeaking,
  connectionError
}) => {
  return (
    <>
      {errorMessage && (
        <div className="absolute -bottom-12 left-0 right-0 text-center text-sm text-red-500 animate-fade-in">
          {errorMessage}
        </div>
      )}
      
      {/* Connection status */}
      {isConnecting && (
        <div className="absolute -bottom-12 left-0 right-0 text-center text-sm text-white/70 animate-fade-in">
          Connecting...
        </div>
      )}
      
      {/* Status labels */}
      <div className="absolute -bottom-12 left-0 right-0 text-center text-lg font-fredoka animate-fade-in">
        {isRecording ? (
          <span className="text-kinder-red">I'm listening!</span>
        ) : isSpeaking ? (
          <span className="text-kinder-purple">Tap to interrupt</span>
        ) : isConnecting ? (
          <span>Getting ready...</span>
        ) : connectionError ? (
          <span className="text-red-500">Tap to try again</span>
        ) : (
          <span>Tap to talk!</span>
        )}
      </div>
    </>
  );
};

export default StatusMessage;
