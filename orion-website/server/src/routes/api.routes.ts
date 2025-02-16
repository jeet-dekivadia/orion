import { Router } from 'express';
import { VisionController } from '../controllers/vision.controller';

const router = Router();
const visionController = new VisionController();

router.post('/vision/analyze', visionController.analyzeImage);
router.post('/vision/speech', visionController.generateSpeech);
router.post('/vision/compare', visionController.compareScenes);

export default router; 