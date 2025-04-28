
import React from 'react';
import LearnieAssistant from '@/components/LearnieAssistant';

const Index = () => {
  return (
    <div className="min-h-screen bg-[#F1F0FB] p-4 flex items-center justify-center bg-[linear-gradient(109.6deg,_rgba(223,234,247,1)_11.2%,_rgba(244,248,252,1)_91.1%)]">
      {/* Header Section */}
      <div className="container mx-auto flex flex-col items-center">
        <div className="w-48 md:w-64 mx-auto mb-8">
          <img 
            src="/lovable-uploads/a77f0378-31fe-4b39-84d8-6fa0428a792c.png"
            alt="Learnie"
            className="w-full h-auto"
          />
        </div>
        <div className="max-w-xl w-full mx-auto">
          <LearnieAssistant />
        </div>
      </div>
    </div>
  );
};

export default Index;
