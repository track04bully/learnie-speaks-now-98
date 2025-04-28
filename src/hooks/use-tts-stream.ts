
import { supabase } from "@/integrations/supabase/client";

export const useTTSStream = () => {
  const playStreamingTTS = async (text: string) => {
    try {
      const response = await supabase.functions.invoke('tts-stream', {
        body: { text }
      });

      if (response.error) throw new Error(response.error.message);
      
      const audioData = response.data;
      if (!audioData) throw new Error('No audio data received');

      const audioCtx = new AudioContext();
      await audioCtx.resume();

      const audioBuffer = await audioCtx.decodeAudioData(
        Uint8Array.from(atob(audioData), c => c.charCodeAt(0)).buffer
      );

      const source = audioCtx.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(audioCtx.destination);
      source.start(0);

      return new Promise<void>((resolve) => {
        source.onended = () => {
          audioCtx.close();
          resolve();
        };
      });
    } catch (error) {
      console.error('Error playing TTS:', error);
      throw error;
    }
  };

  return { playStreamingTTS };
};
