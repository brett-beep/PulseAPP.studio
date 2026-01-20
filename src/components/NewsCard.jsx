// NewsCard.jsx - Fixed version
// Remove the h-[280px] constraint from non-expanded cards
// Only apply expansion animation to the selected card

import React from 'react';
import { motion } from 'framer-motion';

export default function NewsCard({ article, isExpanded, onToggle }) {
  const handleClick = () => {
    onToggle();
  };

  return (
    <motion.div
      layout
      initial={false}
      animate={isExpanded ? {
        scale: 1.02,
        zIndex: 10,
      } : {
        scale: 1,
        zIndex: 1,
      }}
      transition={{
        layout: { duration: 0.3, ease: "easeInOut" },
        scale: { duration: 0.2 }
      }}
      className={`
        relative rounded-2xl overflow-hidden cursor-pointer
        transition-all duration-300
        ${isExpanded ? 'col-span-full' : ''}
      `}
      onClick={handleClick}
    >
      {/* Glassmorphic background */}
      <div className="absolute inset-0 bg-white/10 backdrop-blur-md" />
      
      {/* Gradient border effect */}
      <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-blue-500/20 via-purple-500/20 to-pink-500/20 opacity-50" />
      
      {/* Content */}
      <div className="relative p-6 h-full flex flex-col">
        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              {article.source && (
                <span className="text-xs font-medium text-blue-400 uppercase tracking-wide">
                  {article.source}
                </span>
              )}
              {article.datetime && (
                <span className="text-xs text-gray-400">
                  {new Date(article.datetime * 1000).toLocaleDateString()}
                </span>
              )}
            </div>
            <h3 className="text-lg font-semibold text-white line-clamp-2 mb-2">
              {article.headline}
            </h3>
          </div>
        </div>

        {/* Summary - show more when expanded */}
        <motion.div
          layout
          className="flex-1"
        >
          <p className={`text-sm text-gray-300 ${isExpanded ? '' : 'line-clamp-3'}`}>
            {article.summary}
          </p>
        </motion.div>

        {/* Footer */}
        <div className="flex items-center justify-between mt-4 pt-4 border-t border-white/10">
          <div className="flex items-center gap-2">
            {article.related && article.related.length > 0 && (
              <span className="text-xs text-gray-400">
                {article.related.join(', ')}
              </span>
            )}
          </div>
          {article.url && (
            <a
              href={article.url}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="text-xs text-blue-400 hover:text-blue-300 transition-colors"
            >
              Read more →
            </a>
          )}
        </div>

        {/* Expand indicator */}
        <div className="absolute bottom-4 right-4">
          <motion.div
            animate={{ rotate: isExpanded ? 180 : 0 }}
            transition={{ duration: 0.2 }}
            className="text-gray-400"
          >
            ↓
          </motion.div>
        </div>
      </div>
    </motion.div>
  );
}