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

    const { socket, response } = Deno.upgradeWebSocket(req)

    const openAIUrl = "wss://api.openai.com/v1/realtime?model=gpt-4o-realtime-preview-2024-10-01"
    const openAISocket = new WebSocket(openAIUrl, [
      "realtime",
      `openai-insecure-api-key.${OPENAI_API_KEY}`,
      "openai-beta.realtime-v1"
    ])
    
    // Track connection state and success
    let sessionConfigSent = false
    let sessionConfigConfirmed = false
    let lastSentEvent = null
    let connectionTimeout = null
    
    openAISocket.onopen = () => {
      console.log("Connected to OpenAI")
      
      // Set a timeout to catch if we never get a response to our session config
      connectionTimeout = setTimeout(() => {
        if (sessionConfigSent && !sessionConfigConfirmed) {
          console.error("Session configuration timed out - no response received")
          socket.close(1011, "Connection setup failed - no response from OpenAI")
        }
      }, 5000)
      
      const sessionConfig = {
        type: "session.update",
        event_id: `evt_${Date.now()}`,
        session: {
          modalities: ["text", "audio"],
          instructions: "You are Learnie, a friendly and patient tutor for children. Always speak in simple, clear language that a child can understand. Be encouraging and supportive. If a concept is complex, break it down into smaller, easy-to-understand pieces. Use examples from everyday life that children can relate to. Never use complex vocabulary - if you need to introduce a new word, explain what it means in simple terms. Always maintain a positive, encouraging tone.",
          voice: "echo",
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
      
      try {
        openAISocket.send(JSON.stringify(sessionConfig))
        sessionConfigSent = true
        lastSentEvent = sessionConfig
        console.log("Session configuration sent:", sessionConfig)
      } catch (error) {
        console.error("Error sending session configuration:", error)
        socket.close(1011, "Failed to send session configuration")
      }
      
      socket.onmessage = async ({ data }) => {
        try {
          console.log("Received from client:", data)
          if (openAISocket.readyState === WebSocket.OPEN) {
            // For JSON messages, validate before sending
            if (typeof data === 'string' && data.startsWith('{')) {
              try {
                const jsonData = JSON.parse(data)
                lastSentEvent = jsonData
                console.log("Sending JSON to OpenAI:", jsonData)
                openAISocket.send(data)
              } catch (e) {
                console.error("Invalid JSON received from client:", e)
                socket.send(JSON.stringify({
                  type: "error",
                  message: "Invalid JSON format"
                }))
                return
              }
            } else {
              // For binary data like ArrayBuffer, it should be sent as JSON with input_audio_buffer.append
              console.error("Received non-JSON data from client - this is not supported")
              socket.send(JSON.stringify({
                type: "error",
                message: "Only JSON formatted messages are supported"
              }))
            }
          }
        } catch (error) {
          console.error("Error processing message from client:", error)
        }
      }

      openAISocket.onmessage = ({ data }) => {
        try {
          console.log("Received from OpenAI:", data)
          
          // Check if this is a response to our session config
          if (typeof data === 'string' && data.includes('"type":"session.')) {
            try {
              const response = JSON.parse(data)
              if (response.type === 'session.created' || response.type === 'session.updated') {
                clearTimeout(connectionTimeout)
                sessionConfigConfirmed = true
                console.log(`Session ${response.type} confirmed`)
              }
            } catch (e) {
              console.error("Failed to parse session response:", e)
            }
          }
          
          if (socket.readyState === WebSocket.OPEN) {
            socket.send(data)
          }
        } catch (error) {
          console.error("Error processing message from OpenAI:", error)
        }
      }
    }

    openAISocket.onerror = (error) => {
      console.error("OpenAI WebSocket error:", error)
      // If we sent an event but got an error immediately, it might be due to invalid JSON
      if (lastSentEvent) {
        console.error("Last sent event that might have caused the error:", lastSentEvent)
      }
      socket.close(1011, "Error connecting to OpenAI")
    }

    socket.onerror = (error) => {
      console.error("Client WebSocket error:", error)
      openAISocket.close(1011, "Client connection error")
    }

    socket.onclose = () => {
      clearTimeout(connectionTimeout)
      console.log("Client disconnected")
      if (openAISocket.readyState === WebSocket.OPEN) {
        openAISocket.close()
      }
    }

    openAISocket.onclose = () => {
      clearTimeout(connectionTimeout)
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
