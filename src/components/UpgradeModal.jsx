import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Crown, Zap, TrendingUp, Bell, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { base44 } from '@/api/base44Client';

export default function UpgradeModal({ isOpen, onClose }) {
  const [isProcessing, setIsProcessing] = useState(false);

  const handleUpgrade = async () => {
    // Check if running in iframe
    if (window.self !== window.top) {
      alert('Checkout is only available in the published app. Please open the app in a new tab.');
      return;
    }

    setIsProcessing(true);
    try {
      const response = await base44.functions.invoke('createCheckout', {
        priceId: 'price_1Sv9oi5v4jH888qdSPNtXYcR',
        successUrl: `${window.location.origin}/?upgrade=success`,
        cancelUrl: window.location.origin,
      });

      if (response.data.url) {
        window.location.href = response.data.url;
      }
    } catch (error) {
      console.error('Checkout error:', error);
      alert('Failed to start checkout. Please try again.');
      setIsProcessing(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50"
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
          >
            <div className="bg-white rounded-3xl shadow-2xl max-w-lg w-full overflow-hidden">
              {/* Header */}
              <div className="relative bg-gradient-to-br from-amber-500 to-orange-600 p-8 text-white">
                <button
                  onClick={onClose}
                  className="absolute top-4 right-4 text-white/80 hover:text-white transition-colors"
                >
                  <X className="h-5 w-5" />
                </button>
                
                <div className="flex items-center gap-3 mb-2">
                  <Crown className="h-8 w-8" />
                  <h2 className="text-3xl font-bold">Go Premium</h2>
                </div>
                <p className="text-amber-50">Unlock unlimited briefings and advanced features</p>
              </div>

              {/* Features */}
              <div className="p-8 space-y-4">
                {[
                  { icon: Zap, text: 'Unlimited daily briefings (no 3/day limit)' },
                  { icon: TrendingUp, text: 'Advanced portfolio tracking & insights' },
                  { icon: Bell, text: 'Priority news updates & alerts' },
                  { icon: Check, text: 'Extended briefing lengths (up to 20 min)' },
                ].map((feature, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.1 }}
                    className="flex items-center gap-3"
                  >
                    <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center">
                      <feature.icon className="h-5 w-5 text-amber-600" />
                    </div>
                    <p className="text-slate-700">{feature.text}</p>
                  </motion.div>
                ))}
              </div>

              {/* Pricing */}
              <div className="px-8 pb-8">
                <div className="bg-gradient-to-br from-slate-50 to-slate-100 rounded-2xl p-6 mb-6">
                  <div className="flex items-baseline justify-center gap-2">
                    <span className="text-4xl font-bold text-slate-900">$9.99</span>
                    <span className="text-slate-600">/month</span>
                  </div>
                  <p className="text-center text-slate-500 text-sm mt-2">
                    Cancel anytime, no long-term commitment
                  </p>
                </div>

                <Button
                  onClick={handleUpgrade}
                  disabled={isProcessing}
                  className="w-full bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white font-semibold py-6 text-lg"
                >
                  {isProcessing ? 'Processing...' : 'Subscribe Now'}
                </Button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}