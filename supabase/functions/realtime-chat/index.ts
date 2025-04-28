
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import "https://deno.land/x/xhr@0.1.0/mod.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const { headers } = req;
  const upgradeHeader = headers.get("upgrade") || "";

  if (upgradeHeader.toLowerCase() !== "websocket") {
    return new Response("Expected WebSocket connection", { 
      status: 400,
      headers: corsHeaders
    });
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
    console.log("Client connected");

    // Connect to OpenAI's Realtime API
    const openAISocket = new WebSocket("wss://api.openai.com/v1/realtime?model=gpt-4o-realtime-preview-2024-10-01");
    
    openAISocket.onopen = () => {
      console.log("Connected to OpenAI Realtime API");
      
      // The authorization is sent with the initial request
      openAISocket.send(JSON.stringify({
        type: "authorization",
        authorization: `Bearer ${OPENAI_API_KEY}`
      }));
    };

    // Forward messages from client to OpenAI
    clientSocket.onmessage = (event) => {
      if (openAISocket.readyState === WebSocket.OPEN) {
        console.log("Forwarding message to OpenAI");
        openAISocket.send(event.data);
      }
    };

    // Forward messages from OpenAI to client
    openAISocket.onmessage = (event) => {
      if (clientSocket.readyState === WebSocket.OPEN) {
        console.log("Received message from OpenAI");
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

    openAISocket.onerror = (error) => {
      console.error("OpenAI WebSocket error:", error);
      if (clientSocket.readyState === WebSocket.OPEN) {
        clientSocket.close(1011, "Error connecting to OpenAI");
      }
    };

    return response;
  } catch (error) {
    console.error("Error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
