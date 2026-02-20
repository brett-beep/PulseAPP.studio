import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/AuthContext";
import { toast } from "sonner";
import { format } from "date-fns";
import StockPicker from "@/components/StockPicker";
import {
  User, BarChart3, Shield, Globe, Mic, ChevronRight, ChevronLeft,
  LogOut, Crown, Trash2, Check, X,
} from "lucide-react";

const ACCENT = "#e07028";
const CARD_BG = "rgba(255,255,255,0.55)";
const BLUR = "blur(40px) saturate(1.4)";
const BORDER = "1px solid rgba(0,0,0,0.04)";

const goalOptions = [
  "Retirement", "Wealth Growth", "Passive Income",
  "Capital Preservation", "Short-term Gains", "Education Fund",
];
const industryOptions = [
  "Technology", "Healthcare", "Real Estate", "Finance",
  "Energy", "Consumer Goods", "Industrials", "Utilities",
];
const themeOptions = [
  "Crypto", "ETFs", "Dividends", "ESG/Sustainable",
  "Emerging Markets", "Commodities", "IPOs & SPACs", "Small Cap",
];

function SubPageShell({ isOpen, onClose, title, onSave, saving, children }) {
  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          key="subpage"
          initial={{ x: "100%" }}
          animate={{ x: 0 }}
          exit={{ x: "100%" }}
          transition={{ type: "tween", duration: 0.28, ease: [0.32, 0.72, 0, 1] }}
          className="fixed inset-0 z-[210] flex flex-col"
          style={{ background: "#faf7f2" }}
        >
          <header
            className="flex items-center gap-3 shrink-0"
            style={{
              padding: "calc(env(safe-area-inset-top, 20px) + 12px) 20px 12px",
              background: "rgba(250,247,242,0.92)",
              backdropFilter: "blur(16px)",
              WebkitBackdropFilter: "blur(16px)",
              borderBottom: BORDER,
            }}
          >
            <button
              type="button"
              onClick={onClose}
              className="w-9 h-9 rounded-full flex items-center justify-center active:scale-90 transition-transform"
              style={{ background: CARD_BG, backdropFilter: BLUR, border: BORDER }}
            >
              <ChevronLeft className="w-[18px] h-[18px]" />
            </button>
            <span style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: 18, fontWeight: 500 }}>
              {title}
            </span>
          </header>

          <div className="flex-1 overflow-y-auto" style={{ WebkitOverflowScrolling: "touch" }}>
            <div className="px-5 py-5" style={{ paddingBottom: "calc(80px + env(safe-area-inset-bottom, 20px))" }}>
              {children}
            </div>
          </div>

          <div
            className="shrink-0"
            style={{
              padding: "12px 20px calc(12px + env(safe-area-inset-bottom, 20px))",
              background: "rgba(250,247,242,0.92)",
              backdropFilter: "blur(16px)",
              WebkitBackdropFilter: "blur(16px)",
              borderTop: BORDER,
            }}
          >
            <button
              type="button"
              onClick={onSave}
              disabled={saving}
              className="w-full py-3.5 rounded-2xl text-[15px] font-semibold text-white active:scale-[0.98] transition-transform disabled:opacity-60"
              style={{
                background: `linear-gradient(135deg, ${ACCENT}, #c85d1e)`,
                boxShadow: `0 8px 24px rgba(224,112,40,0.25)`,
              }}
            >
              {saving ? "Saving..." : "Save"}
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function Chip({ label, active, onToggle }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className="px-4 py-2.5 rounded-xl text-[14px] font-medium transition-all active:scale-[0.96]"
      style={{
        border: active ? `1.5px solid ${ACCENT}` : "1.5px solid rgba(0,0,0,0.06)",
        background: active ? "rgba(224,112,40,0.08)" : CARD_BG,
        backdropFilter: BLUR,
        color: active ? ACCENT : "#6b6b6b",
      }}
    >
      {active && <Check className="inline w-3 h-3 mr-1 -mt-0.5" />}
      {label}
    </button>
  );
}

