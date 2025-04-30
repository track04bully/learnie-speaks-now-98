
// This Edge Function acts as a simple connection initializer
// It creates an OpenAI session and returns the client secret to the frontend
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import "https://deno.land/x/xhr@0.1.0/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  const { headers } = req;
  
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
    if (!OPENAI_API_KEY) {
      throw new Error("OPENAI_API_KEY is not set");
    }

    console.log("Creating OpenAI session...");
    
    // Get the session token only and return it to the client
    const sessionResponse = await fetch("https://api.openai.com/v1/realtime/sessions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-realtime-preview-2024-12-17",
        voice: "echo", // Using echo as the default voice
        instructions: "You are Learnie, a friendly and helpful AI tutor specialized in knowledge sharing for children. You're designed to be conversational, warm, and educational. You have a cheerful and supportive personality. Respond with simple language suitable for children. Always be enthusiastic and encouraging."
      }),
    });

    if (!sessionResponse.ok) {
      const errorText = await sessionResponse.text();
      console.error("Failed to create session:", errorText);
      throw new Error(`Failed to create OpenAI session: ${errorText}`);
    }

    const session = await sessionResponse.json();
    console.log("Session created successfully");

    // Return the session data to the client
    return new Response(JSON.stringify(session), {
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  } catch (error) {
    console.error("Error creating session:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
});
