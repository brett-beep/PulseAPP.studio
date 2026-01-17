import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Badge } from "@/components/ui/badge";
import StoryPlayerPanel from '@/components/StoryPlayerPanel';

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
    const [isPanelOpen, setIsPanelOpen] = useState(false);
    
    const getCategoryColor = (category) => {
        const cat = category?.toLowerCase() || 'default';
        return categoryColors[cat] || categoryColors.default;
    };

    // Defensive rendering - always show something
    const title = story?.title || "Untitled story";
    const description = story?.what_happened || story?.summary || "Summary is generating. Click to open the story.";
    const why = story?.why_it_matters || story?.relevance_reason || null;
    const source = story?.outlet || story?.source || "Unknown";

    return (
        <>
            <motion.article
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
                whileHover={{ y: -4 }}
                onClick={() => setIsPanelOpen(true)}
                className="group bg-white rounded-2xl p-6 shadow-sm hover:shadow-xl transition-all duration-300 border border-slate-100 cursor-pointer"
            >
                <div className="flex items-start justify-between gap-4 mb-4">
                    <Badge 
                        variant="outline" 
                        className={`${getCategoryColor(story?.category)} text-xs font-medium tracking-wide uppercase`}
                    >
                        {story?.category || 'News'}
                    </Badge>
                    <span className="text-xs text-slate-400 font-medium">{source}</span>
                </div>

                <h3 className="text-lg font-semibold text-slate-900 mb-2 leading-tight group-hover:text-amber-600 transition-colors">
                    {title}
                </h3>

                <p className="text-slate-600 text-sm leading-relaxed mb-4">
                    {description}
                </p>

                {why && (
                    <div className="pt-4 border-t border-slate-100">
                        <div className="flex items-center gap-2">
                            <div className="w-1 h-1 bg-amber-400 rounded-full" />
                            <p className="text-xs text-slate-500 italic">
                                {why}
                            </p>
                        </div>
                    </div>
                )}
            </motion.article>

            <StoryPlayerPanel 
                story={story} 
                isOpen={isPanelOpen} 
                onClose={() => setIsPanelOpen(false)} 
            />
        </>
    );
}