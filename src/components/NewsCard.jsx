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

export default function NewsCard({ story, index }) {
    const [isExpanded, setIsExpanded] = useState(false);

    const getCategoryColor = (category) => {
        const cat = category?.toLowerCase() || 'default';
        return categoryColors[cat] || categoryColors.default;
    };

    // Get the description text
    const descriptionText = story.what_happened || story.summary || '';
    
    // Check if content needs expansion (more than ~120 chars will typically overflow 3 lines)
    // Lowered threshold since content is already truncated from backend
    const needsExpansion = descriptionText.length > 120;

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
                {story.outlet && (
                    <span className="text-xs text-slate-400 font-medium whitespace-nowrap">{story.outlet}</span>
                )}
            </div>

            {/* Title - Fixed to 2 lines with ellipsis */}
            <h3 className="text-lg font-semibold text-slate-900 mb-3 leading-tight group-hover:text-amber-600 transition-colors line-clamp-2 flex-shrink-0">
                {story.title}
            </h3>

            {/* Description - Expandable */}
            <div className="flex-shrink-0 mb-4">
                <p className="text-slate-600 text-sm leading-relaxed">
                    {needsExpansion ? (
                        <>
                            <span className={!isExpanded ? 'line-clamp-3' : ''}>
                                {descriptionText}
                            </span>
                            {!isExpanded && (
                                <span className="text-slate-400">... </span>
                            )}
                            <button
                                onClick={() => setIsExpanded(!isExpanded)}
                                className="text-xs font-semibold text-amber-500 hover:text-amber-600 transition-colors ml-1"
                            >
                                {isExpanded ? 'show less' : 'read more'}
                            </button>
                        </>
                    ) : (
                        descriptionText
                    )}
                </p>
            </div>

            {/* Impact/Why it matters - Always show full text (no truncation) */}
            {(story.relevance_reason || story.why_it_matters) && (
                <div className="pt-4 border-t border-slate-100 mt-auto">
                    <div className="flex items-start gap-2">
                        <div className="w-1.5 h-1.5 bg-amber-400 rounded-full mt-1.5 flex-shrink-0" />
                        <p className="text-xs text-slate-500 italic leading-relaxed">
                            {story.why_it_matters || story.relevance_reason}
                        </p>
                    </div>
                </div>
            )}
        </article>
    );
}