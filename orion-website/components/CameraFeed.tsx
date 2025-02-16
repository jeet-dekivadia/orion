"use client";

import { useEffect, useRef, useState } from "react";
import axios from "axios";
import { motion } from "framer-motion";

const GROQ_API_KEY = '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';

export default function CameraFeed() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [description, setDescription] = useState<string>("");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const analysisIntervalRef = useRef<NodeJS.Timeout>();

  useEffect(() => {
    startCamera();
    return () => {
      stopCamera();
      if (analysisIntervalRef.current) {
        clearInterval(analysisIntervalRef.current);
      }
    };
  }, []);

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { 
          facingMode: "environment",
          width: { ideal: 1280 },
          height: { ideal: 720 }
        } 
      });
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        startAnalysisLoop();
      }
    } catch (error) {
      console.error("Error accessing camera:", error);
      setDescription("Error: Unable to access camera. Please check permissions.");
    }
  };

  const stopCamera = () => {
    const stream = videoRef.current?.srcObject as MediaStream;
    stream?.getTracks().forEach(track => track.stop());
  };

  const captureFrame = (): string | null => {
    if (!videoRef.current || !canvasRef.current) return null;

    const canvas = canvasRef.current;
    const video = videoRef.current;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;

    ctx.drawImage(video, 0, 0);
    return canvas.toDataURL("image/jpeg").split(",")[1];
  };

  const analyzeImage = async (base64Image: string): Promise<string> => {
    try {
      const response = await axios.post(
        'https://api.groq.com/openai/v1/chat/completions',
        {
          messages: [
            {
              role: "user",
              content: [
                {
                  type: "text",
                  text: "What is happening in this scene? Describe in one clear, concise sentence."
                },
                {
                  type: "image_url",
                  image_url: {
                    url: `data:image/jpeg;base64,${base64Image}`,
                  },
                },
              ],
            }
          ],
          model: "llama-3.2-11b-vision-preview",
          temperature: 0.7,
          max_tokens: 200,
        },
        {
          headers: {
            'Authorization': `Bearer ${GROQ_API_KEY}`,
            'Content-Type': 'application/json'
          }
        }
      );

      return response.data.choices[0].message.content;
    } catch (error) {
      console.error('Error analyzing image:', error);
      throw error;
    }
  };

  const generateSpeech = async (text: string): Promise<Blob> => {
    try {
      const response = await axios.post(
        'https://api.groq.com/openai/v1/audio/speech',
        {
          input: text,
          model: "whisper-large-v3",
          voice: "nova",
          speed: 1.0
        },
        {
          headers: {
            'Authorization': `Bearer ${GROQ_API_KEY}`,
            'Content-Type': 'application/json'
          },
          responseType: 'blob'
        }
      );

      return response.data;
    } catch (error) {
      console.error('Error generating speech:', error);
      throw error;
    }
  };

  const startAnalysisLoop = () => {
    analysisIntervalRef.current = setInterval(async () => {
      if (isAnalyzing) return;

      const frame = captureFrame();
      if (!frame) return;

      setIsAnalyzing(true);
      try {
        // Analyze the scene
        const newDescription = await analyzeImage(frame);
        
        if (newDescription !== description) {
          setDescription(newDescription);
          
          // Generate and play audio description
          const audioBlob = await generateSpeech(newDescription);
          const audioUrl = URL.createObjectURL(audioBlob);
          
          if (audioRef.current) {
            audioRef.current.src = audioUrl;
            await audioRef.current.play();
          }
        }
      } catch (error) {
        console.error("Error in analysis loop:", error);
        setDescription("Error analyzing scene. Please try again.");
      } finally {
        setIsAnalyzing(false);
      }
    }, 3000);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative rounded-lg overflow-hidden"
      >
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className="w-full h-auto"
        />
        <canvas ref={canvasRef} className="hidden" />
      </motion.div>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="bg-primary-800/50 p-6 rounded-lg backdrop-blur-sm"
      >
        <h2 className="text-2xl font-bold mb-3 text-primary-100">Scene Description:</h2>
        <p className="text-xl text-primary-100">
          {description || "Analyzing scene..."}
        </p>
      </motion.div>

      <audio ref={audioRef} className="hidden" />
    </div>
  );
} 