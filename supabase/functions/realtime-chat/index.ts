
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import "https://deno.land/x/xhr@0.1.0/mod.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  // Check for WebSocket upgrade request
  const upgradeHeader = req.headers.get("upgrade") || "";
  if (upgradeHeader.toLowerCase() !== "websocket") {
    return new Response("Expected WebSocket connection", { 
      status: 400, 
      headers: corsHeaders 
    });
  }

  try {
    // Get OpenAI API key from environment
    const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
    if (!OPENAI_API_KEY) {
      throw new Error("OPENAI_API_KEY is not set");
    }

    console.log("Requesting ephemeral token from OpenAI");
    
    // Request an ephemeral token from OpenAI
    const tokenResponse = await fetch("https://api.openai.com/v1/realtime/sessions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-realtime-preview-2024-10-01",
        voice: "alloy",
        instructions: "You are Learnie, a friendly 8-year-old guide who loves to help others learn. You speak in short, playful sentences and make learning fun! You're enthusiastic, positive, and good at explaining things in simple terms that kids can understand. You use examples from everyday life and encourage curiosity. You celebrate when someone understands a new concept. Remember to keep your answers brief and engaging!"
      }),
    });

    if (!tokenResponse.ok) {
      const errorData = await tokenResponse.text();
      console.error("OpenAI ephemeral token error:", errorData);
      throw new Error(`Failed to get ephemeral token: ${errorData}`);
    }

    const tokenData = await tokenResponse.json();
    console.log("Session created, preparing WebSocket connection");
    
    if (!tokenData.client_secret?.value) {
      throw new Error("No client secret in OpenAI response");
    }

    // Create WebSocket connection
    const { socket, response } = Deno.upgradeWebSocket(req);
    
    // Connect to OpenAI's realtime API
    const openAISocket = new WebSocket("wss://api.openai.com/v1/realtime");

    openAISocket.onopen = () => {
      console.log("Connected to OpenAI realtime API");
      
      // Send initial request with ephemeral token
      const EPHEMERAL_KEY = tokenData.client_secret.value;
      openAISocket.send(`Authorization: Bearer ${EPHEMERAL_KEY}\r\n` +
                        'Content-Type: application/json\r\n' +
                        '\r\n' +
                        JSON.stringify({
                          type: "session.update",
                          session: {
                            modalities: ["text", "audio"],
                            instructions: "You are Learnie, a friendly educational assistant who helps users learn new things. You are enthusiastic, supportive, and good at explaining complex topics in simple terms.",
                            voice: "alloy",
                            input_audio_format: "pcm16",
                            output_audio_format: "pcm16",
                            input_audio_transcription: {
                              model: "whisper-1"
                            },
                            turn_detection: {
                              type: "server_vad",
                              threshold: 0.5,
                              prefix_padding_ms: 300,
                              silence_duration_ms: 1000
                            },
                            temperature: 0.7,
                            max_response_output_tokens: "inf"
                          }
                        }));
    };

    // Forward messages from client to OpenAI
    socket.onmessage = (event) => {
      if (openAISocket.readyState === WebSocket.OPEN) {
        openAISocket.send(event.data);
      }
    };

    // Forward messages from OpenAI to client
    openAISocket.onmessage = (event) => {
      if (socket.readyState === WebSocket.OPEN) {
        socket.send(event.data);
      }
    };

    // Handle errors
    openAISocket.onerror = (event) => {
      console.error("OpenAI WebSocket error:", event);
      if (socket.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify({ error: "OpenAI connection error" }));
      }
    };

    socket.onerror = (event) => {
      console.error("Client WebSocket error:", event);
      openAISocket.close();
    };

    // Close connections properly
    socket.onclose = () => {
      console.log("Client connection closed");
      openAISocket.close();
    };

    openAISocket.onclose = () => {
      console.log("OpenAI connection closed");
      if (socket.readyState === WebSocket.OPEN) {
        socket.close();
      }
    };

    return response;
  } catch (error) {
    console.error("Error setting up WebSocket connection:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
