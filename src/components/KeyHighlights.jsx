import React from 'react';
import { motion } from 'framer-motion';
import { Zap } from 'lucide-react';

export default function KeyHighlights({ highlights = [] }) {
    if (!highlights || highlights.length === 0) return null;

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-gradient-to-r from-slate-50 to-amber-50/50 rounded-xl md:rounded-2xl p-4 md:p-6 border border-slate-100"
        >
            <div className="flex items-center gap-2 mb-3 md:mb-4">
                <Zap className="h-3.5 w-3.5 md:h-4 md:w-4 text-amber-500" />
                <h3 className="font-semibold text-slate-900 text-sm md:text-base">Key Takeaways</h3>
            </div>
            <ul className="space-y-2.5 md:space-y-3">
                {highlights.map((highlight, index) => (
                    <motion.li
                        key={index}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: index * 0.1 }}
                        className="flex items-start gap-2 md:gap-3"
                    >
                        <div className="w-1.5 h-1.5 rounded-full bg-amber-400 mt-1.5 md:mt-2 flex-shrink-0" />
                        <p className="text-slate-700 text-xs md:text-sm leading-relaxed">{highlight}</p>
                    </motion.li>
                ))}
            </ul>
        </motion.div>
    );
}
