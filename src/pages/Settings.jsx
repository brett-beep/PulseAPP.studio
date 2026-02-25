import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import StockPicker from "@/components/StockPicker";
import { 
    ArrowLeft, 
    Target, 
    Shield, 
    Briefcase, 
    Mic,
    Clock,
    Save,
    Check,
    TrendingUp,
    LogOut,
    Trash2
} from 'lucide-react';
import { useAuth } from '@/lib/AuthContext';
import { toast } from 'sonner';
import { track } from "@/components/lib/analytics";

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
    const { logout } = useAuth();
    const [deleteConfirmText, setDeleteConfirmText] = useState('');

    // Page transition animation variants
    const pageVariants = {
        initial: { x: '100%', opacity: 0 },
        enter: { x: 0, opacity: 1, transition: { type: 'tween', duration: 0.3, ease: 'easeOut' } },
        exit: { x: '100%', opacity: 0, transition: { type: 'tween', duration: 0.25, ease: 'easeIn' } }
    };

    const handleLogout = () => {
        logout(true); // Pass true to redirect to landing page
    };

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
        onMutate: async (newPrefs) => {
            await queryClient.cancelQueries({ queryKey: ['userPreferences'] });
            const previous = queryClient.getQueryData(['userPreferences']);
            queryClient.setQueryData(['userPreferences'], (old) => old ? { ...old, ...newPrefs } : old);
            toast.success('Preferences saved');
            return { previous };
        },
        onError: (_err, _newPrefs, context) => {
            if (context?.previous) {
                queryClient.setQueryData(['userPreferences'], context.previous);
            }
            toast.error('Save failed. Reverted.');
        },
        onSettled: () => {
            queryClient.invalidateQueries({ queryKey: ['userPreferences'] });
        },
    });

    const handleSave = () => {
        // Determine which fields changed for analytics
        const updatedFields = [];
        if (editedPrefs.display_name !== preferences.display_name) updatedFields.push("name");
        if (JSON.stringify(editedPrefs.portfolio_holdings) !== JSON.stringify(preferences.portfolio_holdings)) updatedFields.push("portfolio");
        if (editedPrefs.risk_tolerance !== preferences.risk_tolerance) updatedFields.push("risk_tolerance");
        if (JSON.stringify(editedPrefs.investment_goals) !== JSON.stringify(preferences.investment_goals)) updatedFields.push("goals");
        if (JSON.stringify(editedPrefs.investment_interests) !== JSON.stringify(preferences.investment_interests)) updatedFields.push("interests");
        if (editedPrefs.briefing_length !== preferences.briefing_length) updatedFields.push("length");
        if (editedPrefs.preferred_voice !== preferences.preferred_voice) updatedFields.push("voice");
        track("settings_updated", { updated_fields: updatedFields.join(",") });
        updateMutation.mutate(editedPrefs);
    };

    const deleteAccountMutation = useMutation({
        mutationFn: async () => {
            return base44.functions.invoke("deleteAccount", {
                confirm: true,
            });
        },
        onSuccess: () => {
            toast.success("Account data deleted. Signing you out.");
            logout(true);
        },
        onError: (error) => {
            toast.error(error?.message || "Could not delete account. Please try again.");
        },
    });

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

    // Stock picker handlers
    const handleAddStock = (symbol) => {
        setEditedPrefs(prev => ({
            ...prev,
            portfolio_holdings: [...(prev.portfolio_holdings || []), symbol]
        }));
    };

    const handleRemoveStock = (symbol) => {
        setEditedPrefs(prev => ({
            ...prev,
            portfolio_holdings: prev.portfolio_holdings?.filter(h => h !== symbol) || []
        }));
    };

    if (isLoading || !editedPrefs) {
        return (
            <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: 'hsl(var(--background))' }}>
                <div className="animate-pulse text-slate-400">Loading...</div>
            </div>
        );
    }

    // Track settings_viewed on mount
    React.useEffect(() => {
        track("settings_viewed", {});
    }, []);

    return (
        <motion.div 
            className="min-h-screen app-theme-surface" 
            style={{ backgroundColor: 'hsl(var(--background))' }}
            variants={pageVariants}
            initial="initial"
            animate="enter"
            exit="exit"
        >
            {/* Header */}
            <header className="mobile-safe-sticky backdrop-blur-sm" style={{ background: "var(--header-bg)", borderBottom: "1px solid var(--header-border)", paddingTop: "env(safe-area-inset-top, 0px)" }}>
                <div className="max-w-2xl mx-auto px-4 md:px-6 py-4 flex items-center justify-between gap-2">
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
                        {updateMutation.isPending ? 'Saving...' : 'Save Changes'}
                    </Button>
                </div>
            </header>

            <main className="max-w-2xl mx-auto px-4 md:px-6 py-8 md:py-12 space-y-10 md:space-y-12 pb-28 md:pb-12">
                {/* Display Name */}
                <motion.section
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                >
                    <div className="flex items-center gap-3 mb-4">
                        <div className="w-10 h-10 bg-slate-50 dark:bg-neutral-800 rounded-xl flex items-center justify-center">
                            <span className="text-lg">👋</span>
                        </div>
                        <div>
                            <h2 className="font-semibold text-slate-900">Display Name</h2>
                            <p className="text-sm text-slate-500">How should we greet you?</p>
                        </div>
                    </div>
                    <input
                        type="text"
                        value={editedPrefs.display_name || ''}
                        onChange={(e) => setEditedPrefs(prev => ({ ...prev, display_name: e.target.value }))}
                        placeholder="Enter your name"
                        className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100 focus:border-amber-500 dark:focus:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-500/20 dark:focus:ring-amber-400/20 transition-all"
                    />
                </motion.section>

                <Separator />

                {/* Investment Goals */}
                <motion.section
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 }}
                >
                    <div className="flex items-center gap-3 mb-4">
                        <div className="w-10 h-10 bg-amber-50 dark:bg-amber-900/30 rounded-xl flex items-center justify-center">
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
                                        ? 'border-amber-500 bg-amber-50 text-amber-700 dark:border-amber-400 dark:bg-amber-400/12 dark:text-amber-400'
                                        : 'border-slate-200 hover:border-slate-300 text-slate-600 dark:border-neutral-700 dark:hover:border-neutral-600 dark:text-neutral-400'
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
                    transition={{ delay: 0.2 }}
                >
                    <div className="flex items-center gap-3 mb-4">
                        <div className="w-10 h-10 bg-blue-50 dark:bg-blue-900/30 rounded-xl flex items-center justify-center">
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
                                        ? 'border-amber-500 bg-amber-50 dark:border-amber-400 dark:bg-amber-400/12'
                                        : 'border-slate-200 hover:border-slate-300 dark:border-neutral-700 dark:hover:border-neutral-600'
                                }`}
                            >
                                <div className="text-xl mb-2">
                                    {level === 'conservative' ? '🛡️' : level === 'moderate' ? '⚖️' : '🚀'}
                                </div>
                                <span className="font-medium capitalize text-slate-900 dark:text-neutral-100">{level}</span>
                            </button>
                        ))}
                    </div>
                </motion.section>

                <Separator />

                {/* Interests */}
                <motion.section
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.3 }}
                >
                    <div className="flex items-center gap-3 mb-4">
                        <div className="w-10 h-10 bg-purple-50 dark:bg-purple-900/30 rounded-xl flex items-center justify-center">
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
                                        ? 'border-amber-500 bg-amber-50 text-amber-700 dark:border-amber-400 dark:bg-amber-400/12 dark:text-amber-400'
                                        : 'border-slate-200 hover:border-slate-300 text-slate-600 dark:border-neutral-700 dark:hover:border-neutral-600 dark:text-neutral-400'
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

                {/* Portfolio Holdings - UPDATED WITH STOCK PICKER */}
                <motion.section
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.4 }}
                >
                    <div className="flex items-center gap-3 mb-4">
                        <div className="w-10 h-10 bg-green-50 dark:bg-green-900/30 rounded-xl flex items-center justify-center">
                            <TrendingUp className="h-5 w-5 text-green-500" />
                        </div>
                        <div>
                            <h2 className="font-semibold text-slate-900">Portfolio Holdings</h2>
                            <p className="text-sm text-slate-500">
                              Select stocks to track - these will appear on your home page with live prices
                            </p>
                        </div>
                    </div>
                    
                    <StockPicker
                        selectedStocks={editedPrefs.portfolio_holdings || []}
                        onAdd={handleAddStock}
                        onRemove={handleRemoveStock}
                        maxStocks={10}
                    />
                </motion.section>

                <Separator />

                {/* Briefing Preferences - mobile: more padding, stacked options to avoid squeeze */}
                <motion.section
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.5 }}
                >
                    <div className="flex items-start gap-3 mb-6">
                        <div className="w-10 h-10 bg-cyan-50 dark:bg-cyan-900/30 rounded-xl flex items-center justify-center shrink-0">
                            <Mic className="h-5 w-5 text-cyan-500" />
                        </div>
                        <div className="min-w-0 flex-1">
                            <h2 className="font-semibold text-slate-900 text-base md:text-lg break-words">Briefing Preferences</h2>
                            <p className="text-sm text-slate-500 mt-0.5">Customize your audio experience</p>
                        </div>
                    </div>

                    <div className="space-y-6">
                        <div>
                            <Label className="text-slate-700 mb-3 block">Briefing Length</Label>
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-3">
                                {[
                                    { value: 'short', label: '~5 min' },
                                    { value: 'medium', label: '~8 min' },
                                    { value: 'long', label: '~12 min' },
                                ].map(opt => (
                                    <button
                                        key={opt.value}
                                        onClick={() => setEditedPrefs(prev => ({ ...prev, briefing_length: opt.value }))}
                                        className={`p-3 rounded-xl border-2 transition-all flex items-center justify-center gap-2 ${
                                            editedPrefs.briefing_length === opt.value
                                                ? 'border-amber-500 bg-amber-50 dark:border-amber-400 dark:bg-amber-400/12'
                                                : 'border-slate-200 hover:border-slate-300 dark:border-neutral-700 dark:hover:border-neutral-600'
                                        }`}
                                    >
                                        <Clock className="h-4 w-4 text-slate-400 dark:text-neutral-500 shrink-0" />
                                        <span className="font-medium text-slate-900 dark:text-neutral-100 text-sm sm:text-base">{opt.label}</span>
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div>
                            <Label className="text-slate-700 mb-3 block">Voice Style</Label>
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-3">
                                {[
                                    { value: 'professional', label: 'Professional' },
                                    { value: 'conversational', label: 'Conversational' },
                                    { value: 'hybrid', label: 'Hybrid' },
                                ].map(opt => (
                                    <button
                                        key={opt.value}
                                        onClick={() => setEditedPrefs(prev => ({ ...prev, preferred_voice: opt.value }))}
                                        className={`p-3 rounded-xl border-2 transition-all ${
                                            editedPrefs.preferred_voice === opt.value
                                                ? 'border-amber-500 bg-amber-50 dark:border-amber-400 dark:bg-amber-400/12'
                                                : 'border-slate-200 hover:border-slate-300 dark:border-neutral-700 dark:hover:border-neutral-600'
                                        }`}
                                    >
                                        <span className="font-medium text-slate-900 dark:text-neutral-100 text-sm sm:text-base block text-center">{opt.label}</span>
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>
                </motion.section>

                <Separator />

                {/* Account Deletion */}
                <motion.section
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.6 }}
                >
                    <div className="flex items-center gap-3 mb-4">
                        <div className="w-10 h-10 bg-red-50 dark:bg-red-900/30 rounded-xl flex items-center justify-center">
                            <Trash2 className="h-5 w-5 text-red-500" />
                        </div>
                        <div>
                            <h2 className="font-semibold text-slate-900">Delete Account</h2>
                            <p className="text-sm text-slate-500">Permanently delete your account data from PulseApp</p>
                        </div>
                    </div>

                    <AlertDialog>
                        <AlertDialogTrigger asChild>
                            <Button
                                variant="outline"
                                className="w-full border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700 hover:border-red-300"
                            >
                                <Trash2 className="h-4 w-4 mr-2" />
                                Delete My Account
                            </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                            <AlertDialogHeader>
                                <AlertDialogTitle>Delete your account?</AlertDialogTitle>
                                <AlertDialogDescription>
                                    This action is permanent. Type DELETE to confirm account data removal.
                                </AlertDialogDescription>
                            </AlertDialogHeader>
                            <input
                                value={deleteConfirmText}
                                onChange={(e) => setDeleteConfirmText(e.target.value)}
                                placeholder="Type DELETE"
                                className="w-full px-3 py-2 rounded-md border border-slate-200 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100 focus:outline-none focus:ring-2 focus:ring-red-200 dark:focus:ring-red-800 focus:border-red-300 dark:focus:border-red-600"
                            />
                            <AlertDialogFooter>
                                <AlertDialogCancel onClick={() => setDeleteConfirmText('')}>
                                    Cancel
                                </AlertDialogCancel>
                                <AlertDialogAction
                                    onClick={(e) => {
                                        if (deleteConfirmText !== 'DELETE') {
                                            e.preventDefault();
                                            toast.error("Please type DELETE to confirm.");
                                            return;
                                        }
                                        deleteAccountMutation.mutate();
                                    }}
                                    disabled={deleteAccountMutation.isPending}
                                    className="bg-red-600 hover:bg-red-700"
                                >
                                    {deleteAccountMutation.isPending ? 'Deleting...' : 'Confirm Deletion'}
                                </AlertDialogAction>
                            </AlertDialogFooter>
                        </AlertDialogContent>
                    </AlertDialog>
                </motion.section>

                <Separator />

                {/* Logout Section */}
                <motion.section
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.7 }}
                >
                    <div className="flex items-center gap-3 mb-4">
                        <div className="w-10 h-10 bg-red-50 dark:bg-red-900/30 rounded-xl flex items-center justify-center">
                            <LogOut className="h-5 w-5 text-red-500" />
                        </div>
                        <div>
                            <h2 className="font-semibold text-slate-900">Sign Out</h2>
                            <p className="text-sm text-slate-500">Log out of your account</p>
                        </div>
                    </div>
                    <Button 
                        onClick={handleLogout}
                        variant="outline"
                        className="w-full border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700 hover:border-red-300"
                    >
                        <LogOut className="h-4 w-4 mr-2" />
                        Log Out
                    </Button>
                </motion.section>
            </main>
        </motion.div>
    );
}