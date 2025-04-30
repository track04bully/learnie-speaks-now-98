
import React from 'react';

interface StatusLabelProps {
  isRecording: boolean;
  isSpeaking: boolean;
  isConnecting: boolean;
  connectionError: boolean;
}

const StatusLabel: React.FC<StatusLabelProps> = ({
  isRecording,
  isSpeaking,
  isConnecting,
  connectionError
}) => {
  let statusText = 'Tap to talk!';
  let statusColor = '';

  if (isRecording) {
    statusText = 'I\'m listening!';
    statusColor = 'text-kinder-red';
  } else if (isSpeaking) {
    statusText = 'Tap to interrupt';
    statusColor = 'text-kinder-purple';
  } else if (isConnecting) {
    statusText = 'Getting ready...';
  } else if (connectionError) {
    statusText = 'Tap to try again';
    statusColor = 'text-red-500';
  }

  return (
    <div className="absolute -bottom-12 left-0 right-0 text-center text-lg font-fredoka animate-fade-in">
      <span className={statusColor}>{statusText}</span>
    </div>
  );
};

export default StatusLabel;
