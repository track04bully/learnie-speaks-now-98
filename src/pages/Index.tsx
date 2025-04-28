
import React from 'react';
import LearnieAssistant from '@/components/LearnieAssistant';
import { Card } from '@/components/ui/card';
import { Computer, FileText, Palette, Pencil } from 'lucide-react';

const Index = () => {
  return (
    <div className="min-h-screen bg-[#FFD95A] p-4">
      {/* Header Section */}
      <div className="container mx-auto mb-12 text-center">
        <div className="w-48 md:w-64 mx-auto mb-8">
          <img 
            src="/lovable-uploads/a77f0378-31fe-4b39-84d8-6fa0428a792c.png"
            alt="Learnie"
            className="w-full h-auto"
          />
        </div>
        <div className="max-w-xl mx-auto">
          <LearnieAssistant />
        </div>
        <div className="mt-6 bg-white rounded-full py-3 px-6 inline-block shadow-md">
          <input
            type="text"
            placeholder="Add your class grade level or name here"
            className="text-center w-full bg-transparent border-none outline-none text-lg font-baloo placeholder:text-gray-500"
          />
        </div>
      </div>

      {/* Main Content */}
      <div className="container mx-auto">
        <div className="max-w-4xl mx-auto">
          {/* Navigation Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {[
              { title: "Digital Learning", icon: Computer, color: "bg-blue-100" },
              { title: "Assignments", icon: FileText, color: "bg-purple-100" },
              { title: "Creative Corner", icon: Palette, color: "bg-orange-100" },
              { title: "Study Notes", icon: Pencil, color: "bg-pink-100" },
            ].map((item) => (
              <Card 
                key={item.title}
                className={`${item.color} hover:scale-105 transition-transform duration-200 cursor-pointer p-6 flex items-center gap-4`}
              >
                <div className="bg-white p-3 rounded-lg">
                  <item.icon className="w-8 h-8" />
                </div>
                <h3 className="font-fredoka text-xl">{item.title}</h3>
              </Card>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Index;
