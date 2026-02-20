import React from 'react';
import { motion } from 'framer-motion';

export default function AmbientAurora() {
  return (
    <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
      <motion.div
        className="absolute -top-1/2 -left-1/4 w-[800px] h-[800px] rounded-full opacity-20"
        animate={{
          x: [0, 100, -50, 0],
          y: [0, -80, 60, 0],
          scale: [1, 1.2, 0.9, 1],
        }}
        transition={{
          duration: 20,
          repeat: Infinity,
          ease: "easeInOut",
        }}
        style={{
          background: "radial-gradient(circle, rgba(255, 200, 120, 0.6) 0%, rgba(255, 200, 120, 0.2) 35%, transparent 70%)",
          filter: "blur(60px)",
        }}
      />
      <motion.div
        className="absolute -bottom-1/2 -right-1/4 w-[900px] h-[900px] rounded-full opacity-15"
        animate={{
          x: [0, -120, 80, 0],
          y: [0, 100, -60, 0],
          scale: [1, 0.9, 1.3, 1],
        }}
        transition={{
          duration: 25,
          repeat: Infinity,
          ease: "easeInOut",
          delay: 1,
        }}
        style={{
          background: "radial-gradient(circle, rgba(255, 140, 90, 0.5) 0%, rgba(255, 140, 90, 0.15) 40%, transparent 75%)",
          filter: "blur(70px)",
        }}
      />
    </div>
  );
}