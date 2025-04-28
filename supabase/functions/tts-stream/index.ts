
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

  try {
    const { text } = await req.json()
    const voiceId = Deno.env.get('ELEVEN_LABS_VOICE_ID')
    const apiKey = Deno.env.get('ELEVEN_LABS_API_KEY')

    if (!text) {
      throw new Error('Text is required')
    }

    const response = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}/stream`,
      {
        method: 'POST',
        headers: {
          'Accept': 'audio/mpeg',
          'xi-api-key': apiKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text,
          model_id: 'eleven_monolingual_v1',
          voice_settings: {
            stability: 0.8,
            similarity_boost: 0.7,
          }
        }),
      }
    )

    if (!response.ok) {
      throw new Error('Failed to get audio stream')
    }

    // Stream the response directly back to the client
    return new Response(response.body, {
      headers: {
        ...corsHeaders,
        'Content-Type': 'audio/mpeg',
      },
    })
  } catch (error) {
    console.error('Error in tts-stream function:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  }
})
