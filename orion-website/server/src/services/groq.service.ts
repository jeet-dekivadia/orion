import axios from 'axios';
import { config } from '../config';
import { VisionAnalysis, AudioResponse } from '@shared/types';

export class GroqService {
  private readonly client;

  constructor() {
    this.client = axios.create({
      baseURL: config.groqApiUrl,
      headers: {
        'Authorization': `Bearer ${config.groqApiKey}`,
        'Content-Type': 'application/json'
      }
    });
  }

  async analyzeImage(base64Image: string, query: string): Promise<VisionAnalysis> {
    try {
      const response = await this.client.post('/chat/completions', {
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: query },
              {
                type: 'image_url',
                image_url: {
                  url: `data:image/jpeg;base64,${base64Image}`,
                },
              },
            ],
          }
        ],
        model: 'llava-v1.5-7b-4096-preview',
        temperature: 0.7,
        max_tokens: 200,
      });

      if (!response.data.choices?.[0]?.message?.content) {
        throw new Error('Invalid response from Groq API');
      }

      return {
        result: response.data.choices[0].message.content,
        confidence: 0.95
      };
    } catch (error) {
      console.error('Error analyzing image:', error);
      throw error;
    }
  }

  async generateSpeech(text: string, voice: string = 'nova'): Promise<AudioResponse> {
    try {
      const response = await this.client.post('/audio/speech', {
        input: text,
        model: 'whisper-large-v3',
        voice,
        speed: 1.0
      });

      if (!response.data.audio) {
        throw new Error('Invalid response from Groq speech API');
      }

      return {
        audio: response.data.audio,
        duration: response.data.duration || 0
      };
    } catch (error) {
      console.error('Error generating speech:', error);
      throw error;
    }
  }

  async detectSceneChange(previousImage: string, currentImage: string): Promise<boolean> {
    try {
      const response = await this.client.post('/chat/completions', {
        messages: [
          {
            role: 'user',
            content: [
              { 
                type: 'text', 
                text: 'Compare these two images and respond with only "true" if they show significantly different scenes, or "false" if they are very similar.' 
              },
              {
                type: 'image_url',
                image_url: { url: `data:image/jpeg;base64,${previousImage}` },
              },
              {
                type: 'image_url',
                image_url: { url: `data:image/jpeg;base64,${currentImage}` },
              },
            ],
          }
        ],
        model: 'llava-v1.5-7b-4096-preview',
        temperature: 0.1,
        max_tokens: 10,
      });

      return response.data.choices[0].message.content.toLowerCase().includes('true');
    } catch (error) {
      console.error('Error detecting scene change:', error);
      return true; // Default to true to ensure we don't miss important changes
    }
  }
} 