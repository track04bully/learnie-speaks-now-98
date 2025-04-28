
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import "https://deno.land/x/xhr@0.1.0/mod.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  const { headers } = req
  const upgradeHeader = headers.get("upgrade") || ""

  if (upgradeHeader.toLowerCase() !== "websocket") {
    return new Response("Expected WebSocket connection", { 
      status: 400,
      headers: corsHeaders
    })
  }

  try {
    const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY')
    if (!OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY is not set')
    }

    // Create WebSocket connection with required subprotocols
    const { socket, response } = Deno.upgradeWebSocket(req)

    // Create connection to OpenAI with required subprotocols
    const openAIUrl = "wss://api.openai.com/v1/realtime?model=gpt-4o-realtime-preview-2024-10-01"
    const openAISocket = new WebSocket(openAIUrl, [
      "realtime",
      `openai-insecure-api-key.${OPENAI_API_KEY}`,
      "openai-beta.realtime-v1"
    ])
    
    // Handle opening of OpenAI connection
    openAISocket.onopen = () => {
      console.log("Connected to OpenAI")
      
      // Send initial session configuration with an event ID
      const sessionConfig = {
        type: "session.update",
        event_id: `evt_${Date.now()}`,
        session: {
          modalities: ["text", "audio"],
          instructions: "You are a friendly learning companion who speaks clearly and simply.",
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
          temperature: 0.8,
          max_response_output_tokens: "inf"
        }
      }
      
      openAISocket.send(JSON.stringify(sessionConfig))
      console.log("Session configuration sent:", sessionConfig)
      
      // Forward messages from client to OpenAI
      socket.onmessage = async ({ data }) => {
        console.log("Received from client:", data)
        if (openAISocket.readyState === WebSocket.OPEN) {
          openAISocket.send(data)
        }
      }

      // Forward messages from OpenAI to client
      openAISocket.onmessage = ({ data }) => {
        console.log("Received from OpenAI:", data)
        if (socket.readyState === WebSocket.OPEN) {
          socket.send(data)
        }
      }
    }

    // Handle errors with detailed logging
    openAISocket.onerror = (error) => {
      console.error("OpenAI WebSocket error:", error)
      socket.close(1011, "Error connecting to OpenAI")
    }

    socket.onerror = (error) => {
      console.error("Client WebSocket error:", error)
      openAISocket.close(1011, "Client connection error")
    }

    // Clean up connections
    socket.onclose = () => {
      console.log("Client disconnected")
      if (openAISocket.readyState === WebSocket.OPEN) {
        openAISocket.close()
      }
    }

    openAISocket.onclose = () => {
      console.log("OpenAI disconnected")
      if (socket.readyState === WebSocket.OPEN) {
        socket.close()
      }
    }

    return response
  } catch (error) {
    console.error("Error:", error)
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})

