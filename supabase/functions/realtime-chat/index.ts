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
    // If not a WebSocket request, handle as a regular HTTP request to get the token
    try {
      // Get OpenAI API key from environment
      const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
      if (!OPENAI_API_KEY) {
        throw new Error("OPENAI_API_KEY is not set");
      }

      console.log("Requesting ephemeral token from OpenAI");
      
      // Request an ephemeral token from OpenAI specifically for realtime model
      const tokenResponse = await fetch("https://api.openai.com/v1/realtime/sessions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${OPENAI_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "gpt-4o-realtime-preview-2024-10-01",
          modalities: ["text", "audio"],
          voice: "alloy",
          input_audio_format: "pcm16",
          output_audio_format: "pcm16",
          input_audio_transcription: {
            model: "whisper-1",
            language: "en",
            prompt: "Focus on accurate transcription of speech",
            sampling_rate: 16000
          },
          turn_detection: {
            type: "server_vad",
            threshold: 0.5,
            prefix_padding_ms: 300,
            silence_duration_ms: 800,
            max_timeout_ms: 2000
          }
        }),
      });

      if (!tokenResponse.ok) {
        const errorData = await tokenResponse.text();
        console.error("OpenAI ephemeral token error:", errorData);
        throw new Error(`Failed to get ephemeral token: ${errorData}`);
      }

      const tokenData = await tokenResponse.json();
      return new Response(JSON.stringify(tokenData), { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    } catch (error) {
      console.error("Error getting token:", error);
      return new Response(JSON.stringify({ error: error.message }), { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    }
  }

  try {
    // Get OpenAI API key from environment
    const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
    if (!OPENAI_API_KEY) {
      throw new Error("OPENAI_API_KEY is not set");
    }

    console.log("Setting up WebSocket connection");
    
    // Create WebSocket connection
    const { socket, response } = Deno.upgradeWebSocket(req);
    let sessionId: string | null = null;
    
    // Connect to OpenAI's realtime API
    const openAISocket = new WebSocket("wss://api.openai.com/v1/realtime");

    openAISocket.onopen = () => {
      console.log("Connected to OpenAI realtime API");
      
      // Request a token and create session
      fetch("https://api.openai.com/v1/realtime/sessions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${OPENAI_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "gpt-4o-realtime-preview-2024-10-01",
          modalities: ["text", "audio"],
          voice: "alloy",
          input_audio_format: "pcm16",
          output_audio_format: "pcm16",
          input_audio_transcription: {
            model: "whisper-1",
            language: "en",
            prompt: "Focus on accurate transcription of speech",
            sampling_rate: 16000
          },
          turn_detection: {
            type: "server_vad",
            threshold: 0.5,
            prefix_padding_ms: 300,
            silence_duration_ms: 800,
            max_timeout_ms: 2000
          }
        }),
      }).then(response => response.json())
        .then(data => {
          if (!data.client_secret?.value) {
            console.error("No client secret in OpenAI response:", data);
            socket.close(1011, "Failed to get ephemeral token");
            return;
          }
          
          // Store the session ID
          sessionId = data.session_id;
          console.log("Session created with ID:", sessionId);
          
          // Send initial request with ephemeral token
          const EPHEMERAL_KEY = data.client_secret.value;
          openAISocket.send(`Authorization: Bearer ${EPHEMERAL_KEY}\r\n` +
                           'Content-Type: application/json\r\n' +
                           '\r\n');
          
          // Send token and session ID to client
          socket.send(JSON.stringify({ 
            type: "token_received",
            session_id: sessionId,
            message: "Connected to OpenAI" 
          }));
          
          // After receiving session.created event, we'll update the session
          openAISocket.addEventListener('message', function sessionCreatedHandler(event) {
            try {
              const data = JSON.parse(event.data);
              if (data.type === "session.created") {
                console.log("Session created, updating session config");
                
                // Update session with more detailed config
                const sessionUpdateEvent = {
                  event_id: "update_session_" + Date.now(),
                  type: "session.update",
                  session: {
                    modalities: ["text", "audio"],
                    instructions: "You are a helpful AI assistant specializing in providing accurate and clear information. Keep your responses concise and natural.",
                    voice: "alloy",
                    input_audio_format: "pcm16",
                    output_audio_format: "pcm16",
                    input_audio_transcription: {
                      model: "whisper-1",
                      language: "en"
                    },
                    turn_detection: {
                      type: "server_vad",
                      threshold: 0.5,
                      prefix_padding_ms: 300,
                      silence_duration_ms: 1000,
                      max_timeout_ms: 2000
                    }
                  }
                };
                
                openAISocket.send(JSON.stringify(sessionUpdateEvent));
                openAISocket.removeEventListener('message', sessionCreatedHandler);
              }
            } catch (error) {
              console.error("Error processing session.created:", error);
            }
          });
        })
        .catch(error => {
          console.error("Error getting ephemeral token:", error);
          socket.close(1011, "Failed to get ephemeral token");
        });
    };

    // Forward messages from client to OpenAI
    socket.onmessage = (event) => {
      if (openAISocket.readyState === WebSocket.OPEN) {
        console.log("Forwarding message to OpenAI:", event.data.slice(0, 100) + "...");
        openAISocket.send(event.data);
      }
    };

    // Forward transcription results from OpenAI to client
    openAISocket.onmessage = (event) => {
      if (socket.readyState === WebSocket.OPEN) {
        console.log("Forwarding message from OpenAI to client");
        socket.send(event.data);
      }
    };

    // Handle errors and connection closure
    openAISocket.onerror = (event) => {
      console.error("OpenAI WebSocket error:", event);
      socket.close(1011, "OpenAI connection error");
    };

    socket.onerror = (event) => {
      console.error("Client WebSocket error:", event);
      openAISocket.close();
    };

    socket.onclose = (event) => {
      console.log("Client connection closed with code:", event.code, "reason:", event.reason);
      if (sessionId) {
        console.log("Cleaning up session:", sessionId);
        // Note: Session will auto-expire but we log it for tracking
      }
      openAISocket.close();
    };

    openAISocket.onclose = (event) => {
      console.log("OpenAI connection closed with code:", event.code, "reason:", event.reason);
      if (socket.readyState === WebSocket.OPEN) {
        socket.close(event.code, event.reason);
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
