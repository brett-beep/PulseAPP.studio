import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useIsMobile } from '@/hooks/use-mobile';
import { getTheme, getThemeEventName } from '@/lib/theme';

export default function AmbientAurora() {
  const isMobile = useIsMobile();
  const [theme, setTheme] = useState(getTheme);

  useEffect(() => {
    const handler = () => setTheme(getTheme());
    window.addEventListener(getThemeEventName(), handler);
    return () => window.removeEventListener(getThemeEventName(), handler);
  }, []);

  const isDark = theme === 'dark';

  if (isMobile) {
    return (
      <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
        <div className="amb-orb amb-orb-a" />
        <div className="amb-orb amb-orb-b" />
        <div className="amb-orb amb-orb-c" />
      </div>
    );
  }

  const orb1 = isDark
    ? 'radial-gradient(circle, rgba(80, 90, 140, 0.2) 0%, rgba(80, 90, 140, 0.06) 40%, transparent 70%)'
    : 'radial-gradient(circle, rgba(255, 200, 120, 0.6) 0%, rgba(255, 200, 120, 0.2) 35%, transparent 70%)';
  const orb2 = isDark
    ? 'radial-gradient(circle, rgba(180, 100, 60, 0.12) 0%, rgba(180, 100, 60, 0.04) 40%, transparent 75%)'
    : 'radial-gradient(circle, rgba(255, 140, 90, 0.5) 0%, rgba(255, 140, 90, 0.15) 40%, transparent 75%)';

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
          background: orb1,
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
          background: orb2,
          filter: "blur(70px)",
        }}
      />
    </div>
  );
}
