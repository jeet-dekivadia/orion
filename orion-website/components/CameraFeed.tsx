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
  const [error, setError] = useState<string | null>(null);

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
        // Start analysis immediately after camera starts
        await analyzeCurrentScene();
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
        'https://api.groq.com/v1/chat/completions',
        {
          messages: [
            {
              role: "user",
              content: [
                {
                  type: "text",
                  text: "Describe what you see in this scene in detail, including any people, objects, actions, and the environment. Be specific but concise."
                },
                {
                  type: "image_url",
                  image_url: {
                    url: `data:image/jpeg;base64,${base64Image}`,
                  }
                }
              ]
            }
          ],
          model: "llama-3.2-11b-vision-preview",
          temperature: 0.7,
          max_tokens: 300,
          top_p: 1,
          stream: false
        },
        {
          headers: {
            'Authorization': `Bearer ${GROQ_API_KEY}`,
            'Content-Type': 'application/json',
            'Accept': 'application/json'
          }
        }
      );

      if (!response.data?.choices?.[0]?.message?.content) {
        throw new Error('Invalid response format from Groq API');
      }

      return response.data.choices[0].message.content;
    } catch (error: any) {
      console.error('Error analyzing image:', error.response?.data || error.message);
      throw new Error('Failed to analyze image');
    }
  };

  const generateSpeech = async (text: string): Promise<Blob> => {
    try {
      const response = await axios.post(
        'https://api.groq.com/v1/audio/speech',
        {
          input: text,
          model: "tts-1",
          voice: "alloy",
          speed: 1.0
        },
        {
          headers: {
            'Authorization': `Bearer ${GROQ_API_KEY}`,
            'Content-Type': 'application/json',
            'Accept': 'audio/mpeg'
          },
          responseType: 'blob'
        }
      );

      return new Blob([response.data], { type: 'audio/mpeg' });
    } catch (error: any) {
      console.error('Error generating speech:', error.response?.data || error.message);
      throw new Error('Failed to generate speech');
    }
  };

  const analyzeCurrentScene = async () => {
    if (isAnalyzing) return;

    const frame = captureFrame();
    if (!frame) return;

    setIsAnalyzing(true);
    setError(null);
    
    try {
      const newDescription = await analyzeImage(frame);
      setDescription(newDescription);
      
      const audioBlob = await generateSpeech(newDescription);
      const audioUrl = URL.createObjectURL(audioBlob);
      
      if (audioRef.current) {
        audioRef.current.src = audioUrl;
        await audioRef.current.play();
        // Cleanup the URL after playing
        audioRef.current.onended = () => URL.revokeObjectURL(audioUrl);
      }
    } catch (error) {
      console.error("Error analyzing scene:", error);
      setError("Failed to analyze scene. Please try again.");
      setDescription("");
    } finally {
      setIsAnalyzing(false);
    }
  };

  const startAnalysisLoop = () => {
    // Analyze every 5 seconds instead of 2
    analysisIntervalRef.current = setInterval(analyzeCurrentScene, 5000);
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
        {isAnalyzing && (
          <div className="absolute top-4 right-4 bg-primary-500 text-white px-3 py-1 rounded-full text-sm">
            Analyzing...
          </div>
        )}
      </motion.div>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="bg-primary-800/50 p-6 rounded-lg backdrop-blur-sm"
      >
        <h2 className="text-2xl font-bold mb-3 text-primary-100">Scene Description:</h2>
        {error ? (
          <p className="text-red-400">{error}</p>
        ) : (
          <p className="text-xl text-primary-100">
            {description || "Analyzing scene..."}
          </p>
        )}
      </motion.div>

      <audio ref={audioRef} className="hidden" />
    </div>
  );
} 