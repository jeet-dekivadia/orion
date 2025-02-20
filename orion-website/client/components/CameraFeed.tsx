"use client";

import { useEffect, useRef, useState } from "react";
import axios from "axios";
import { motion } from "framer-motion";
import { VisionAnalysis } from "../../../shared/types";

export default function CameraFeed() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [description, setDescription] = useState<string>("");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const previousImageRef = useRef<string>("");
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    startCamera();
    return () => {
      stopCamera();
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
      }
      
      const analysisCleanup = startAnalysisLoop();
      return () => {
        stopCamera();
        analysisCleanup();
      };
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

  const hasSignificantChange = async (newImage: string): Promise<boolean> => {
    if (!previousImageRef.current) return true;
    
    try {
      const response = await axios.post("http://localhost:3001/api/vision/compare", {
        previousImage: previousImageRef.current,
        currentImage: newImage
      });
      return response.data.hasChanged;
    } catch (error) {
      console.error("Error detecting scene change:", error);
      return true; // Default to true to ensure we don't miss important changes
    }
  };

  const startAnalysisLoop = () => {
    const intervalId = setInterval(async () => {
      if (isAnalyzing) return;

      const frame = captureFrame();
      if (!frame) return;

      const hasChanged = await hasSignificantChange(frame);
      if (hasChanged) {
        setIsAnalyzing(true);
        try {
          // Analyze the scene
          const visionResponse = await axios.post<VisionAnalysis>(
            "http://localhost:3001/api/vision/analyze", 
            {
              image: frame,
              query: "What is happening in this scene? Describe in one clear, concise sentence."
            }
          );

          setDescription(visionResponse.data.result);
          previousImageRef.current = frame;

          // Generate and play audio description
          const audioResponse = await axios.post(
            "http://localhost:3001/api/vision/speech",
            { text: visionResponse.data.result },
            { responseType: 'blob' }
          );

          const audioBlob = new Blob([audioResponse.data], { type: 'audio/mpeg' });
          const audioUrl = URL.createObjectURL(audioBlob);
          
          if (audioRef.current) {
            audioRef.current.src = audioUrl;
            await audioRef.current.play();
          }
        } catch (error) {
          console.error("Error in analysis loop:", error);
        } finally {
          setIsAnalyzing(false);
        }
      }
    }, 3000);

    return () => clearInterval(intervalId);
  };

  return (
    <div className="max-w-4xl mx-auto">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative rounded-lg overflow-hidden mb-4"
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
        className="bg-primary-800/50 p-4 rounded-lg backdrop-blur-sm"
      >
        <h2 className="text-xl font-bold mb-2 cyberpunk-text">Scene Description:</h2>
        <p className="text-primary-100">{description || "Analyzing scene..."}</p>
      </motion.div>

      <audio ref={audioRef} className="hidden" />
    </div>
  );
} 