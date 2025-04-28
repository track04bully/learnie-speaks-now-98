
import { useEffect, useRef, useState } from 'react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Message, RealtimeChat } from '@/utils/RealtimeAudio';

// Define all possible phases
type Phase = 'idle' | 'connecting' | 'listen' | 'speak' | 'error';

export const useLearnieVoice = () => {
  const { toast } = useToast();
  const [phase, setPhase] = useState<Phase>('idle');
  const [transcript, setTranscript] = useState<string>('');
  const [messageHistory, setMessageHistory] = useState<Message[]>([]);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const realtimeChatRef = useRef<RealtimeChat | null>(null);
  const connectionAttemptsRef = useRef<number>(0);
  const maxConnectionAttempts = 3;

  const startConversation = async () => {
    try {
      if (phase !== 'idle' && phase !== 'error') return;
      setPhase('connecting');
      setError(null);
      connectionAttemptsRef.current = 0;
      
      if (!realtimeChatRef.current) {
        const chat = new RealtimeChat(
          // Connection change handler
          (connected) => {
            if (connected) {
              setPhase('listen');
              setError(null);
              console.log("Connection to Learnie established successfully");
            } else {
              setPhase('idle');
              console.log("Connection to Learnie ended");
            }
          },
          // Transcript update handler
          (text) => {
            setTranscript(prev => prev + text);
          },
          // Speaking change handler
          (speaking) => {
            setPhase(speaking ? 'speak' : 'listen');
            console.log("Speaking state changed:", speaking);
          },
          // Processing state handler
          (processing) => {
            setIsProcessing(processing);
            if (processing) {
              console.log("Processing user input...");
            }
          },
          // Message history update handler
          (messages) => {
            setMessageHistory(messages);
          }
        );
        
        realtimeChatRef.current = chat;
      }
      
      await realtimeChatRef.current.connect();
      
      // Reset transcript for new conversation
      setTranscript('');

      toast({
        title: "Connected",
        description: "Ready to chat with Learnie!",
      });
    } catch (error) {
      console.error('Error starting conversation:', error);
      setPhase('error');
      setError(error instanceof Error ? error.message : 'Connection failed');
      toast({
        title: "Connection Error",
        description: error instanceof Error ? error.message : 'Failed to start conversation',
        variant: "destructive",
      });
      
      // Auto-retry connection if not exceeding max attempts
      if (connectionAttemptsRef.current < maxConnectionAttempts) {
        connectionAttemptsRef.current++;
        console.log(`Attempting automatic reconnection (${connectionAttemptsRef.current}/${maxConnectionAttempts})...`);
        setTimeout(() => {
          if (phase === 'error') {
            retryConnection();
          }
        }, 2000); // Wait 2 seconds before retrying
      }
    }
  };
  
  const stopConversation = () => {
    if (realtimeChatRef.current) {
      realtimeChatRef.current.disconnect();
      setPhase('idle');
      toast({
        title: "Disconnected",
        description: "Chat with Learnie ended.",
      });
    }
  };
  
  const clearHistory = () => {
    if (realtimeChatRef.current) {
      realtimeChatRef.current.clearHistory();
      setMessageHistory([]);
      setTranscript('');
      toast({
        title: "History cleared",
        description: "Conversation history has been cleared.",
      });
    }
  };

  const retryConnection = async () => {
    stopConversation();
    setTimeout(startConversation, 500);
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
    error,
    startConversation,
    stopConversation,
    clearHistory,
    retryConnection,
    isConnected: phase !== 'idle' && phase !== 'error',
  };
};
