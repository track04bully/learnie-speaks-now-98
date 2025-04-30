
import React from 'react';

interface ConnectionStatusProps {
  isConnecting: boolean;
}

const ConnectionStatus: React.FC<ConnectionStatusProps> = ({ isConnecting }) => {
  if (!isConnecting) return null;

  return (
    <div className="absolute -bottom-12 left-0 right-0 text-center text-sm text-white/70 animate-fade-in">
      Connecting...
    </div>
  );
};

export default ConnectionStatus;
