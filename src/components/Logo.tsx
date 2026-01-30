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
 * A reusable logo component that uses the existing pulse-logo.svg file
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
      {/* Logo SVG */}
      <img
        src="/pulse-logo.svg"
        alt="PulseApp logo"
        style={{ height: `${height}px`, width: 'auto' }}
      />
      
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
