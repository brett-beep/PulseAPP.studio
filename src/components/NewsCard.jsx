import React, { useState } from 'react';
import { Badge } from "@/components/ui/badge";
import { track } from "@/components/lib/analytics";

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

  // Remove exchange-prefixed ticker tags in parentheses: (NASDAQ:GOOGL), (NYSE:AAPL), etc.
  t = t.replace(/\(\s*(NASDAQ|NYSE|AMEX)\s*:\s*[A-Z.\-]+\s*\)/gi, "");

  // Remove source tagging inside summaries: "(Source: Bloomberg)" / "Source: Bloomberg"
  t = t.replace(/\(\s*source\s*:\s*[^)]+\)/gi, "");
  t = t.replace(/\bsource\s*:\s*[^.;,\n]+/gi, "");

  return t.trim();
}

export default function NewsCard({ story, index }) {
    const [isExpanded, setIsExpanded] = useState(false);

    const getCategoryColor = (category) => {
        const cat = category?.toLowerCase() || 'default';
        return categoryColors[cat] || categoryColors.default;
    };

    const descriptionText = stripLinksAndUrls(story.what_happened || story.summary || '');
    const bullCase = stripLinksAndUrls(story.bull_case || '');
    const bearCase = stripLinksAndUrls(story.bear_case || '');
    // Legacy fallback for cached stories that still have why_it_matters
    const legacyTakeaway = !bullCase && !bearCase ? stripLinksAndUrls(story.why_it_matters || '') : '';

    const expandedText = descriptionText;
    const needsExpansion = descriptionText.length > 100;

    return (
        <article
            className="group rounded-xl md:rounded-2xl p-4 md:p-5 transition-all duration-300 hover:scale-[1.01] news-card-glass"
        >
            {/* Header Row */}
            <div className="flex items-center justify-between gap-2 md:gap-3 mb-2 md:mb-3">
                <Badge 
                    variant="outline" 
                    className={`${getCategoryColor(story.category)} text-[9px] md:text-[10px] font-semibold tracking-wider uppercase px-1.5 md:px-2 py-0.5`}
                >
                    {story.category || 'News'}
                </Badge>
            </div>

            {/* Title */}
            <h3 className="text-sm md:text-base font-semibold text-slate-800 dark:text-neutral-100 mb-2 leading-snug group-hover:text-amber-600 dark:group-hover:text-amber-400 transition-colors line-clamp-2 md:line-clamp-none">
                {story.title}
            </h3>

            {/* Description */}
            <div className="mb-2 md:mb-3">
                {isExpanded ? (
                    <p className="text-slate-600 dark:text-neutral-400 text-xs md:text-sm leading-relaxed">{expandedText}</p>
                ) : (
                    <p className="text-slate-500 dark:text-neutral-400 text-xs md:text-sm leading-relaxed line-clamp-3">{descriptionText}</p>
                )}
                {needsExpansion && (
                    <button
                        type="button"
                        onClick={(e) => {
                            e.stopPropagation();
                            e.preventDefault();
                            if (!isExpanded) {
                              track("news_card_clicked", {
                                story_id: story.id || `story_${index}`,
                                story_type: story.category || "unknown",
                              });
                            }
                            setIsExpanded(!isExpanded);
                        }}
                        className="text-xs md:text-sm font-medium text-amber-600 hover:text-amber-700 dark:text-amber-400 dark:hover:text-amber-300 transition-colors mt-1.5 md:mt-2 inline-flex items-center gap-1"
                    >
                        {isExpanded ? "Show less" : "Read more"}
                    </button>
                )}
            </div>

            {/* Why It Matters */}
            {whyItMattersText && (
                <div className="pt-2 md:pt-3 border-t border-slate-100/80 dark:border-neutral-700/50">
                    <div className="flex items-start gap-2">
                        <div className="w-1 h-1 bg-amber-400 rounded-full mt-[6px] md:mt-[7px] flex-shrink-0" />
                        <p className="text-[11px] md:text-xs text-slate-500 dark:text-neutral-500 leading-relaxed">
                            {whyItMattersText}
                        </p>
                    </div>
                </div>
            )}
        </article>
    );
}