
import React from 'react';

interface ErrorMessageProps {
  message: string | null;
}

const ErrorMessage: React.FC<ErrorMessageProps> = ({ message }) => {
  if (!message) return null;

  return (
    <div className="absolute -bottom-12 left-0 right-0 text-center text-sm text-red-500 animate-fade-in">
      {message}
    </div>
  );
};

export default ErrorMessage;
