"use client";

import { useRouter } from "next/navigation";
import { motion } from "framer-motion";

// Update the figureContext function to use the new backend
async function figureContext(flag: number, base64Image: string): Promise<string> {
  try {
    const response = await axios.post('http://localhost:3001/api/vision/analyze', {
      image: base64Image,
      query: 'What is in this image? Give a two sentence summary.'
    });
    return response.data.result;
  } catch (error) {
    console.error('Error analyzing image:', error);
    throw error;
  }
} 

export default function Hero() {
  const router = useRouter();
  
  const handleTryNow = () => {
    router.push("/camera");
  };

  return (
    <motion.button
      onClick={handleTryNow}
    >
      Try Now
    </motion.button>
  );
} 