import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Button } from "@/components/ui/button";
import { Sparkles, Loader2, RefreshCw } from 'lucide-react';

export default function GenerateBriefingButton({ onGenerate, isGenerating, hasExistingBriefing }) {
    return (
        <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex flex-col items-center gap-3"
        >
            <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={onGenerate}
                disabled={isGenerating}
                className={`
                    relative overflow-hidden px-8 py-4 rounded-2xl font-medium text-white
                    transition-shadow duration-300 shadow-lg
                    ${isGenerating 
                        ? 'bg-slate-400 cursor-not-allowed' 
                        : 'bg-gradient-to-r from-amber-500 to-amber-600 hover:shadow-amber-200/50 hover:shadow-xl'
                    }
                `}
            >
                <span className="relative z-10 flex items-center gap-3">
                    {isGenerating ? (
                        <>
                            <Loader2 className="h-5 w-5 animate-spin" />
                            <span>Generating your briefing...</span>
                        </>
                    ) : hasExistingBriefing ? (
                        <>
                            <RefreshCw className="h-5 w-5" />
                            <span>Regenerate Today's Briefing</span>
                        </>
                    ) : (
                        <>
                            <Sparkles className="h-5 w-5" />
                            <span>Generate Today's Briefing</span>
                        </>
                    )}
                </span>
                
                {/* Smooth gradient overlay on hover */}
                {!isGenerating && (
                    <motion.div
                        className="absolute inset-0 bg-gradient-to-r from-amber-400 to-amber-500 opacity-0"
                        whileHover={{ opacity: 1 }}
                        transition={{ duration: 0.1, ease: "easeInOut" }}
                    />
                )}
            </motion.button>
            
            {isGenerating && (
                <p className="text-sm text-slate-500">
                    This usually takes 60–90 seconds. Hang tight!
                </p>
            )}
        </motion.div>
    );
}