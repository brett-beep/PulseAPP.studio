import React from 'react';
import { motion } from 'framer-motion';
import { Zap } from 'lucide-react';

// Force rebuild - updated styling v2
export default function KeyHighlights({ highlights = [] }) {
    if (!highlights || highlights.length === 0) return null;

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-gradient-to-r from-slate-50 to-amber-50/50 rounded-2xl p-6 border border-slate-100"
        >
            <div className="flex items-center gap-2 mb-4">
                <Zap className="h-4 w-4 text-amber-500" />
                <h3 className="font-semibold text-slate-900">Key Takeaways</h3>
            </div>
            <ul className="space-y-4">
                {highlights.map((highlight, index) => {
                    // Parse highlight - handles BOTH formats:
                    // 1. "**Title:** content" (with asterisks)
                    // 2. "**Title**: content" (asterisks around title only)
                    // 3. "Title: content" (no asterisks at all)
                    let title = null;
                    let content = highlight;

                    // Try format with ** first
                    const asteriskMatch = highlight.match(/^\*\*([^*]+?)\*\*\s*:?\s*(.+)$/s);
                    if (asteriskMatch) {
                        title = asteriskMatch[1].replace(/:$/, '').trim();
                        content = asteriskMatch[2].trim();
                    } else {
                        // Try plain "Title: content" - title is typically short (under 60 chars) before the colon
                        const plainMatch = highlight.match(/^([A-Z][^:]{3,55}):\s+(.+)$/s);
                        if (plainMatch) {
                            title = plainMatch[1].trim();
                            content = plainMatch[2].trim();
                        }
                    }

                    return (
                        <motion.li
                            key={index}
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: index * 0.1 }}
                            className="flex items-start gap-3"
                        >
                            <div className="w-1.5 h-1.5 rounded-full bg-amber-400 mt-2 flex-shrink-0" />
                            {title ? (
                                <div className="flex-1 space-y-1">
                                    <div className="inline-flex items-center gap-2">
                                        <span className="font-semibold text-orange-600 text-sm tracking-wide">{title}</span>
                                        <span className="text-orange-400 text-xs">&bull;</span>
                                    </div>
                                    <p className="text-slate-600 text-sm leading-relaxed">{content.replace(/\*\*/g, '')}</p>
                                </div>
                            ) : (
                                <p className="text-slate-700 text-sm leading-relaxed flex-1">{highlight.replace(/\*\*/g, '')}</p>
                            )}
                        </motion.li>
                    );
                })}
            </ul>
        </motion.div>
    );
}