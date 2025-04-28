
import React from 'react';
import LearnieAssistant from '@/components/LearnieAssistant';

const Index = () => {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-[#FEF7CD] to-[#D3E4FD] p-4">
      <div className="w-full max-w-xl flex flex-col items-center justify-center py-12">
        <LearnieAssistant />
      </div>
    </div>
  );
};

export default Index;
