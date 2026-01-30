import React from 'react';

interface LogoProps {
  /** Height of the logo in pixels (default: 32) */
  height?: number;
  /** Whether to show "PulseApp" text (default: true) */
  showText?: boolean;
  /** Additional CSS classes */
  className?: string;
}

/**
 * PulseApp Logo Component
 * 
 * A professional, reusable logo component with a pulse/heartbeat icon
 * and optional text. Scales proportionally based on height prop.
 * 
 * @example
 * <Logo height={32} /> // Standard size with text
 * <Logo height={24} showText={false} /> // Icon only
 * <Logo height={48} className="mb-4" /> // Large with margin
 */
export default function Logo({ 
  height = 32, 
  showText = true, 
  className = '' 
}: LogoProps) {
  const textSize = Math.round(height * 0.7);
  
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      {/* Pulse Icon */}
      <svg
        width={height}
        height={height}
        viewBox="0 0 48 48"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-label="PulseApp logo"
      >
        {/* Circle outline */}
        <circle
          cx="24"
          cy="24"
          r="20"
          stroke="#FF6B35"
          strokeWidth="2"
          fill="none"
        />
        
        {/* Pulse/heartbeat line */}
        <path
          d="M 8 24 L 14 24 L 16 28 L 18 20 L 22 28 L 24 16 L 26 28 L 30 20 L 32 28 L 34 24 L 40 24"
          stroke="#FF6B35"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
      </svg>
      
      {/* Text */}
      {showText && (
        <span
          className="font-serif font-semibold text-gray-900 leading-none"
          style={{ fontSize: `${textSize}px` }}
        >
          PulseApp
        </span>
      )}
    </div>
  );
}
