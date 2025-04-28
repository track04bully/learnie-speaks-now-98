
export interface LearnieCallback {
  onSpeakingChange: (isSpeaking: boolean) => void;
  onError?: (message: string) => void;
}

export interface SessionConfig {
  modalities: string[];
  instructions: string;
  voice: string;
  input_audio_format: string;
  output_audio_format: string;
  input_audio_transcription: {
    model: string;
  };
  turn_detection: {
    type: string;
    threshold: number;
    prefix_padding_ms: number;
    silence_duration_ms: number;
  };
  temperature: number;
  max_response_output_tokens: string;
}
