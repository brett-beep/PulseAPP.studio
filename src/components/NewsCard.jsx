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
const whyItMattersText = stripLinksAndUrls(story.why_it_matters || story.relevance_reason || '');

    
    const needsExpansion = descriptionText.length > 150;

    return (
        <article
            className="group bg-white rounded-2xl p-6 shadow-sm hover:shadow-xl transition-all duration-300 border border-slate-100 flex flex-col"
            style={{ alignSelf: 'flex-start' }}
        >
            {/* Header */}
            <div className="flex items-start justify-between gap-4 mb-4 flex-shrink-0">
                <Badge 
                    variant="outline" 
                    className={`${getCategoryColor(story.category)} text-xs font-medium tracking-wide uppercase`}
                >
                    {story.category || 'News'}
                </Badge>
                <span className="text-xs text-slate-400 font-medium whitespace-nowrap">{story.outlet || story.source}</span>
            </div>

            {/* Title */}
            <h3 className="text-lg font-semibold text-slate-900 mb-2 leading-tight group-hover:text-amber-600 transition-colors line-clamp-2 flex-shrink-0">
                {story.title}
            </h3>

            {/* Description (What Happened) - TRUNCATED until expanded */}
            <div className="mb-4">
                {isExpanded ? (
                    <p className="text-slate-600 text-sm leading-relaxed">{descriptionText}</p>
                ) : (
                    <p className="text-slate-600 text-sm leading-relaxed line-clamp-3">{descriptionText}</p>
                )}
                
                {needsExpansion && (
                    <button
                        onClick={() => setIsExpanded(!isExpanded)}
                        className="text-xs font-medium text-amber-600 hover:text-amber-700 transition-colors mt-2"
                    >
                        {isExpanded ? '← Show less' : 'Read more →'}
                    </button>
                )}
            </div>

            {/* Why It Matters - NEVER TRUNCATED */}
            {whyItMattersText && (
                <div className="pt-4 border-t border-slate-100 mt-auto">
                    <div className="flex items-start gap-2">
                        <div className="w-1 h-1 bg-amber-400 rounded-full mt-2 flex-shrink-0" />
                        <p className="text-xs text-slate-500 italic leading-relaxed">
                            {whyItMattersText}
                        </p>
                    </div>
                </div>
            )}
        </article>
    );
}