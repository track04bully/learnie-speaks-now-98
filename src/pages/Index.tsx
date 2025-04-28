
import React from 'react';
import LearnieAssistant from '@/components/LearnieAssistant';
import { Card } from '@/components/ui/card';
import { Calendar, FileText, Search, Lightbulb } from 'lucide-react';

const Index = () => {
  return (
    <div className="min-h-screen bg-kinder-green p-4">
      {/* Header Section */}
      <div className="container mx-auto mb-8 text-center">
        <div className="inline-block bg-kinder-yellow px-8 py-3 rounded-full">
          <h1 className="text-4xl md:text-5xl font-fredoka text-kinder-red">CLASSROOM</h1>
        </div>
        <div className="inline-block bg-white px-6 py-2 rounded-full mt-2">
          <h2 className="text-2xl md:text-3xl font-fredoka text-kinder-black">HUB</h2>
        </div>
      </div>

      {/* Main Content */}
      <div className="container mx-auto">
        <div className="max-w-4xl mx-auto">
          {/* Learnie Section */}
          <div className="bg-white/90 backdrop-blur rounded-3xl p-6 mb-8 shadow-lg">
            <LearnieAssistant />
          </div>

          {/* Navigation Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[
              { title: "Today's Schedule", icon: Calendar, color: "bg-blue-100" },
              { title: "Learning Resources", icon: FileText, color: "bg-purple-100" },
              { title: "Study Helper", icon: Lightbulb, color: "bg-orange-100" },
              { title: "Search Topics", icon: Search, color: "bg-pink-100" },
            ].map((item) => (
              <Card 
                key={item.title}
                className={`${item.color} hover:scale-105 transition-transform duration-200 cursor-pointer p-4 flex items-center gap-3`}
              >
                <div className="bg-white p-2 rounded-lg">
                  <item.icon className="w-6 h-6" />
                </div>
                <h3 className="font-fredoka text-lg">{item.title}</h3>
              </Card>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Index;
