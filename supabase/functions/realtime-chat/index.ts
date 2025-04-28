
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

    // Create WebSocket connection
    const { socket, response } = Deno.upgradeWebSocket(req)

    // Create connection to OpenAI
    const openAIUrl = "wss://api.openai.com/v1/realtime?model=gpt-4o-realtime-preview-2024-10-01"
    const openAISocket = new WebSocket(openAIUrl)
    
    // Handle opening of OpenAI connection
    openAISocket.onopen = () => {
      console.log("Connected to OpenAI")
      
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

    // Handle errors
    openAISocket.onerror = (error) => {
      console.error("OpenAI WebSocket error:", error)
      socket.close(1011, "Error connecting to OpenAI")
    }

    socket.onerror = (error) => {
      console.error("Client WebSocket error:", error)
      openAISocket.close(1011, "Client connection error")
    }

    // Clean up
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
