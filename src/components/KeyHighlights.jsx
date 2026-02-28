import React from 'react';
import { motion } from 'framer-motion';
import { Zap } from 'lucide-react';

// Parse "**Header:** rest of text" → { header: "Header", rest: "rest of text" }; else null
// Strips "Hook" as a header since it's an internal field name, not a display label.
function parseHighlight(highlight) {
    if (typeof highlight !== 'string') return null;
    const match = highlight.match(/^\*\*(.+?)\*\*:\s*(.*)$/s);
    if (match) {
        let header = match[1].trim();
        const rest = match[2].trim();
        // "Hook" is an internal field name — replace it with a meaningful label or just show the text
        if (header.toLowerCase() === 'hook') {
            // Try to extract the company/topic from the rest of the text
            return null; // Fall through to renderBoldText which shows the full text naturally
        }
        return { header, rest };
    }
    return null;
}

// Render text with **bold** markers as actual bold
function renderBoldText(text) {
    if (!text) return null;
    const parts = text.split(/\*\*(.*?)\*\*/g);
    return parts.map((part, i) => {
        if (i % 2 === 1) {
            return <strong key={i} className="font-semibold">{part}</strong>;
        }
        return <span key={i}>{part}</span>;
    });
}

export default function KeyHighlights({ highlights = [] }) {
    if (!highlights || highlights.length === 0) return null;

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-gradient-to-r from-slate-50 to-amber-50/50 dark:from-neutral-900 dark:to-neutral-800/60 rounded-xl md:rounded-2xl p-4 md:p-6 border border-slate-100 dark:border-neutral-700/50"
        >
            <div className="flex items-center gap-2 mb-3 md:mb-4">
                <Zap className="h-3.5 w-3.5 md:h-4 md:w-4 text-amber-500" />
                <h3 className="font-semibold text-slate-900 dark:text-neutral-100 text-sm md:text-base">Key Takeaways</h3>
            </div>
            <ul className="space-y-2.5 md:space-y-3">
                {highlights.map((highlight, index) => {
                    const parsed = parseHighlight(highlight);
                    return (
                        <motion.li
                            key={index}
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: index * 0.1 }}
                            className="flex items-start gap-2 md:gap-3"
                        >
                            <div className="w-1.5 h-1.5 rounded-full bg-amber-400 mt-1.5 md:mt-2 flex-shrink-0" />
                            <p className="text-slate-700 dark:text-neutral-300 text-xs md:text-sm leading-relaxed">
                                {parsed ? (
                                    <>
                                        <span className="font-semibold text-slate-900 dark:text-neutral-100">{parsed.header}:</span>
                                        {parsed.rest ? <> {renderBoldText(parsed.rest)}</> : ''}
                                    </>
                                ) : (
                                    renderBoldText(highlight)
                                )}
                            </p>
                        </motion.li>
                    );
                })}
            </ul>
        </motion.div>
    );
}