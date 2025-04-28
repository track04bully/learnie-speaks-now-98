
import React from 'react';
import LearnieAssistant from '@/components/LearnieAssistant';

const Index = () => {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-kinder-yellow/20 to-kinder-purple/10 p-4">
      <div className="w-full max-w-xl flex flex-col items-center justify-center py-12">
        <LearnieAssistant />
      </div>
    </div>
  );
};

export default Index;
