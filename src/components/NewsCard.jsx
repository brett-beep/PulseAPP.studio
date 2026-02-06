import React, { useState } from 'react';
import { Badge } from "@/components/ui/badge";

const categoryColors = {
    'markets': 'bg-blue-500/10 text-blue-400 border-blue-500/20',
    'crypto': 'bg-purple-500/10 text-purple-400 border-purple-500/20',
    'economy': 'bg-green-500/10 text-green-400 border-green-500/20',
    'technology': 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20',
    'real estate': 'bg-orange-500/10 text-orange-400 border-orange-500/20',
    'commodities': 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20',
    'default': 'bg-slate-500/10 text-slate-400 border-slate-500/20'
};

function stripLinksAndUrls(s) {
  if (!s) return "";
  let t = String(s);

  // Remove markdown links: [text](url) → text
  t = t.replace(/\[([^\]]+)\]\((https?:\/\/[^\)]+)\)/g, "$1");

  // Remove raw URLs
  t = t.replace(/https?:\/\/\S+/gi, "");

  // Remove "(domain.com/...)" citations
  t = t.replace(
    /\(\s*[a-z0-9-]+\.(com|net|org|io|co|ca|ai|app)(?:\/[^)]*)?\s*\)/gi,
    ""
  );

  return t.trim();
}

export default function NewsCard({ story, index }) {
    const [isExpanded, setIsExpanded] = useState(false);

    const getCategoryColor = (category) => {
        const cat = category?.toLowerCase() || 'default';
        return categoryColors[cat] || categoryColors.default;
    };

    const descriptionText = stripLinksAndUrls(story.what_happened || story.summary || '');
    const whyItMattersText = stripLinksAndUrls(story.why_it_matters || '');

    const EXPANDED_MAX_CHARS = 450;
    const expandedText = descriptionText.length > EXPANDED_MAX_CHARS
      ? descriptionText.slice(0, EXPANDED_MAX_CHARS).trim() + '…'
      : descriptionText;
    const needsExpansion = descriptionText.length > 100;

    return (
        <article
            className="group rounded-xl md:rounded-2xl p-4 md:p-5 transition-all duration-300 hover:scale-[1.01]"
            style={{ 
                background: 'rgba(255, 255, 255, 0.7)',
                backdropFilter: 'blur(20px)',
                WebkitBackdropFilter: 'blur(20px)',
                border: '1px solid rgba(148, 163, 184, 0.12)',
                boxShadow: '0 2px 12px -4px rgba(0, 0, 0, 0.06)',
            }}
        >
            {/* Header Row */}
            <div className="flex items-center justify-between gap-2 md:gap-3 mb-2 md:mb-3">
                <Badge 
                    variant="outline" 
                    className={`${getCategoryColor(story.category)} text-[9px] md:text-[10px] font-semibold tracking-wider uppercase px-1.5 md:px-2 py-0.5`}
                >
                    {story.category || 'News'}
                </Badge>
                <span className="text-[10px] md:text-[11px] text-slate-400 font-medium truncate max-w-[100px] md:max-w-[120px]" title={story.outlet || story.source}>
                    {story.outlet || story.source}
                </span>
            </div>

            {/* Title */}
            <h3 className="text-sm md:text-base font-semibold text-slate-800 mb-2 leading-snug group-hover:text-amber-600 transition-colors line-clamp-2 md:line-clamp-none">
                {story.title}
            </h3>

            {/* Description */}
            <div className="mb-2 md:mb-3">
                {isExpanded ? (
                    <p className="text-slate-600 text-xs md:text-sm leading-relaxed">{expandedText}</p>
                ) : (
                    <p className="text-slate-500 text-xs md:text-sm leading-relaxed line-clamp-3">{descriptionText}</p>
                )}
                {needsExpansion && (
                    <button
                        type="button"
                        onClick={(e) => {
                            e.stopPropagation();
                            e.preventDefault();
                            setIsExpanded(!isExpanded);
                        }}
                        className="text-xs md:text-sm font-medium text-amber-600 hover:text-amber-700 transition-colors mt-1.5 md:mt-2 inline-flex items-center gap-1"
                    >
                        {isExpanded ? "Show less" : "Read more"}
                    </button>
                )}
            </div>

            {/* Why It Matters */}
            {whyItMattersText && (
                <div className="pt-2 md:pt-3 border-t border-slate-100/80">
                    <div className="flex items-start gap-2">
                        <div className="w-1 h-1 bg-amber-400 rounded-full mt-[6px] md:mt-[7px] flex-shrink-0" />
                        <p className="text-[11px] md:text-xs text-slate-500 leading-relaxed">
                            {whyItMattersText}
                        </p>
                    </div>
                </div>
            )}
        </article>
    );
}