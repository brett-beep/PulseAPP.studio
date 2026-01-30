import React from 'react';
import PropTypes from 'prop-types';

/**
 * PulseApp Logo Component
 * 
 * @param {number} height - Height of the logo in pixels (default: 32)
 * @param {boolean} showText - Whether to show "PulseApp" text (default: true)
 * @param {string} className - Additional CSS classes
 */
export default function Logo({ height = 32, showText = true, className = '' }) {
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

Logo.propTypes = {
  height: PropTypes.number,
  showText: PropTypes.bool,
  className: PropTypes.string,
};
