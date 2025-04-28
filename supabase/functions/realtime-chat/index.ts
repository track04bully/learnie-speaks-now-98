
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import "https://deno.land/x/xhr@0.1.0/mod.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  const { headers } = req;
  const upgradeHeader = headers.get("upgrade") || "";

  if (upgradeHeader.toLowerCase() !== "websocket") {
    return new Response("Expected WebSocket connection", { status: 400 });
  }

  const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
  if (!OPENAI_API_KEY) {
    return new Response("OpenAI API key not configured", { 
      status: 500,
      headers: corsHeaders 
    });
  }

  try {
    // Create WebSocket connection with client
    const { socket: clientSocket, response } = Deno.upgradeWebSocket(req);

    // Connect to OpenAI's Realtime API
    const openAISocket = new WebSocket("wss://api.openai.com/v1/realtime?model=gpt-4o-realtime-preview-2024-10-01");
    
    openAISocket.onopen = () => {
      console.log("Connected to OpenAI Realtime API");
      
      // Send initial session configuration
      openAISocket.send(JSON.stringify({
        "event_id": "event_123",
        "type": "session.update",
        "session": {
          "modalities": ["text", "audio"],
          "instructions": "You are Learnie, a friendly and knowledgeable AI assistant. Your voice is warm and approachable. Keep your responses concise and helpful.",
          "voice": "alloy",
          "input_audio_format": "pcm16",
          "output_audio_format": "pcm16",
          "input_audio_transcription": {
            "model": "whisper-1"
          },
          "turn_detection": {
            "type": "server_vad",
            "threshold": 0.5,
            "prefix_padding_ms": 300,
            "silence_duration_ms": 1000
          },
          "temperature": 0.8,
          "max_response_output_tokens": "inf"
        }   
      }));
    };

    // Forward messages from client to OpenAI
    clientSocket.onmessage = (event) => {
      if (openAISocket.readyState === WebSocket.OPEN) {
        openAISocket.send(event.data);
      }
    };

    // Forward messages from OpenAI to client
    openAISocket.onmessage = (event) => {
      if (clientSocket.readyState === WebSocket.OPEN) {
        clientSocket.send(event.data);
      }
    };

    // Handle closures and errors
    clientSocket.onclose = () => {
      console.log("Client disconnected");
      openAISocket.close();
    };

    openAISocket.onclose = () => {
      console.log("OpenAI connection closed");
      clientSocket.close();
    };

    return response;
  } catch (error) {
    console.error("Error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: corsHeaders
    });
  }
});
