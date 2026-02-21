import React, { useState, useEffect, Component } from 'react';
import { motion } from 'framer-motion';
import { Button } from "@/components/ui/button";
import StockPicker from "@/components/StockPicker";
import MobileOnboarding from "@/components/MobileOnboarding";

/** True only for actual touch devices with narrow viewport (mobile app). Web app = always false. */
function useIsMobileDevice() {
  const [isMobileDevice, setIsMobileDevice] = useState(() =>
    typeof window !== "undefined" ? window.matchMedia("(max-width: 767px) and (pointer: coarse)").matches : false
  );
  useEffect(() => {
    const mql = window.matchMedia("(max-width: 767px) and (pointer: coarse)");
    const onChange = () => setIsMobileDevice(mql.matches);
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, []);
  return !!isMobileDevice;
}

class OnboardingErrorBoundary extends Component {
  state = { hasError: false, error: null };

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    console.error('Onboarding crashed:', error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: 40, textAlign: 'center', background: '#faf7f2', minHeight: '100dvh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
          <h2 style={{ fontSize: 20, fontWeight: 600, color: '#1a1a1a', marginBottom: 8 }}>Something went wrong</h2>
          <p style={{ color: '#999', fontSize: 14 }}>{this.state.error?.message}</p>
          <button
            onClick={() => window.location.reload()}
            style={{ padding: '12px 24px', background: '#e07028', color: 'white', border: 'none', borderRadius: 12, marginTop: 16, cursor: 'pointer', fontWeight: 600 }}
          >
            Reload App
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

const steps = [
  { title: "Welcome to PulseApp", subtitle: "Let's personalize your experience", id: "welcome" },
  { title: "Investment Goals", subtitle: "What are you looking to achieve?", id: "goals" },
  { title: "Risk Tolerance", subtitle: "How do you approach risk?", id: "risk" },
  { title: "Investment Interests", subtitle: "What sectors interest you?", id: "interests" },
  { title: "Portfolio Holdings", subtitle: "Add your stock positions", id: "portfolio" }
];

const goalOptions = ['Retirement', 'Wealth Growth', 'Passive Income', 'Capital Preservation', 'Short-term Gains', 'Education Fund'];

const interestOptions = [
  'Technology', 'Healthcare', 'Real Estate', 'Crypto', 
  'Energy', 'Finance', 'Consumer Goods', 'Commodities',
  'ESG/Sustainable', 'Emerging Markets', 'Dividends', 'ETFs'
];

export default function OnboardingWizard({ onComplete }) {
  const isMobileDevice = useIsMobileDevice();
  const [currentStep, setCurrentStep] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [preferences, setPreferences] = useState({
    display_name: '',
    investment_goals: [],
    risk_tolerance: 'moderate',
    investment_interests: [],
    portfolio_holdings: [],
    briefing_length: 'medium',
    preferred_voice: 'professional',
    onboarding_completed: true
  });

  const handleGoalToggle = (goal) => {
    setPreferences(prev => ({
      ...prev,
      investment_goals: prev.investment_goals?.includes(goal)
        ? prev.investment_goals.filter(g => g !== goal)
        : [...(prev.investment_goals || []), goal]
    }));
  };

  const handleInterestToggle = (interest) => {
    setPreferences(prev => ({
      ...prev,
      investment_interests: prev.investment_interests?.includes(interest)
        ? prev.investment_interests.filter(i => i !== interest)
        : [...(prev.investment_interests || []), interest]
    }));
  };

  const handleAddStock = (symbol) => {
    setPreferences(prev => ({
      ...prev,
      portfolio_holdings: [...(prev.portfolio_holdings || []), symbol]
    }));
  };

  const handleRemoveStock = (symbol) => {
    setPreferences(prev => ({
      ...prev,
      portfolio_holdings: prev.portfolio_holdings?.filter(h => h !== symbol) || []
    }));
  };

  const goToNext = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      handleComplete();
    }
  };

  const goToPrevious = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleComplete = async () => {
    setIsSubmitting(true);
    try {
      await onComplete(preferences);
    } catch (error) {
      console.error('Error completing onboarding:', error);
      setIsSubmitting(false);
    }
  };

  // Mobile device only: Prompt H full-page onboarding. Web app: original floating card.
  if (isMobileDevice) {
    return (
      <OnboardingErrorBoundary>
        <MobileOnboarding onComplete={onComplete} />
      </OnboardingErrorBoundary>
    );
  }

  const renderStepContent = () => {
    switch (currentStep) {
      case 0:
        return (
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="space-y-6"
          >
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-neutral-300 mb-2">
                What should we call you?
              </label>
              <input
                type="text"
                value={preferences.display_name || ''}
                onChange={(e) => setPreferences({ ...preferences, display_name: e.target.value })}
                placeholder="Enter your name"
                className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-neutral-600 bg-white dark:bg-neutral-900 text-slate-900 dark:text-neutral-100 focus:border-amber-500 dark:focus:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-500/20 dark:focus:ring-amber-400/20 transition-all placeholder:text-slate-400 dark:placeholder:text-neutral-500"
              />
            </div>
          </motion.div>
        );

      case 1:
        return (
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="space-y-4"
          >
            <h3 className="font-semibold text-slate-900 dark:text-neutral-100 mb-3">What are you investing for?</h3>
            <div className="flex flex-wrap gap-2">
              {goalOptions.map(goal => (
                <button
                  key={goal}
                  onClick={() => handleGoalToggle(goal)}
                  className={`px-4 py-2 rounded-full border transition-all ${
                    preferences.investment_goals?.includes(goal)
                      ? 'border-amber-500 dark:border-amber-400 bg-amber-50 dark:bg-amber-400/12 text-amber-700 dark:text-amber-400'
                      : 'border-slate-200 dark:border-neutral-600 hover:border-slate-300 dark:hover:border-neutral-500 text-slate-600 dark:text-neutral-400'
                  }`}
                >
                  {goal}
                </button>
              ))}
            </div>
          </motion.div>
        );

      case 2:
        return (
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="space-y-4"
          >
            <h3 className="font-semibold text-slate-900 dark:text-neutral-100 mb-3">How comfortable are you with risk?</h3>
            <div className="grid grid-cols-3 gap-3">
              {['conservative', 'moderate', 'aggressive'].map(level => (
                <button
                  key={level}
                  onClick={() => setPreferences({ ...preferences, risk_tolerance: level })}
                  className={`p-4 rounded-xl border-2 transition-all ${
                    preferences.risk_tolerance === level
                      ? 'border-amber-500 dark:border-amber-400 bg-amber-50 dark:bg-amber-400/12'
                      : 'border-slate-200 dark:border-neutral-600 hover:border-slate-300 dark:hover:border-neutral-500'
                  }`}
                >
                  <div className="text-xl mb-2">
                    {level === 'conservative' ? '🛡️' : level === 'moderate' ? '⚖️' : '🚀'}
                  </div>
                  <span className="font-medium capitalize text-slate-900 dark:text-neutral-100">{level}</span>
                </button>
              ))}
            </div>
          </motion.div>
        );

      case 3:
        return (
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="space-y-4"
          >
            <h3 className="font-semibold text-slate-900 dark:text-neutral-100 mb-3">What interests you?</h3>
            <div className="flex flex-wrap gap-2">
              {interestOptions.map(interest => (
                <button
                  key={interest}
                  onClick={() => handleInterestToggle(interest)}
                  className={`px-3 py-1.5 rounded-full border text-sm transition-all ${
                    preferences.investment_interests?.includes(interest)
                      ? 'border-amber-500 dark:border-amber-400 bg-amber-50 dark:bg-amber-400/12 text-amber-700 dark:text-amber-400'
                      : 'border-slate-200 dark:border-neutral-600 hover:border-slate-300 dark:hover:border-neutral-500 text-slate-600 dark:text-neutral-400'
                  }`}
                >
                  {interest}
                </button>
              ))}
            </div>
          </motion.div>
        );

      case 4:
        return (
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="space-y-4"
          >
            <h3 className="font-semibold text-slate-900 dark:text-neutral-100 mb-3">Add your portfolio holdings</h3>
            <p className="text-sm text-slate-600 dark:text-neutral-400 mb-4">
              Add the stocks you currently own or are tracking
            </p>
            <StockPicker
              selectedStocks={preferences.portfolio_holdings || []}
              onAdd={handleAddStock}
              onRemove={handleRemoveStock}
              maxStocks={20}
            />
          </motion.div>
        );

      default:
        return null;
    }
  };

  return (
    <OnboardingErrorBoundary>
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-neutral-950 dark:to-neutral-900 flex items-center justify-center p-4">
      <div className="w-full max-w-2xl bg-white dark:bg-neutral-800 rounded-3xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-amber-500 to-orange-600 dark:from-amber-600 dark:to-orange-700 p-8 text-white dark:text-neutral-50">
          <h1 className="text-3xl font-bold mb-2 dark:text-white">{steps[currentStep].title}</h1>
          <p className="text-amber-50 dark:text-amber-100 opacity-90">{steps[currentStep].subtitle}</p>

          {/* Progress Bar */}
          <div className="flex gap-2 mt-4">
            {steps.map((_, idx) => (
              <div
                key={idx}
                className={`h-1 flex-1 rounded-full transition-all ${
                  idx <= currentStep ? 'bg-white dark:bg-neutral-100' : 'bg-white/30 dark:bg-neutral-500/30'
                }`}
              />
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="p-8 min-h-[300px]">
          {renderStepContent()}
        </div>

        {/* Navigation */}
        <div className="p-8 pt-0 flex justify-between gap-4">
          {currentStep > 0 && (
            <Button
              type="button"
              variant="outline"
              onClick={goToPrevious}
              disabled={isSubmitting}
              className="dark:border-neutral-600 dark:text-neutral-300 dark:hover:bg-neutral-700"
            >
              Back
            </Button>
          )}
          <Button
            onClick={goToNext}
            disabled={isSubmitting}
            className={`bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white ${
              currentStep === 0 ? 'w-full' : 'ml-auto'
            }`}
          >
            {isSubmitting ? 'Completing...' : currentStep === steps.length - 1 ? 'Complete Setup' : 'Continue'}
          </Button>
        </div>
      </div>
    </div>
    </OnboardingErrorBoundary>
  );
}