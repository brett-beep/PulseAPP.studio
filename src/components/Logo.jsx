import React from 'react';
import PropTypes from 'prop-types';

/**
 * PulseApp Logo Component
 * 
 * A reusable logo component that uses the existing pulse-logo.svg file
 * 
 * @param {number} height - Height of the logo in pixels (default: 32)
 * @param {boolean} showText - Whether to show "PulseApp" text (default: true)
 * @param {string} className - Additional CSS classes
 */
export default function Logo({ height = 32, showText = true, className = '' }) {
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

Logo.propTypes = {
  height: PropTypes.number,
  showText: PropTypes.bool,
  className: PropTypes.string,
};
