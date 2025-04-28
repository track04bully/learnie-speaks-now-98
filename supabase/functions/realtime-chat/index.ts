import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import "https://deno.land/x/xhr@0.1.0/mod.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Rich system prompt that defines the AI assistant's personality and behavior
const SYSTEM_PROMPT = `
You are Learnie, a fun and friendly AI assistant designed to help kids learn and explore the world.
Your personality is:
- Enthusiastic and encouraging
- Patient and understanding
- Creative and imaginative
- Educational but never condescending
- Always age-appropriate and safe

When speaking with children:
- Use simple language for younger kids, more advanced for older ones
- Ask questions to encourage critical thinking
- Praise efforts and good questions
- If you don't know something, say so honestly
- Avoid giving any harmful, dangerous, or inappropriate information

Your goal is to spark curiosity and a love of learning!
`;

// Context storage for persistent memory across turns
const sessionContexts = new Map();

// Function to check content using OpenAI's moderation API
async function moderateContent(text: string): Promise<boolean> {
  try {
    const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
    if (!OPENAI_API_KEY) throw new Error('OpenAI API key not found');

    const response = await fetch('https://api.openai.com/v1/moderations', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ input: text }),
    });

    if (!response.ok) {
      console.error('Moderation API error:', await response.text());
      return false; // Allow content if moderation API fails
    }

    const data = await response.json();
    return !data.results[0].flagged;
  } catch (error) {
    console.error('Content moderation error:', error);
    return false; // Allow content if moderation fails
  }
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
            silence_duration_ms: 800
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
            silence_duration_ms: 800
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
          
          // Create a context for this session
          if (sessionId && !sessionContexts.has(sessionId)) {
            sessionContexts.set(sessionId, {
              messageHistory: [],
              lastActivity: Date.now()
            });
            console.log("Created memory context for session:", sessionId);
          }
          
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
                console.log("Session created, updating session config with rich system prompt");
                
                // Update session with more detailed config and rich system prompt
                const sessionUpdateEvent = {
                  event_id: "update_session_" + Date.now(),
                  type: "session.update",
                  session: {
                    modalities: ["text", "audio"],
                    instructions: SYSTEM_PROMPT,
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
                      silence_duration_ms: 1000
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

    // Forward messages from client to OpenAI with content moderation
    socket.onmessage = async (event) => {
      if (openAISocket.readyState === WebSocket.OPEN) {
        try {
          const message = JSON.parse(event.data);
          
          // Check for text content that needs moderation
          if (message.type === "input_audio_transcript.update" && message.transcript) {
            const isAppropriate = await moderateContent(message.transcript);
            if (!isAppropriate) {
              console.log("Content flagged as inappropriate:", message.transcript);
              socket.send(JSON.stringify({
                type: "moderation.violation",
                message: "I'm sorry, but I cannot process that request as it may contain inappropriate content."
              }));
              return;
            }
          }
          
          // Store transcripts in session memory if appropriate
          if (message.type === "input_audio_transcript.update" && sessionId) {
            const context = sessionContexts.get(sessionId);
            if (context) {
              context.messageHistory.push({
                role: "user",
                content: message.transcript || "",
                timestamp: Date.now()
              });
              context.lastActivity = Date.now();
              
              if (context.messageHistory.length > 20) {
                context.messageHistory.shift();
              }
            }
          }
          
          console.log("Forwarding message to OpenAI:", event.data.slice(0, 100) + "...");
        } catch (error) {
          console.log("Non-JSON message forwarded to OpenAI");
        }
        
        openAISocket.send(event.data);
      }
    };

    // Forward messages from OpenAI to client with content moderation
    openAISocket.onmessage = async (event) => {
      if (socket.readyState === WebSocket.OPEN) {
        try {
          const data = JSON.parse(event.data);
          
          // Moderate AI responses
          if (data.type === "response.audio_transcript.delta") {
            const isAppropriate = await moderateContent(data.delta || "");
            if (!isAppropriate) {
              console.log("AI response flagged as inappropriate:", data.delta);
              socket.send(JSON.stringify({
                type: "moderation.violation",
                message: "I apologize, but I need to rephrase my response to ensure it's appropriate."
              }));
              return;
            }
            
            // Store assistant responses in session memory
            if (sessionId) {
              const context = sessionContexts.get(sessionId);
              if (context) {
                let lastMessage = context.messageHistory.length > 0 ? 
                  context.messageHistory[context.messageHistory.length - 1] : null;
                  
                if (!lastMessage || lastMessage.role !== "assistant") {
                  context.messageHistory.push({
                    role: "assistant",
                    content: data.delta || "",
                    timestamp: Date.now()
                  });
                } else {
                  lastMessage.content += data.delta || "";
                  lastMessage.timestamp = Date.now();
                }
                
                context.lastActivity = Date.now();
              }
            }
          }
          
          console.log("Forwarding message from OpenAI to client");
        } catch (error) {
          console.log("Non-JSON message forwarded to client");
        }
        
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
        // We keep the session context for a while in case the user reconnects
        setTimeout(() => {
          if (sessionContexts.has(sessionId)) {
            console.log("Removing inactive session context:", sessionId);
            sessionContexts.delete(sessionId);
          }
        }, 30 * 60 * 1000); // Keep context for 30 minutes
      }
      openAISocket.close();
    };

    openAISocket.onclose = (event) => {
      console.log("OpenAI connection closed with code:", event.code, "reason:", event.reason);
      if (socket.readyState === WebSocket.OPEN) {
        socket.close(event.code, event.reason);
      }
    };

    // Set up a regular cleanup task to remove old session contexts
    setInterval(() => {
      const now = Date.now();
      const expiryTime = 30 * 60 * 1000; // 30 minutes
      
      for (const [sessionId, context] of sessionContexts.entries()) {
        if (now - context.lastActivity > expiryTime) {
          console.log("Removing expired session context:", sessionId);
          sessionContexts.delete(sessionId);
        }
      }
    }, 5 * 60 * 1000); // Run every 5 minutes

    return response;
  } catch (error) {
    console.error("Error setting up WebSocket connection:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
