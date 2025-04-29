
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import "https://deno.land/x/xhr@0.1.0/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  const { headers } = req;
  const upgradeHeader = headers.get("upgrade") || "";

  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Check if it's a WebSocket request
  if (upgradeHeader.toLowerCase() !== "websocket") {
    return new Response("Expected WebSocket connection", { status: 400, headers: corsHeaders });
  }

  try {
    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
    if (!OPENAI_API_KEY) {
      throw new Error("OPENAI_API_KEY is not set");
    }

    // Create a session with OpenAI
    console.log("Creating OpenAI session...");
    const sessionResponse = await fetch("https://api.openai.com/v1/realtime/sessions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-realtime-preview-2024-12-17",
        voice: "alloy",
        instructions: "You are Learnie, a friendly and helpful AI assistant specialized in knowledge sharing. You're designed to be conversational, warm, and helpful. You have a cheerful and supportive personality. Respond to questions with clarity and friendliness."
      }),
    });

    if (!sessionResponse.ok) {
      const errorText = await sessionResponse.text();
      console.error("Failed to create session:", errorText);
      throw new Error(`Failed to create OpenAI session: ${errorText}`);
    }

    const session = await sessionResponse.json();
    console.log("Session created successfully:", session);

    if (!session.client_secret?.value) {
      throw new Error("No client secret in session response");
    }

    const CLIENT_SECRET = session.client_secret.value;
    
    // Upgrade to WebSocket
    const { socket: clientSocket, response } = Deno.upgradeWebSocket(req);
    
    // Connect to OpenAI WebSocket
    const serverSocket = new WebSocket("wss://api.openai.com/v1/realtime");
    
    let openAIConnected = false;
    let sessionCreated = false;
    
    serverSocket.onopen = () => {
      console.log("Connected to OpenAI WebSocket");
      openAIConnected = true;
      
      // Send authentication message
      serverSocket.send(JSON.stringify({
        type: "authentication",
        client_secret: CLIENT_SECRET
      }));
    };
    
    serverSocket.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        console.log("Received from OpenAI:", data.type);
        
        // Check for session.created event to send session update
        if (data.type === "session.created" && !sessionCreated) {
          sessionCreated = true;
          console.log("Session created, sending session configuration...");
          
          // Use updated session configuration format (April 2025)
          serverSocket.send(JSON.stringify({
            "event_id": "update_" + Date.now(),
            "type": "session.update",
            "session": {
              "modalities": ["text", "audio"],
              "instructions": "You are Learnie, a friendly and helpful AI assistant specialized in knowledge sharing. You're designed to be conversational, warm, and helpful. You have a cheerful and supportive personality. Respond to questions with clarity and friendliness.",
              "voice": "alloy",
              // Note: input_audio_format & output_audio_format removed per April 2025 update
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
        }
        
        // Forward all messages from OpenAI to the client
        clientSocket.send(event.data);
      } catch (error) {
        console.error("Error handling message from OpenAI:", error);
      }
    };
    
    serverSocket.onerror = (error) => {
      console.error("OpenAI WebSocket error:", error);
      clientSocket.close(1011, "Error in OpenAI connection");
    };
    
    serverSocket.onclose = (event) => {
      console.log("OpenAI WebSocket closed:", event.code, event.reason);
      if (clientSocket.readyState === WebSocket.OPEN) {
        clientSocket.close(event.code, event.reason || "OpenAI connection closed");
      }
    };
    
    clientSocket.onmessage = (event) => {
      try {
        if (!openAIConnected) {
          console.warn("Can't forward message - OpenAI WebSocket not connected yet");
          return;
        }
        
        let message;
        try {
          message = JSON.parse(event.data);
        } catch (e) {
          console.error("Invalid JSON from client:", event.data);
          return;
        }
        
        // Remove 'name' field from input_audio_buffer events per April 2025 update
        if (message.type && message.type.startsWith('input_audio_buffer.')) {
          if (message.name) {
            delete message.name;
            console.log("Removed 'name' field from audio buffer event");
          }
        }
        
        // Forward the modified message to OpenAI
        serverSocket.send(JSON.stringify(message));
      } catch (error) {
        console.error("Error handling message from client:", error);
      }
    };
    
    clientSocket.onerror = (error) => {
      console.error("Client WebSocket error:", error);
    };
    
    clientSocket.onclose = (event) => {
      console.log("Client WebSocket closed:", event.code, event.reason);
      if (serverSocket.readyState === WebSocket.OPEN) {
        serverSocket.close(1000, "Client disconnected");
      }
    };
    
    console.log("WebSocket connection established");
    return response;
  } catch (error) {
    console.error("Error setting up WebSocket:", error);
    return new Response(JSON.stringify({ error: error.message }), { 
      status: 500, 
      headers: { ...corsHeaders, "Content-Type": "application/json" } 
    });
  }
});
