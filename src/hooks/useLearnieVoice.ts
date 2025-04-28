
import { useEffect, useRef, useState } from 'react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Message, RealtimeChat } from '@/utils/RealtimeAudio';

// Define all possible phases
type Phase = 'idle' | 'connecting' | 'listen' | 'speak';

export const useLearnieVoice = () => {
  const { toast } = useToast();
  const [phase, setPhase] = useState<Phase>('idle');
  const [transcript, setTranscript] = useState<string>('');
  const [messageHistory, setMessageHistory] = useState<Message[]>([]);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const realtimeChatRef = useRef<RealtimeChat | null>(null);

  const startConversation = async () => {
    try {
      if (phase !== 'idle') return;
      setPhase('connecting');
      
      if (!realtimeChatRef.current) {
        const chat = new RealtimeChat(
          // Connection change handler
          (connected) => {
            if (!connected) {
              setPhase('idle');
            }
          },
          // Transcript update handler
          (text) => {
            setTranscript(prev => prev + text);
          },
          // Speaking change handler
          (speaking) => {
            setPhase(speaking ? 'speak' : 'listen');
          },
          // Processing state handler
          (processing) => {
            setIsProcessing(processing);
          },
          // Message history update handler
          (messages) => {
            setMessageHistory(messages);
          }
        );
        
        realtimeChatRef.current = chat;
      }
      
      await realtimeChatRef.current.connect();
      setPhase('listen');
      
      // Reset transcript for new conversation
      setTranscript('');

      toast({
        title: "Connected",
        description: "Ready to chat with Learnie!",
      });
    } catch (error) {
      console.error('Error starting conversation:', error);
      setPhase('idle');
      toast({
        title: "Connection Error",
        description: error instanceof Error ? error.message : 'Failed to start conversation',
        variant: "destructive",
      });
    }
  };
  
  const stopConversation = () => {
    if (realtimeChatRef.current) {
      realtimeChatRef.current.disconnect();
      setPhase('idle');
    }
  };
  
  const clearHistory = () => {
    if (realtimeChatRef.current) {
      realtimeChatRef.current.clearHistory();
      setMessageHistory([]);
      setTranscript('');
    }
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (realtimeChatRef.current) {
        realtimeChatRef.current.disconnect();
      }
    };
  }, []);

  return {
    phase,
    transcript,
    messageHistory,
    isProcessing,
    startConversation,
    stopConversation,
    clearHistory,
    isConnected: phase !== 'idle',
  };
};
