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
    
    // Reduce dimensions to ensure smaller file size
    const maxDimension = 800;
    let width = video.videoWidth;
    let height = video.videoHeight;
    
    if (width > height) {
      if (width > maxDimension) {
        height = Math.round((height * maxDimension) / width);
        width = maxDimension;
      }
    } else {
      if (height > maxDimension) {
        width = Math.round((width * maxDimension) / height);
        height = maxDimension;
      }
    }
    
    canvas.width = width;
    canvas.height = height;
    
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;

    ctx.drawImage(video, 0, 0, width, height);
    
    // Use lower JPEG quality to reduce file size
    return canvas.toDataURL("image/jpeg", 0.8).split(",")[1];
  };

  const analyzeImage = async (base64Image: string): Promise<string> => {
    try {
      console.log('Sending request to Groq API...');
      
      // First, check the image size
      const imageSize = base64Image.length * 0.75; // Convert base64 length to bytes
      if (imageSize > 4 * 1024 * 1024) { // 4MB limit
        throw new Error('Image size exceeds 4MB limit. Please try with a smaller image.');
      }

      const response = await axios.post(
        'https://api.groq.com/openai/v1/chat/completions',
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
                    url: `data:image/jpeg;base64,${base64Image}`
                  }
                }
              ]
            }
          ],
          model: "llama-3.2-11b-vision-preview",  // Updated to correct model
          temperature: 0.7,
          max_tokens: 300,
          top_p: 1,
          stream: false
        },
        {
          headers: {
            'Authorization': `Bearer ${GROQ_API_KEY}`,
            'Content-Type': 'application/json'
          }
        }
      );

      console.log('Response from Groq:', response.data);

      if (!response.data?.choices?.[0]?.message?.content) {
        throw new Error('Invalid response format from Groq API');
      }

      return response.data.choices[0].message.content;
    } catch (error: any) {
      console.error('Error analyzing image:', {
        status: error.response?.status,
        data: error.response?.data,
        message: error.message
      });
      throw new Error(`Failed to analyze image: ${error.response?.data?.error?.message || error.message}`);
    }
  };

  const generateSpeech = async (text: string): Promise<void> => {
    return new Promise((resolve, reject) => {
      try {
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.rate = 1.0;
        utterance.pitch = 1.0;
        utterance.volume = 1.0;
        
        // Use a more natural voice if available
        const voices = window.speechSynthesis.getVoices();
        const preferredVoice = voices.find(voice => 
          voice.name.includes('Samantha') || // iOS/macOS
          voice.name.includes('Google US English') || // Chrome
          voice.name.includes('Microsoft David') // Windows
        );
        
        if (preferredVoice) {
          utterance.voice = preferredVoice;
        }

        utterance.onend = () => resolve();
        utterance.onerror = (error) => reject(error);

        window.speechSynthesis.speak(utterance);
      } catch (error) {
        reject(error);
      }
    });
  };

  const analyzeCurrentScene = async () => {
    if (isAnalyzing) return;

    const frame = captureFrame();
    if (!frame) {
      setError("Failed to capture frame from camera");
      return;
    }

    setIsAnalyzing(true);
    setError(null);
    
    try {
      console.log('Starting scene analysis...');
      const newDescription = await analyzeImage(frame);
      console.log('Got description:', newDescription);
      setDescription(newDescription);
      
      console.log('Generating speech...');
      await generateSpeech(newDescription);
    } catch (error: any) {
      console.error("Error in scene analysis:", error);
      setError(error.message || "Failed to analyze scene. Please try again.");
      setDescription("");
    } finally {
      setIsAnalyzing(false);
    }
  };

  const startAnalysisLoop = () => {
    // Analyze every 10 seconds to be safe with rate limits
    analysisIntervalRef.current = setInterval(analyzeCurrentScene, 10000);
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
    </div>
  );
} 