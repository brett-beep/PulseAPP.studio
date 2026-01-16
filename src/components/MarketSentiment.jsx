import React from 'react';
import { motion } from 'framer-motion';
import { TrendingUp, TrendingDown, Minus, Activity } from 'lucide-react';

const sentimentConfig = {
    bullish: {
        icon: TrendingUp,
        color: 'text-emerald-500',
        bg: 'bg-emerald-500/10',
        label: 'Bullish',
        description: 'Markets showing positive momentum'
    },
    bearish: {
        icon: TrendingDown,
        color: 'text-red-500',
        bg: 'bg-red-500/10',
        label: 'Bearish',
        description: 'Markets under pressure'
    },
    neutral: {
        icon: Minus,
        color: 'text-slate-500',
        bg: 'bg-slate-500/10',
        label: 'Neutral',
        description: 'Markets trading sideways'
    },
    mixed: {
        icon: Activity,
        color: 'text-amber-500',
        bg: 'bg-amber-500/10',
        label: 'Mixed',
        description: 'Varied signals across sectors'
    }
};

export default function MarketSentiment({ sentiment = 'neutral' }) {
    const config = sentimentConfig[sentiment] || sentimentConfig.neutral;
    const Icon = config.icon;

    return (
        <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className={`inline-flex items-center gap-3 px-4 py-2 rounded-full ${config.bg}`}
        >
            <Icon className={`h-4 w-4 ${config.color}`} />
            <div>
                <span className={`text-sm font-semibold ${config.color}`}>{config.label}</span>
                <span className="text-xs text-slate-500 ml-2 hidden sm:inline">{config.description}</span>
            </div>
        </motion.div>
    );
}