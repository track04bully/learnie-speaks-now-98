
import React, { useState, useEffect } from 'react';
import { Button } from './ui/button';
import { Trash2, RefreshCw, Volume2, Mic } from 'lucide-react';
import AudioWaves from './AudioWaves';
import { useLearnieVoice } from '@/hooks/useLearnieVoice';
import { Message } from '@/utils/RealtimeAudio';
import { useToast } from '@/hooks/use-toast';

const LearnieAssistant: React.FC = () => {
  const { toast } = useToast();
  const { 
    phase, 
    messageHistory, 
    isProcessing,
    error,
    startConversation, 
    stopConversation, 
    clearHistory,
    retryConnection
  } = useLearnieVoice();
  const [showHistory, setShowHistory] = useState(false);
  
  // Auto-retry connection if there's an error
  useEffect(() => {
    if (error) {
      toast({
        title: "Connection issue",
        description: "There was a problem with the connection. Try again or refresh the page.",
        variant: "destructive",
      });
    }
  }, [error, toast]);

  return (
    <div className="flex flex-col items-center justify-center gap-4">      
      <div className="relative p-8">
        <Button
          onClick={phase === 'idle' || phase === 'error' ? startConversation : stopConversation}
          disabled={phase === 'connecting'}
          className={`w-40 h-40 md:w-56 md:h-56 text-white text-2xl md:text-4xl
                    font-baloo font-bold transition-all duration-300 shadow-lg
                    flex flex-col items-center justify-center gap-2 p-0 overflow-hidden
                    hover:scale-105 hover:shadow-[0_0_30px_rgba(107,102,255,0.3)] transition-all duration-300
                    rounded-[45%_55%_52%_48%_/_48%_45%_55%_52%]
                    ${phase === 'listen' 
                      ? "bg-kinder-purple animate-bounce-soft" 
                      : phase === 'speak'
                        ? "bg-kinder-pink animate-pulse"
                        : phase === 'error'
                          ? "bg-kinder-red"
                          : "bg-kinder-purple hover:bg-kinder-purple/90"}
                    ${phase === 'connecting' && "opacity-70 cursor-not-allowed"}`}
          aria-label={phase === 'idle' ? "Start conversation" : "Stop conversation"}
        >
          <div className={`flex items-center justify-center w-full h-full ${phase !== 'idle' && "scale-110 transition-transform"}`}>
            <img 
              src="/lovable-uploads/95e3efc8-6cb7-4d38-8114-856ee02055c1.png"
              alt="Learnie character"
              className="w-32 h-32 md:w-40 md:h-40 object-contain"
            />
          </div>
          
          <div className="absolute bottom-4 text-sm font-normal flex items-center gap-2">
            {phase === 'connecting' ? (
              <>
                <span className="animate-spin h-4 w-4 border-2 border-white rounded-full border-t-transparent"></span>
                Connecting...
              </>
            ) : 
             phase === 'listen' ? (
              <>
                <Mic size={16} className="animate-pulse" />
                Listening...
              </>
            ) : 
             phase === 'speak' ? (
              <>
                <Volume2 size={16} className="animate-pulse" />
                Speaking...
              </>
            ) : 
             phase === 'error' ? (
              <>
                Error
              </>
            ) : 
            'Click to talk!'}
          </div>
        </Button>
      </div>
      
      <AudioWaves isActive={phase === 'listen'} />
      
      {/* Processing indicator */}
      {isProcessing && (
        <div className="text-sm text-gray-600 animate-pulse flex items-center gap-2">
          <span className="h-2 w-2 bg-kinder-purple rounded-full"></span>
          Processing...
        </div>
      )}
      
      {/* Error retry button */}
      {phase === 'error' && (
        <Button 
          onClick={retryConnection}
          variant="outline" 
          size="sm"
          className="flex items-center gap-2"
        >
          <RefreshCw size={16} className="animate-spin" />
          Retry connection
        </Button>
      )}
      
      {/* Conversation controls */}
      {phase !== 'idle' && phase !== 'error' && (
        <div className="flex items-center gap-4">
          <Button 
            onClick={() => setShowHistory(!showHistory)}
            variant="outline"
            className="text-sm"
          >
            {showHistory ? 'Hide Conversation' : 'Show Conversation'}
          </Button>
          
          {messageHistory.length > 0 && (
            <Button 
              onClick={clearHistory}
              variant="ghost"
              size="icon"
              className="text-gray-500 hover:text-red-500"
              title="Clear conversation history"
            >
              <Trash2 size={18} />
            </Button>
          )}
        </div>
      )}
      
      {/* Conversation history */}
      {showHistory && messageHistory.length > 0 && (
        <div className="w-full max-w-lg mt-4 bg-white/80 backdrop-blur-sm rounded-lg shadow-lg p-4 max-h-96 overflow-y-auto">
          <h3 className="text-lg font-medium mb-4">Conversation History</h3>
          <div className="space-y-4">
            {messageHistory.map((message, i) => (
              <div 
                key={i} 
                className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div 
                  className={`max-w-[80%] px-4 py-2 rounded-lg ${
                    message.role === 'user' 
                      ? 'bg-kinder-purple/20 text-gray-800 rounded-tr-none' 
                      : 'bg-kinder-pink/20 text-gray-800 rounded-tl-none'
                  }`}
                >
                  <div className="text-xs font-medium mb-1">
                    {message.role === 'user' ? 'You' : 'Learnie'}
                  </div>
                  <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
      
      {/* Usage instructions */}
      {phase === 'idle' && !error && (
        <div className="text-center text-gray-600 max-w-md">
          <h3 className="font-medium mb-2">How to talk with Learnie:</h3>
          <ol className="text-sm text-left list-decimal list-inside space-y-2">
            <li>Click on Learnie's image to start</li>
            <li>When Learnie is listening (purple glow), speak clearly</li>
            <li>Wait for Learnie to respond (pink glow)</li>
            <li>Continue the conversation naturally</li>
          </ol>
        </div>
      )}
    </div>
  );
};

export default LearnieAssistant;
