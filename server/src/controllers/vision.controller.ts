import { Request, Response } from 'express';
import { GroqService } from '../services/groq.service';

const groqService = new GroqService();

export class VisionController {
  async analyzeImage(req: Request, res: Response) {
    try {
      const { image, query } = req.body;
      const result = await groqService.analyzeImage(image, query);
      res.json({ result });
    } catch (error) {
      res.status(500).json({ error: 'Failed to analyze image' });
    }
  }

  async generateSpeech(req: Request, res: Response) {
    try {
      const { text } = req.body;
      const audioData = await groqService.generateSpeech(text);
      
      // Set appropriate headers for audio streaming
      res.setHeader('Content-Type', 'audio/mpeg');
      res.setHeader('Content-Disposition', 'attachment; filename="description.mp3"');
      
      // Send the audio data as a buffer
      res.send(Buffer.from(audioData, 'base64'));
    } catch (error) {
      console.error('Error generating speech:', error);
      res.status(500).json({ error: 'Failed to generate speech' });
    }
  }

  async compareScenes(req: Request, res: Response) {
    try {
      const { previousImage, currentImage } = req.body;
      const hasChanged = await groqService.detectSceneChange(previousImage, currentImage);
      res.json({ hasChanged });
    } catch (error) {
      console.error('Error comparing scenes:', error);
      res.status(500).json({ error: 'Failed to compare scenes' });
    }
  }
} 