import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { 
    ArrowLeft, 
    Target, 
    Shield, 
    Briefcase, 
    Mic,
    Clock,
    Save,
    Check,
    X,
    Plus
} from 'lucide-react';
import { toast } from 'sonner';

const goalOptions = [
    'Retirement', 'Wealth Growth', 'Passive Income', 
    'Capital Preservation', 'Short-term Gains', 'Education Fund'
];

const interestOptions = [
    'Technology', 'Healthcare', 'Real Estate', 'Crypto', 
    'Energy', 'Finance', 'Consumer Goods', 'Commodities',
    'ESG/Sustainable', 'Emerging Markets', 'Dividends', 'ETFs'
];

export default function Settings() {
    const queryClient = useQueryClient();
    const [holdingInput, setHoldingInput] = useState('');

    // Fetch current user
    const { data: user } = useQuery({
        queryKey: ['currentUser'],
        queryFn: () => base44.auth.me(),
    });

    // Fetch user preferences
    const { data: preferences, isLoading } = useQuery({
        queryKey: ['userPreferences'],
        queryFn: async () => {
            const prefs = await base44.entities.UserPreferences.filter({ created_by: user?.email });
            return prefs[0] || null;
        },
        enabled: !!user,
    });

    const [editedPrefs, setEditedPrefs] = useState(null);

    React.useEffect(() => {
        if (preferences) {
            setEditedPrefs(preferences);
        }
    }, [preferences]);

    const updateMutation = useMutation({
        mutationFn: async (prefs) => {
            return base44.entities.UserPreferences.update(preferences.id, prefs);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['userPreferences'] });
            toast.success('Preferences saved successfully');
        },
    });

    const handleSave = () => {
        updateMutation.mutate(editedPrefs);
    };

    const handleGoalToggle = (goal) => {
        setEditedPrefs(prev => ({
            ...prev,
            investment_goals: prev.investment_goals?.includes(goal)
                ? prev.investment_goals.filter(g => g !== goal)
                : [...(prev.investment_goals || []), goal]
        }));
    };

    const handleInterestToggle = (interest) => {
        setEditedPrefs(prev => ({
            ...prev,
            investment_interests: prev.investment_interests?.includes(interest)
                ? prev.investment_interests.filter(i => i !== interest)
                : [...(prev.investment_interests || []), interest]
        }));
    };

    const addHolding = () => {
        if (holdingInput.trim()) {
            setEditedPrefs(prev => ({
                ...prev,
                portfolio_holdings: [...(prev.portfolio_holdings || []), holdingInput.trim().toUpperCase()]
            }));
            setHoldingInput('');
        }
    };

    const removeHolding = (holding) => {
        setEditedPrefs(prev => ({
            ...prev,
            portfolio_holdings: prev.portfolio_holdings?.filter(h => h !== holding) || []
        }));
    };

    if (isLoading || !editedPrefs) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-slate-50 to-white flex items-center justify-center">
                <div className="animate-pulse text-slate-400">Loading...</div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 to-white">
            {/* Header */}
            <header className="border-b border-slate-100 bg-white/80 backdrop-blur-sm sticky top-0 z-50">
                <div className="max-w-2xl mx-auto px-6 py-4 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <Link to={createPageUrl('Home')}>
                            <Button variant="ghost" size="icon" className="text-slate-400 hover:text-slate-600">
                                <ArrowLeft className="h-5 w-5" />
                            </Button>
                        </Link>
                        <h1 className="font-semibold text-slate-900">Settings</h1>
                    </div>
                    <Button 
                        onClick={handleSave}
                        disabled={updateMutation.isPending}
                        className="bg-amber-500 hover:bg-amber-600"
                    >
                        <Save className="h-4 w-4 mr-2" />
                        Save Changes
                    </Button>
                </div>
            </header>

            <main className="max-w-2xl mx-auto px-6 py-12 space-y-12">
                {/* Investment Goals */}
                <motion.section
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                >
                    <div className="flex items-center gap-3 mb-4">
                        <div className="w-10 h-10 bg-amber-50 rounded-xl flex items-center justify-center">
                            <Target className="h-5 w-5 text-amber-500" />
                        </div>
                        <div>
                            <h2 className="font-semibold text-slate-900">Investment Goals</h2>
                            <p className="text-sm text-slate-500">What are you investing for?</p>
                        </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                        {goalOptions.map(goal => (
                            <button
                                key={goal}
                                onClick={() => handleGoalToggle(goal)}
                                className={`px-4 py-2 rounded-full border transition-all ${
                                    editedPrefs.investment_goals?.includes(goal)
                                        ? 'border-amber-500 bg-amber-50 text-amber-700'
                                        : 'border-slate-200 hover:border-slate-300 text-slate-600'
                                }`}
                            >
                                {editedPrefs.investment_goals?.includes(goal) && (
                                    <Check className="inline h-3 w-3 mr-1" />
                                )}
                                {goal}
                            </button>
                        ))}
                    </div>
                </motion.section>

                <Separator />

                {/* Risk Tolerance */}
                <motion.section
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 }}
                >
                    <div className="flex items-center gap-3 mb-4">
                        <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center">
                            <Shield className="h-5 w-5 text-blue-500" />
                        </div>
                        <div>
                            <h2 className="font-semibold text-slate-900">Risk Tolerance</h2>
                            <p className="text-sm text-slate-500">How comfortable are you with risk?</p>
                        </div>
                    </div>
                    <div className="grid grid-cols-3 gap-3">
                        {['conservative', 'moderate', 'aggressive'].map(level => (
                            <button
                                key={level}
                                onClick={() => setEditedPrefs(prev => ({ ...prev, risk_tolerance: level }))}
                                className={`p-4 rounded-xl border-2 transition-all ${
                                    editedPrefs.risk_tolerance === level
                                        ? 'border-amber-500 bg-amber-50'
                                        : 'border-slate-200 hover:border-slate-300'
                                }`}
                            >
                                <div className="text-xl mb-2">
                                    {level === 'conservative' ? '🛡️' : level === 'moderate' ? '⚖️' : '🚀'}
                                </div>
                                <span className="font-medium capitalize text-slate-900">{level}</span>
                            </button>
                        ))}
                    </div>
                </motion.section>

                <Separator />

                {/* Interests */}
                <motion.section
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2 }}
                >
                    <div className="flex items-center gap-3 mb-4">
                        <div className="w-10 h-10 bg-purple-50 rounded-xl flex items-center justify-center">
                            <Briefcase className="h-5 w-5 text-purple-500" />
                        </div>
                        <div>
                            <h2 className="font-semibold text-slate-900">Investment Interests</h2>
                            <p className="text-sm text-slate-500">Sectors and topics you want to follow</p>
                        </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                        {interestOptions.map(interest => (
                            <button
                                key={interest}
                                onClick={() => handleInterestToggle(interest)}
                                className={`px-3 py-1.5 rounded-full border text-sm transition-all ${
                                    editedPrefs.investment_interests?.includes(interest)
                                        ? 'border-amber-500 bg-amber-50 text-amber-700'
                                        : 'border-slate-200 hover:border-slate-300 text-slate-600'
                                }`}
                            >
                                {editedPrefs.investment_interests?.includes(interest) && (
                                    <Check className="inline h-3 w-3 mr-1" />
                                )}
                                {interest}
                            </button>
                        ))}
                    </div>
                </motion.section>

                <Separator />

                {/* Portfolio Holdings */}
                <motion.section
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.3 }}
                >
                    <div className="flex items-center gap-3 mb-4">
                        <div className="w-10 h-10 bg-green-50 rounded-xl flex items-center justify-center">
                            <Briefcase className="h-5 w-5 text-green-500" />
                        </div>
                        <div>
                            <h2 className="font-semibold text-slate-900">Portfolio Holdings</h2>
                            <p className="text-sm text-slate-500">Your ticker symbols for personalized news</p>
                        </div>
                    </div>
                    <div className="flex gap-2 mb-4">
                        <Input
                            value={holdingInput}
                            onChange={(e) => setHoldingInput(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && addHolding()}
                            placeholder="e.g., AAPL, TSLA, BTC"
                            className="flex-1"
                        />
                        <Button onClick={addHolding} variant="outline">
                            <Plus className="h-4 w-4" />
                        </Button>
                    </div>
                    <div className="flex flex-wrap gap-2">
                        {editedPrefs.portfolio_holdings?.map(holding => (
                            <Badge
                                key={holding}
                                variant="secondary"
                                className="px-3 py-1 flex items-center gap-2"
                            >
                                {holding}
                                <button 
                                    onClick={() => removeHolding(holding)}
                                    className="hover:text-red-500 transition-colors"
                                >
                                    <X className="h-3 w-3" />
                                </button>
                            </Badge>
                        ))}
                    </div>
                </motion.section>

                <Separator />

                {/* Briefing Preferences */}
                <motion.section
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.4 }}
                >
                    <div className="flex items-center gap-3 mb-6">
                        <div className="w-10 h-10 bg-cyan-50 rounded-xl flex items-center justify-center">
                            <Mic className="h-5 w-5 text-cyan-500" />
                        </div>
                        <div>
                            <h2 className="font-semibold text-slate-900">Briefing Preferences</h2>
                            <p className="text-sm text-slate-500">Customize your audio experience</p>
                        </div>
                    </div>

                    <div className="space-y-6">
                        <div>
                            <Label className="text-slate-700 mb-3 block">Briefing Length</Label>
                            <div className="grid grid-cols-3 gap-3">
                                {[
                                    { value: 'short', label: '~5 min' },
                                    { value: 'medium', label: '~8 min' },
                                    { value: 'long', label: '~12 min' },
                                ].map(opt => (
                                    <button
                                        key={opt.value}
                                        onClick={() => setEditedPrefs(prev => ({ ...prev, briefing_length: opt.value }))}
                                        className={`p-3 rounded-xl border-2 transition-all ${
                                            editedPrefs.briefing_length === opt.value
                                                ? 'border-amber-500 bg-amber-50'
                                                : 'border-slate-200 hover:border-slate-300'
                                        }`}
                                    >
                                        <Clock className="h-4 w-4 mx-auto mb-1 text-slate-400" />
                                        <span className="font-medium text-slate-900">{opt.label}</span>
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div>
                            <Label className="text-slate-700 mb-3 block">Voice Style</Label>
                            <div className="grid grid-cols-3 gap-3">
                                {[
                                    { value: 'professional', label: 'Professional' },
                                    { value: 'conversational', label: 'Conversational' },
                                    { value: 'energetic', label: 'Energetic' },
                                ].map(opt => (
                                    <button
                                        key={opt.value}
                                        onClick={() => setEditedPrefs(prev => ({ ...prev, preferred_voice: opt.value }))}
                                        className={`p-3 rounded-xl border-2 transition-all ${
                                            editedPrefs.preferred_voice === opt.value
                                                ? 'border-amber-500 bg-amber-50'
                                                : 'border-slate-200 hover:border-slate-300'
                                        }`}
                                    >
                                        <span className="font-medium text-slate-900">{opt.label}</span>
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>
                </motion.section>
            </main>
        </div>
    );
}