
import React from 'react';
import ErrorMessage from './ErrorMessage';
import ConnectionStatus from './ConnectionStatus';
import StatusLabel from './StatusLabel';

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
      <ErrorMessage message={errorMessage} />
      <ConnectionStatus isConnecting={isConnecting} />
      <StatusLabel 
        isRecording={isRecording} 
        isSpeaking={isSpeaking} 
        isConnecting={isConnecting} 
        connectionError={connectionError} 
      />
    </>
  );
};

export default StatusMessage;
