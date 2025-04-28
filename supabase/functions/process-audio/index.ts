
// Follow Deno Edge Function conventions
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import "https://deno.land/x/xhr@0.1.0/mod.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Process base64 in chunks to prevent memory issues
function processBase64Chunks(base64String: string, chunkSize = 32768) {
  const chunks: Uint8Array[] = [];
  let position = 0;
  
  while (position < base64String.length) {
    const chunk = base64String.slice(position, position + chunkSize);
    const binaryChunk = atob(chunk);
    const bytes = new Uint8Array(binaryChunk.length);
    
    for (let i = 0; i < binaryChunk.length; i++) {
      bytes[i] = binaryChunk.charCodeAt(i);
    }
    
    chunks.push(bytes);
    position += chunkSize;
  }

  const totalLength = chunks.reduce((acc, chunk) => acc + chunk.length, 0);
  const result = new Uint8Array(totalLength);
  let offset = 0;

  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.length;
  }

  return result;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { audioData } = await req.json()

    if (!audioData) {
      throw new Error('Audio data is required')
    }

    console.log('Received audio data, length:', audioData.length)
    
    // Process audio in chunks
    const binaryAudio = processBase64Chunks(audioData)
    
    // Check if OpenAI API key is available
    const openaiApiKey = Deno.env.get('OPENAI_API_KEY')
    if (!openaiApiKey) {
      console.warn('OpenAI API key not found, returning demo response')
      return new Response(
        JSON.stringify({ 
          message: "I heard you! This is a demo response as the OpenAI API key is not configured.",
          status: "success"
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200
        }
      )
    }
    
    // Prepare form data for OpenAI API
    const formData = new FormData()
    const blob = new Blob([binaryAudio], { type: 'audio/webm' })
    formData.append('file', blob, 'audio.webm')
    formData.append('model', 'whisper-1')

    console.log('Sending audio to OpenAI Whisper API')
    
    // Send to OpenAI
    const transcriptionResponse = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiApiKey}`,
      },
      body: formData,
    })

    if (!transcriptionResponse.ok) {
      console.error('OpenAI API error:', await transcriptionResponse.text())
      throw new Error('Failed to transcribe audio')
    }

    const transcriptionResult = await transcriptionResponse.json()
    const transcribedText = transcriptionResult.text

    console.log('Transcribed text:', transcribedText)
    
    // Simple response for now - can be extended to use the transcribed text with an LLM
    const message = `I heard you say: "${transcribedText}"`
    
    return new Response(
      JSON.stringify({ 
        message,
        transcribedText,
        status: "success"
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      }
    )
  } catch (error) {
    console.error("Error processing audio:", error.message)
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400
      }
    )
  }
})