function ChoiceCard({ label, subtitle, active, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full py-3.5 px-4 rounded-[14px] text-left transition-all active:scale-[0.97]"
      style={{
        border: active ? `1.5px solid ${ACCENT}` : "1.5px solid rgba(0,0,0,0.06)",
        background: active ? "rgba(224,112,40,0.08)" : CARD_BG,
        backdropFilter: BLUR,
      }}
    >
      <div className="text-[15px] font-semibold" style={{ color: active ? ACCENT : "#1a1a1a" }}>{label}</div>
      {subtitle && <div className="text-[11px] mt-0.5" style={{ color: "#a0a0a0" }}>{subtitle}</div>}
    </button>
  );
}

function SectionLabel({ children }) {
  return (
    <div className="text-[13px] font-semibold uppercase tracking-wider mb-3" style={{ color: "#a0a0a0" }}>
      {children}
    </div>
  );
}

export default function MobileSettings({ isPremium = false, onUpgrade }) {
  const queryClient = useQueryClient();
  const { logout } = useAuth();
  const [activePage, setActivePage] = useState(null);
  const [saving, setSaving] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");

  const { data: user } = useQuery({
    queryKey: ["currentUser"],
    queryFn: () => base44.auth.me(),
  });

  const { data: preferences, isLoading } = useQuery({
    queryKey: ["userPreferences"],
    queryFn: async () => {
      const prefs = await base44.entities.UserPreferences.filter({ created_by: user?.email });
      return prefs[0] || null;
    },
    enabled: !!user,
  });

  const [draft, setDraft] = useState(null);

  useEffect(() => {
    if (preferences) setDraft({ ...preferences });
  }, [preferences]);

  const openPage = (page) => {
    if (preferences) setDraft({ ...preferences });
    setActivePage(page);
  };

  const closePage = () => setActivePage(null);

  const saveDraft = async () => {
    if (!draft || !preferences?.id) return;
    setSaving(true);
    try {
      await base44.entities.UserPreferences.update(preferences.id, draft);
      queryClient.invalidateQueries({ queryKey: ["userPreferences"] });
      toast.success("Saved!");
      setTimeout(closePage, 350);
    } catch {
      toast.error("Save failed. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const deleteAccountMutation = useMutation({
    mutationFn: () => base44.functions.invoke("deleteAccount", { confirm: true }),
    onSuccess: () => { toast.success("Account deleted."); logout(true); },
    onError: (err) => toast.error(err?.message || "Could not delete account."),
  });

  if (isLoading || !draft) {
    return (
      <div className="flex items-center justify-center py-32">
        <div className="animate-pulse text-slate-400">Loading...</div>
      </div>
    );
  }

  const tickerCount = draft.portfolio_holdings?.length || 0;
  const memberSince = preferences?.created_date
    ? format(new Date(preferences.created_date), "MMM d, yyyy")
    : "—";

  const settingItems = [
    { id: "account", icon: User, color: "#3b82f6", bg: "rgba(59,130,246,0.1)", label: "Account", desc: user?.email || "Manage your account" },
    { id: "portfolio", icon: BarChart3, color: "#eab308", bg: "rgba(234,179,8,0.1)", label: "Portfolio", desc: `${tickerCount} tickers tracked` },
    { id: "investment", icon: Shield, color: "#22c55e", bg: "rgba(34,197,94,0.1)", label: "Investment Profile", desc: "Risk tolerance & goals" },
    { id: "sectors", icon: Globe, color: "#a855f7", bg: "rgba(168,85,247,0.1)", label: "Sector Interests", desc: "Industries you follow" },
    { id: "briefing", icon: Mic, color: "#06b6d4", bg: "rgba(6,182,212,0.1)", label: "Briefing & Voice", desc: "Length, tone, and voice style" },
  ];

  return (
    <div
      className="relative z-10"
      style={{
        paddingTop: "calc(24px + env(safe-area-inset-top, 0px))",
        paddingBottom: "calc(84px + env(safe-area-inset-bottom, 0px))",
      }}
    >
      {/* Title */}
      <div className="px-5 mb-5">
        <h1 style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: 28, fontWeight: 500 }} className="text-slate-900">
          Settings
        </h1>
        <p className="text-[14px] mt-1" style={{ color: "#a0a0a0" }}>Manage your account & preferences</p>
      </div>

      {/* Upgrade card */}
      {!isPremium && (
        <div className="mx-5 mb-5 rounded-[20px] p-5 relative overflow-hidden" style={{ background: `linear-gradient(135deg, ${ACCENT}, #c85d1e)` }}>
          <div className="absolute -top-8 -right-8 w-28 h-28 rounded-full" style={{ background: "rgba(255,255,255,0.1)" }} />
          <div className="relative">
            <h3 className="text-white text-lg font-semibold mb-1.5" style={{ fontFamily: "'Playfair Display', Georgia, serif" }}>
              Upgrade to Pro
            </h3>
            <p className="text-white/85 text-[13px] leading-relaxed mb-4">
              Unlimited briefings, priority generation, and premium voices
            </p>
            <button
              type="button"
              onClick={onUpgrade}
              className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-full text-[14px] font-semibold active:scale-[0.97] transition-transform"
              style={{ background: "#fff", color: "#c85d1e" }}
            >
              <Crown className="w-4 h-4" />
              Upgrade Now
            </button>
          </div>
        </div>
      )}

      {/* Setting items */}
      <div className="px-5 space-y-2 mb-8">
        {settingItems.map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => openPage(item.id)}
              className="w-full flex items-center justify-between p-4 rounded-2xl active:scale-[0.985] transition-transform"
              style={{ background: CARD_BG, backdropFilter: BLUR, border: BORDER }}
            >
              <div className="flex items-center gap-3.5">
                <div className="w-9 h-9 rounded-[10px] flex items-center justify-center" style={{ background: item.bg }}>
                  <Icon className="w-[18px] h-[18px]" style={{ color: item.color }} />
                </div>
                <div className="text-left">
                  <div className="text-[15px] font-medium text-slate-900">{item.label}</div>
                  <div className="text-[12px]" style={{ color: "#a0a0a0" }}>{item.desc}</div>
                </div>
              </div>
              <ChevronRight className="w-4 h-4" style={{ color: "#a0a0a0" }} />
            </button>
          );
        })}
      </div>

      {/* Logout */}
      <div className="px-5">
        <button
          type="button"
          onClick={() => logout(true)}
          className="w-full flex items-center justify-center gap-2 py-4 rounded-2xl text-[15px] font-semibold active:bg-red-50 transition-colors"
          style={{ border: "1px solid rgba(220,53,69,0.2)", color: "#dc3545" }}
        >
          <LogOut className="w-[18px] h-[18px]" />
          Log Out
        </button>
      </div>

      {/* ═══════ SUB-PAGES ═══════ */}

      {/* ACCOUNT */}
      <SubPageShell isOpen={activePage === "account"} onClose={closePage} title="Account" onSave={saveDraft} saving={saving}>
        <div className="space-y-6">
          <div>
            <SectionLabel>Display Name</SectionLabel>
            <input
              type="text"
              value={draft.display_name || ""}
              onChange={(e) => setDraft((d) => ({ ...d, display_name: e.target.value }))}
              placeholder="Enter your name"
              className="w-full px-4 py-3 rounded-[14px] text-[15px] outline-none"
              style={{ background: CARD_BG, backdropFilter: BLUR, border: BORDER }}
            />
            <p className="text-[12px] mt-2" style={{ color: "#a0a0a0" }}>
              This is the name used in your greeting on the home screen.
            </p>
          </div>

          <div className="rounded-[16px] overflow-hidden" style={{ background: CARD_BG, backdropFilter: BLUR, border: BORDER }}>
            {[
              { label: "Email", value: user?.email || "—" },
              { label: "Plan", value: isPremium ? "Pro" : "Free" },
              { label: "Daily Limit", value: "3 briefings/day" },
              { label: "Member Since", value: memberSince },
            ].map((row, i) => (
              <div
                key={row.label}
                className="flex items-center justify-between px-4 py-3.5"
                style={i > 0 ? { borderTop: "1px solid rgba(0,0,0,0.04)" } : undefined}
              >
                <span className="text-[13px] font-medium" style={{ color: "#a0a0a0" }}>{row.label}</span>
                <span className="text-[14px] font-medium text-slate-900">{row.value}</span>
              </div>
            ))}
          </div>

          <div className="rounded-[16px] p-4" style={{ border: "1px solid rgba(220,53,69,0.15)" }}>
            <SectionLabel>Danger Zone</SectionLabel>
            <button
              type="button"
              onClick={() => {
                const answer = window.prompt('Type DELETE to confirm account deletion');
                if (answer === "DELETE") deleteAccountMutation.mutate();
                else if (answer !== null) toast.error('Please type DELETE to confirm.');
              }}
              disabled={deleteAccountMutation.isPending}
              className="w-full py-3 rounded-[14px] text-[14px] font-semibold active:bg-red-50 transition-colors disabled:opacity-50"
              style={{ border: "1px solid rgba(220,53,69,0.2)", color: "#dc3545" }}
            >
              <Trash2 className="inline w-4 h-4 mr-1.5 -mt-0.5" />
              {deleteAccountMutation.isPending ? "Deleting..." : "Delete My Account"}
            </button>
          </div>
        </div>
      </SubPageShell>

      {/* PORTFOLIO */}
      <SubPageShell isOpen={activePage === "portfolio"} onClose={closePage} title="Portfolio" onSave={saveDraft} saving={saving}>
        <div className="space-y-5">
          <SectionLabel>Your Tickers</SectionLabel>

          {(draft.portfolio_holdings || []).length === 0 ? (
            <p className="text-[13px] italic" style={{ color: "#a0a0a0" }}>No tickers yet. Search below to add.</p>
          ) : (
            <div className="space-y-2">
              {(draft.portfolio_holdings || []).map((sym) => (
                <div
                  key={sym}
                  className="flex items-center justify-between px-4 py-3 rounded-[14px]"
                  style={{ background: CARD_BG, backdropFilter: BLUR, border: BORDER }}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className="w-10 h-10 rounded-xl flex items-center justify-center text-[11px] font-bold text-white"
                      style={{ background: `hsl(${(sym.charCodeAt(0) * 37) % 360}, 55%, 50%)` }}
                    >
                      {sym.slice(0, 4)}
                    </div>
                    <span className="text-[15px] font-semibold text-slate-900">{sym}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setDraft((d) => ({ ...d, portfolio_holdings: d.portfolio_holdings?.filter((s) => s !== sym) || [] }))}
                    className="w-8 h-8 rounded-lg flex items-center justify-center active:bg-red-100"
                    style={{ background: "rgba(220,53,69,0.08)", color: "#dc3545" }}
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}

          <div
            className="rounded-[14px] text-[12px] px-3.5 py-2.5 leading-relaxed"
            style={{ background: "rgba(224,112,40,0.04)", color: "#a0a0a0" }}
          >
            {!isPremium && tickerCount >= 3 ? (
              <><strong style={{ color: ACCENT }}>Free plan limit reached.</strong> Upgrade to Pro for up to 10.</>
            ) : (
              <>Free plan: 3 tickers max. <strong style={{ color: ACCENT }}>Upgrade to Pro</strong> for up to 10.</>
            )}
          </div>

          <StockPicker
            selectedStocks={draft.portfolio_holdings || []}
            onAdd={(sym) => setDraft((d) => ({ ...d, portfolio_holdings: [...(d.portfolio_holdings || []), sym] }))}
            onRemove={(sym) => setDraft((d) => ({ ...d, portfolio_holdings: d.portfolio_holdings?.filter((s) => s !== sym) || [] }))}
            maxStocks={isPremium ? 10 : 3}
          />
        </div>
      </SubPageShell>

      {/* INVESTMENT PROFILE */}
      <SubPageShell isOpen={activePage === "investment"} onClose={closePage} title="Investment Profile" onSave={saveDraft} saving={saving}>
        <div className="space-y-7">
          <div>
            <SectionLabel>Risk Tolerance</SectionLabel>
            <div className="grid grid-cols-3 gap-2">
              {[
                { value: "conservative", label: "Conservative" },
                { value: "moderate", label: "Moderate" },
                { value: "aggressive", label: "Aggressive" },
              ].map((opt) => (
                <ChoiceCard
                  key={opt.value}
                  label={opt.label}
                  active={draft.risk_tolerance === opt.value}
                  onClick={() => setDraft((d) => ({ ...d, risk_tolerance: opt.value }))}
                />
              ))}
            </div>
          </div>

          <div>
            <SectionLabel>Investment Goals</SectionLabel>
            <div className="flex flex-wrap gap-2">
              {goalOptions.map((g) => (
                <Chip
                  key={g}
                  label={g}
                  active={draft.investment_goals?.includes(g)}
                  onToggle={() =>
                    setDraft((d) => ({
                      ...d,
                      investment_goals: d.investment_goals?.includes(g)
                        ? d.investment_goals.filter((x) => x !== g)
                        : [...(d.investment_goals || []), g],
                    }))
                  }
                />
              ))}
            </div>
          </div>
        </div>
      </SubPageShell>

      {/* SECTOR INTERESTS */}
      <SubPageShell isOpen={activePage === "sectors"} onClose={closePage} title="Sector Interests" onSave={saveDraft} saving={saving}>
        <div className="space-y-7">
          <div>
            <SectionLabel>Industries</SectionLabel>
            <div className="flex flex-wrap gap-2">
              {industryOptions.map((i) => (
                <Chip
                  key={i}
                  label={i}
                  active={draft.investment_interests?.includes(i)}
                  onToggle={() =>
                    setDraft((d) => ({
                      ...d,
                      investment_interests: d.investment_interests?.includes(i)
                        ? d.investment_interests.filter((x) => x !== i)
                        : [...(d.investment_interests || []), i],
                    }))
                  }
                />
              ))}
            </div>
          </div>

          <div>
            <SectionLabel>Themes & Strategies</SectionLabel>
            <div className="flex flex-wrap gap-2">
              {themeOptions.map((t) => (
                <Chip
                  key={t}
                  label={t}
                  active={draft.investment_interests?.includes(t)}
                  onToggle={() =>
                    setDraft((d) => ({
                      ...d,
                      investment_interests: d.investment_interests?.includes(t)
                        ? d.investment_interests.filter((x) => x !== t)
                        : [...(d.investment_interests || []), t],
                    }))
                  }
                />
              ))}
            </div>
          </div>
        </div>
      </SubPageShell>

      {/* BRIEFING & VOICE */}
      <SubPageShell isOpen={activePage === "briefing"} onClose={closePage} title="Briefing & Voice" onSave={saveDraft} saving={saving}>
        <div className="space-y-7">
          <div>
            <SectionLabel>Briefing Length</SectionLabel>
            <div className="flex flex-col gap-2">
              {[
                { value: "short", label: "~5 min", sub: "Quick catch-up" },
                { value: "medium", label: "~8 min", sub: "Standard" },
                { value: "long", label: "~12 min", sub: "Deep dive" },
              ].map((opt) => (
                <ChoiceCard
                  key={opt.value}
                  label={opt.label}
                  subtitle={opt.sub}
                  active={draft.briefing_length === opt.value}
                  onClick={() => setDraft((d) => ({ ...d, briefing_length: opt.value }))}
                />
              ))}
            </div>
          </div>

          <div>
            <SectionLabel>Voice Style</SectionLabel>
            <div className="flex flex-col gap-2">
              {[
                { value: "professional", label: "Professional", sub: "CNBC anchor" },
                { value: "conversational", label: "Conversational", sub: "Casual & warm" },
                { value: "hybrid", label: "Hybrid", sub: "Best of both" },
              ].map((opt) => (
                <ChoiceCard
                  key={opt.value}
                  label={opt.label}
                  subtitle={opt.sub}
                  active={draft.preferred_voice === opt.value}
                  onClick={() => setDraft((d) => ({ ...d, preferred_voice: opt.value }))}
                />
              ))}
            </div>
          </div>
        </div>
      </SubPageShell>
    </div>
  );
}
