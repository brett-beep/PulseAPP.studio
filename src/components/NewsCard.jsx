import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ExternalLink, TrendingUp, TrendingDown, Minus } from 'lucide-react';
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

    // Check if content is long enough to need "more" button
    const needsExpansion = (story.what_happened?.length > 200 || story.why_it_matters?.length > 150);

    return (
        <motion.article
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
            whileHover={{ y: -4 }}
            className="group bg-white rounded-2xl p-6 shadow-sm hover:shadow-xl transition-all duration-300 border border-slate-100 flex flex-col"
            style={{ alignSelf: 'flex-start' }}
        >
            {/* Header - Fixed height */}
            <div className="flex items-start justify-between gap-4 mb-4 flex-shrink-0">
                <Badge 
                    variant="outline" 
                    className={`${getCategoryColor(story.category)} text-xs font-medium tracking-wide uppercase`}
                >
                    {story.category || 'News'}
                </Badge>
                <span className="text-xs text-slate-400 font-medium whitespace-nowrap">{story.source}</span>
            </div>

            {/* Title - Fixed to 2 lines with ellipsis */}
            <h3 className="text-lg font-semibold text-slate-900 mb-2 leading-tight group-hover:text-amber-600 transition-colors line-clamp-2 flex-shrink-0">
                {story.title}
            </h3>

            {/* Description - Expandable with inline more button */}
            <div className="flex-shrink-0 mb-4">
                <motion.div
                    initial={false}
                    animate={{ 
                        height: isExpanded ? 'auto' : 'auto',
                    }}
                    transition={{ 
                        duration: 0.3,
                        ease: [0.25, 0.1, 0.25, 1]
                    }}
                    className="overflow-hidden"
                >
                    <p className={`text-slate-600 text-sm leading-relaxed inline ${!isExpanded ? 'line-clamp-3' : ''}`}>
                        {story.what_happened || story.summary}
                        {needsExpansion && !isExpanded && '... '}
                        {needsExpansion && (
                            <motion.button
                                onClick={() => setIsExpanded(!isExpanded)}
                                whileHover={{ scale: 1.05 }}
                                whileTap={{ scale: 0.95 }}
                                className="inline text-xs font-bold underline text-slate-500 hover:text-amber-500 transition-colors ml-0"
                            >
                                {isExpanded ? 'less' : 'more'}
                            </motion.button>
                        )}
                    </p>
                </motion.div>
            </div>

            {/* Impact - Expandable, pushes to bottom */}
            {(story.relevance_reason || story.why_it_matters) && (
                <div className="pt-4 border-t border-slate-100 mt-auto">
                    <div className="flex items-start gap-2">
                        <div className="w-1 h-1 bg-amber-400 rounded-full mt-1.5 flex-shrink-0" />
                        <motion.div
                            initial={false}
                            animate={{ 
                                height: isExpanded ? 'auto' : 'auto',
                            }}
                            transition={{ 
                                duration: 0.3,
                                ease: [0.25, 0.1, 0.25, 1]
                            }}
                            className="overflow-hidden flex-1"
                        >
                            <p className={`text-xs text-slate-500 italic ${!isExpanded ? 'line-clamp-2' : ''}`}>
                                {story.why_it_matters || story.relevance_reason}
                            </p>
                        </motion.div>
                    </div>
                </div>
            )}
        </motion.article>
    );
}