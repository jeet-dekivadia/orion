"use client";

import CameraFeed from "@/components/CameraFeed";
import { motion } from "framer-motion";

export default function CameraPage() {
  return (
    <div className="min-h-screen bg-primary-900 text-primary-100">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="container mx-auto px-4 py-8"
      >
        <CameraFeed />
      </motion.div>
    </div>
  );
} 