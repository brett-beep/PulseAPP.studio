import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import StockPicker from "@/components/StockPicker";
import { 
    ArrowRight, 
    ArrowLeft, 
    Target, 
    Shield, 
    Briefcase, 
    Mic,
    Check,
    Sparkles
} from 'lucide-react';

const steps = [
    { id: 'goals', title: 'Investment Goals', icon: Target },
    { id: 'risk', title: 'Risk Tolerance', icon: Shield },
    { id: 'interests', title: 'Interests', icon: Briefcase },
    { id: 'portfolio', title: 'Portfolio', icon: Briefcase },
    { id: 'preferences', title: 'Preferences', icon: Mic },
];

const goalOptions = [
    'Retirement', 'Wealth Growth', 'Passive Income', 
    'Capital Preservation', 'Short-term Gains', 'Education Fund'
];

const interestOptions = [
    'Technology', 'Healthcare', 'Real Estate', 'Crypto', 
    'Energy', 'Finance', 'Consumer Goods', 'Commodities',
    'ESG/Sustainable', 'Emerging Markets', 'Dividends', 'ETFs'
];

export default function OnboardingWizard({ onComplete }) {
    const [currentStep, setCurrentStep] = useState(0);
    const [preferences, setPreferences] = useState({
        investment_goals: [],
        risk_tolerance: 'moderate',
        investment_interests: [],
        portfolio_holdings: [],
        briefing_length: 'medium',
        preferred_voice: 'professional'
    });

    const handleGoalToggle = (goal) => {
        setPreferences(prev => ({
            ...prev,
            investment_goals: prev.investment_goals.includes(goal)
                ? prev.investment_goals.filter(g => g !== goal)
                : [...prev.investment_goals, goal]
        }));
    };

    const handleInterestToggle = (interest) => {
        setPreferences(prev => ({
            ...prev,
            investment_interests: prev.investment_interests.includes(interest)
                ? prev.investment_interests.filter(i => i !== interest)
                : [...prev.investment_interests, interest]
        }));
    };

    // Stock picker handlers
    const handleAddStock = (symbol) => {
        setPreferences(prev => ({
            ...prev,
            portfolio_holdings: [...prev.portfolio_holdings, symbol]
        }));
    };

    const handleRemoveStock = (symbol) => {
        setPreferences(prev => ({
            ...prev,
            portfolio_holdings: prev.portfolio_holdings.filter(h => h !== symbol)
        }));
    };

    const nextStep = () => {
        if (currentStep < steps.length - 1) {
            setCurrentStep(currentStep + 1);
        } else {
            onComplete({ ...preferences, onboarding_completed: true });
        }
    };

    const prevStep = () => {
        if (currentStep > 0) {
            setCurrentStep(currentStep - 1);
        }
    };

    const renderStepContent = () => {
        switch (steps[currentStep].id) {
            case 'goals':
                return (
                    <div className="space-y-6">
                        <p className="text-slate-600 text-center">
                            What are you investing for? Select all that apply.
                        </p>
                        <div className="flex flex-wrap gap-3 justify-center">
                            {goalOptions.map(goal => (
                                <motion.button
                                    key={goal}
                                    whileHover={{ scale: 1.02 }}
                                    whileTap={{ scale: 0.98 }}
                                    onClick={() => handleGoalToggle(goal)}
                                    className={`px-5 py-2.5 rounded-full border-2 transition-all ${
                                        preferences.investment_goals.includes(goal)
                                            ? 'border-amber-500 bg-amber-50 text-amber-700'
                                            : 'border-slate-200 hover:border-slate-300 text-slate-600'
                                    }`}
                                >
                                    {preferences.investment_goals.includes(goal) && (
                                        <Check className="inline h-4 w-4 mr-2" />
                                    )}
                                    {goal}
                                </motion.button>
                            ))}
                        </div>
                    </div>
                );

            case 'risk':
                return (
                    <div className="space-y-8">
                        <p className="text-slate-600 text-center">
                            How comfortable are you with investment risk?
                        </p>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                            {['conservative', 'moderate', 'aggressive'].map(level => (
                                <motion.button
                                    key={level}
                                    whileHover={{ scale: 1.02 }}
                                    whileTap={{ scale: 0.98 }}
                                    onClick={() => setPreferences(prev => ({ ...prev, risk_tolerance: level }))}
                                    className={`p-6 rounded-2xl border-2 transition-all ${
                                        preferences.risk_tolerance === level
                                            ? 'border-amber-500 bg-amber-50'
                                            : 'border-slate-200 hover:border-slate-300'
                                    }`}
                                >
                                    <div className={`text-2xl mb-3 ${
                                        level === 'conservative' ? '🛡️' : 
                                        level === 'moderate' ? '⚖️' : '🚀'
                                    }`}>
                                        {level === 'conservative' ? '🛡️' : level === 'moderate' ? '⚖️' : '🚀'}
                                    </div>
                                    <h4 className="font-semibold capitalize text-slate-900">{level}</h4>
                                    <p className="text-xs text-slate-500 mt-1">
                                        {level === 'conservative' && 'Prioritize capital preservation'}
                                        {level === 'moderate' && 'Balanced risk and reward'}
                                        {level === 'aggressive' && 'Higher risk for higher returns'}
                                    </p>
                                </motion.button>
                            ))}
                        </div>
                    </div>
                );

            case 'interests':
                return (
                    <div className="space-y-6">
                        <p className="text-slate-600 text-center">
                            Which sectors and topics interest you most?
                        </p>
                        <div className="flex flex-wrap gap-3 justify-center">
                            {interestOptions.map(interest => (
                                <motion.button
                                    key={interest}
                                    whileHover={{ scale: 1.02 }}
                                    whileTap={{ scale: 0.98 }}
                                    onClick={() => handleInterestToggle(interest)}
                                    className={`px-4 py-2 rounded-full border-2 text-sm transition-all ${
                                        preferences.investment_interests.includes(interest)
                                            ? 'border-amber-500 bg-amber-50 text-amber-700'
                                            : 'border-slate-200 hover:border-slate-300 text-slate-600'
                                    }`}
                                >
                                    {preferences.investment_interests.includes(interest) && (
                                        <Check className="inline h-3 w-3 mr-1" />
                                    )}
                                    {interest}
                                </motion.button>
                            ))}
                        </div>
                    </div>
                );

            case 'portfolio':
                return (
                    <div className="space-y-6">
                        <p className="text-slate-600 text-center">
                            Add stocks to track - these will appear on your home page with live prices
                        </p>
                        
                        <StockPicker
                            selectedStocks={preferences.portfolio_holdings}
                            onAdd={handleAddStock}
                            onRemove={handleRemoveStock}
                            maxStocks={10}
                        />
                        
                        <p className="text-xs text-slate-400 text-center">
                            Click the × button to remove stocks. You can skip or add more later in Settings.
                        </p>
                    </div>
                );

            case 'preferences':
                return (
                    <div className="space-y-8">
                        <div className="space-y-4">
                            <Label className="text-slate-700">Briefing Length</Label>
                            <div className="grid grid-cols-3 gap-3">
                                {[
                                    { value: 'short', label: '~5 min', desc: 'Quick highlights' },
                                    { value: 'medium', label: '~8 min', desc: 'Balanced coverage' },
                                    { value: 'long', label: '~12 min', desc: 'Deep dive' },
                                ].map(opt => (
                                    <motion.button
                                        key={opt.value}
                                        whileTap={{ scale: 0.98 }}
                                        onClick={() => setPreferences(prev => ({ ...prev, briefing_length: opt.value }))}
                                        className={`p-4 rounded-xl border-2 transition-all ${
                                            preferences.briefing_length === opt.value
                                                ? 'border-amber-500 bg-amber-50'
                                                : 'border-slate-200 hover:border-slate-300'
                                        }`}
                                    >
                                        <div className="font-semibold text-slate-900">{opt.label}</div>
                                        <div className="text-xs text-slate-500">{opt.desc}</div>
                                    </motion.button>
                                ))}
                            </div>
                        </div>

                        <div className="space-y-4">
                            <Label className="text-slate-700">Voice Style</Label>
                            <div className="grid grid-cols-3 gap-3">
                                {[
                                    { value: 'professional', label: 'Professional', desc: 'News anchor style' },
                                    { value: 'conversational', label: 'Conversational', desc: 'Friendly & casual' },
                                    { value: 'energetic', label: 'Energetic', desc: 'Upbeat & dynamic' },
                                ].map(opt => (
                                    <motion.button
                                        key={opt.value}
                                        whileTap={{ scale: 0.98 }}
                                        onClick={() => setPreferences(prev => ({ ...prev, preferred_voice: opt.value }))}
                                        className={`p-4 rounded-xl border-2 transition-all ${
                                            preferences.preferred_voice === opt.value
                                                ? 'border-amber-500 bg-amber-50'
                                                : 'border-slate-200 hover:border-slate-300'
                                        }`}
                                    >
                                        <div className="font-semibold text-slate-900">{opt.label}</div>
                                        <div className="text-xs text-slate-500">{opt.desc}</div>
                                    </motion.button>
                                ))}
                            </div>
                        </div>
                    </div>
                );

            default:
                return null;
        }
    };

    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="min-h-screen flex items-center justify-center p-6"
            style={{ background: 'linear-gradient(180deg, rgba(255, 255, 249, 0.7) 0%, rgba(255, 226, 148, 0.51) 76%, rgba(255, 95, 31, 0.52) 100%)' }}
        >
            <div className="w-full max-w-2xl">
                {/* Header */}
                <motion.div
                    initial={{ opacity: 0, y: -20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="text-center mb-12"
                >
                    <div className="inline-flex items-center gap-2 px-4 py-2 bg-amber-500/10 rounded-full mb-6">
                        <Sparkles className="h-4 w-4 text-amber-500" />
                        <span className="text-amber-700 text-sm font-medium">Personalization</span>
                    </div>
                    <h1 className="text-3xl font-light text-slate-900 mb-2">
                        Let's customize your <span className="font-semibold">briefings</span>
                    </h1>
                    <p className="text-slate-500">Step {currentStep + 1} of {steps.length}</p>
                </motion.div>

                {/* Progress */}
                <div className="flex gap-2 mb-12">
                    {steps.map((step, i) => (
                        <div
                            key={step.id}
                            className={`h-1 flex-1 rounded-full transition-all duration-300 ${
                                i <= currentStep ? 'bg-amber-500' : 'bg-slate-200'
                            }`}
                        />
                    ))}
                </div>

                {/* Step Title */}
                <motion.h2
                    key={currentStep}
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="text-xl font-semibold text-slate-900 text-center mb-8"
                >
                    {steps[currentStep].title}
                </motion.h2>

                {/* Content */}
                <AnimatePresence mode="wait">
                    <motion.div
                        key={currentStep}
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -20 }}
                        className="min-h-[300px]"
                    >
                        {renderStepContent()}
                    </motion.div>
                </AnimatePresence>

                {/* Navigation */}
                <div className="flex justify-between items-center mt-12">
                    <Button
                        variant="ghost"
                        onClick={prevStep}
                        disabled={currentStep === 0}
                        className="text-slate-500"
                    >
                        <ArrowLeft className="h-4 w-4 mr-2" />
                        Back
                    </Button>

                    <Button
                        onClick={nextStep}
                        className="bg-slate-900 hover:bg-slate-800 text-white px-8"
                    >
                        {currentStep === steps.length - 1 ? 'Complete Setup' : 'Continue'}
                        <ArrowRight className="h-4 w-4 ml-2" />
                    </Button>
                </div>
            </div>
        </motion.div>
    );
}