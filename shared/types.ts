export interface VisionAnalysis {
  result: string;
  confidence: number;
}

export interface AudioResponse {
  audio: string;
  duration: number;
}

export interface GroqVisionRequest {
  image: string;
  query: string;
}

export interface GroqSpeechRequest {
  text: string;
  voice?: string;
  speed?: number;
} 