import React from 'react';
import { motion } from 'framer-motion';
import { Zap } from 'lucide-react';

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
                    // Parse highlight with **Title**: format
                    const titleMatch = highlight.match(/^\*\*([^:*]+):\*\*\s*(.+)$/);
                    
                    return (
                        <motion.li
                            key={index}
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: index * 0.1 }}
                            className="flex items-start gap-3"
                        >
                            <div className="w-1.5 h-1.5 rounded-full bg-amber-400 mt-2 flex-shrink-0" />
                            {titleMatch ? (
                                <div className="flex-1 space-y-1">
                                    <div className="inline-flex items-center gap-2">
                                        <span className="font-semibold text-amber-700 text-sm tracking-wide">{titleMatch[1]}</span>
                                        <span className="text-amber-400 text-xs">•</span>
                                    </div>
                                    <p className="text-slate-600 text-sm leading-relaxed">{titleMatch[2]}</p>
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