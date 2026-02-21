import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import StockPicker from "@/components/StockPicker";

const STEPS = [
  { id: "name", title: "Welcome to PulseApp", subtitle: "Let's personalize your experience", progress: 1 },
  { id: "goals", title: "Investment Goals", subtitle: "What are you looking to achieve?", progress: 2 },
  { id: "risk", title: "Risk Tolerance", subtitle: "How do you approach risk?", progress: 3 },
  { id: "sectors", title: "Sector Interests", subtitle: "What industries excite you?", progress: 4 },
  { id: "portfolio", title: "Your Portfolio", subtitle: "Add stocks you want to track", progress: 5 },
];

const TOTAL_STEPS = 5;

const GOALS = [
  { label: "Retirement", icon: "🏖️" },
  { label: "Wealth Growth", icon: "📈" },
  { label: "Passive Income", icon: "💰" },
  { label: "Capital Preservation", icon: "🛡️" },
  { label: "Short-term Gains", icon: "⚡" },
  { label: "Education Fund", icon: "🎓" },
];

const RISKS = [
  { label: "Conservative", value: "conservative", icon: "🛡️", desc: "Steady & safe" },
  { label: "Moderate", value: "moderate", icon: "⚖️", desc: "Balanced approach" },
  { label: "Aggressive", value: "aggressive", icon: "🚀", desc: "High risk, high reward" },
];

const SECTORS = [
  "Technology", "Healthcare", "Finance", "Energy", "Industrials", "Consumer",
  "Real Estate", "Crypto", "ETFs", "Commodities", "ESG/Sustainable",
];

export default function MobileOnboarding({ onComplete }) {
  const [step, setStep] = useState(0);
  const [direction, setDirection] = useState(1);
  const [animKey, setAnimKey] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [preferences, setPreferences] = useState({
    display_name: "",
    investment_goals: [],
    risk_tolerance: "moderate",
    investment_interests: [],
    portfolio_holdings: [],
    briefing_length: "medium",
    preferred_voice: "professional",
    onboarding_completed: true,
  });

  const goNext = () => {
    if (step < STEPS.length - 1) {
      setDirection(1);
      setAnimKey((k) => k + 1);
      setStep((s) => s + 1);
    } else {
      handleComplete();
    }
  };

  const goBack = () => {
    if (step > 0) {
      setDirection(-1);
      setAnimKey((k) => k + 1);
      setStep((s) => s - 1);
    }
  };

  const toggleGoal = (g) => {
    setPreferences((prev) => ({
      ...prev,
      investment_goals: prev.investment_goals?.includes(g)
        ? prev.investment_goals.filter((x) => x !== g)
        : [...(prev.investment_goals || []), g],
    }));
  };

  const toggleSector = (s) => {
    setPreferences((prev) => ({
      ...prev,
      investment_interests: prev.investment_interests?.includes(s)
        ? prev.investment_interests.filter((x) => x !== s)
        : [...(prev.investment_interests || []), s],
    }));
  };

  const handleComplete = async () => {
    setIsSubmitting(true);
    try {
      await onComplete(preferences);
    } catch (error) {
      console.error("Error completing onboarding:", error);
      setIsSubmitting(false);
    }
  };

  const current = STEPS[step];
  const canContinue = step > 0 || preferences.display_name?.trim();
  const isLastStep = step === STEPS.length - 1;

  return (
    <div className="mobile-onboarding-root" style={styles.root}>
      <div className="mobile-onboarding-orbs" style={styles.orbs}>
        <div style={styles.orb1} />
        <div style={styles.orb2} />
        <div style={styles.orb3} />
      </div>

      <header style={styles.header}>
        <div style={styles.progressRow}>
          {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
            <div
              key={i}
              style={{
                ...styles.progressSegment,
                background: i < current.progress ? "#e07028" : "rgba(0,0,0,0.08)",
              }}
            />
          ))}
        </div>
        <h1 style={styles.title}>{current.title}</h1>
        <p style={styles.subtitle}>{current.subtitle}</p>
      </header>

      <main style={styles.content} className="mobile-onboarding-content">
        <AnimatePresence mode="wait">
          <motion.div
            key={animKey}
            initial={{ opacity: 0, x: direction > 0 ? 40 : -40 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: direction > 0 ? -40 : 40 }}
            transition={{ duration: 0.35, ease: [0.2, 0.9, 0.3, 1] }}
            style={styles.stepWrapper}
          >
            {step === 0 && (
              <NameStep
                name={preferences.display_name || ""}
                setName={(v) => setPreferences((p) => ({ ...p, display_name: v }))}
              />
            )}
            {step === 1 && (
              <GoalsStep
                goals={GOALS}
                selected={preferences.investment_goals || []}
                toggle={toggleGoal}
              />
            )}
            {step === 2 && (
              <RiskStep
                risks={RISKS}
                selected={preferences.risk_tolerance}
                setSelected={(v) => setPreferences((p) => ({ ...p, risk_tolerance: v }))}
              />
            )}
            {step === 3 && (
              <SectorsStep
                sectors={SECTORS}
                selected={preferences.investment_interests || []}
                toggle={toggleSector}
              />
            )}
            {step === 4 && (
              <PortfolioStep
                preferences={preferences}
                setPreferences={setPreferences}
              />
            )}
          </motion.div>
        </AnimatePresence>
      </main>

      <footer style={styles.footer}>
        {step > 0 ? (
          <button
            type="button"
            onClick={goBack}
            disabled={isSubmitting}
            style={styles.backBtn}
            className="mobile-onboarding-btn"
          >
            ← Back
          </button>
        ) : (
          <div style={{ width: 1 }} />
        )}
        <button
          type="button"
          onClick={goNext}
          disabled={isSubmitting || !canContinue}
          style={{
            ...styles.continueBtn,
            opacity: !canContinue ? 0.5 : 1,
          }}
          className="mobile-onboarding-btn"
        >
          {isSubmitting ? "Completing..." : isLastStep ? "Finish →" : "Continue →"}
        </button>
      </footer>
    </div>
  );
}

function NameStep({ name, setName }) {
  return (
    <div style={styles.stepContent}>
      <label style={styles.label}>What should we call you?</label>
      <input
        type="text"
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Enter your name"
        style={styles.input}
        autoComplete="name"
        autoFocus
      />
    </div>
  );
}

function GoalsStep({ goals, selected, toggle }) {
  return (
    <div style={styles.stepContent}>
      <label style={styles.label}>What are you investing for?</label>
      <p style={styles.hint}>Select all that apply</p>
      <div style={styles.chipGrid}>
        {goals.map((g, i) => (
          <button
            key={g.label}
            type="button"
            onClick={() => toggle(g.label)}
            style={{
              ...styles.goalChip,
              ...(selected.includes(g.label) ? styles.goalChipSelected : {}),
              animationDelay: `${i * 60}ms`,
            }}
            className="mobile-onboarding-chip"
          >
            <span style={{ fontSize: 20 }}>{g.icon}</span>
            <span style={{ fontSize: 14, fontWeight: 500 }}>{g.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

function RiskStep({ risks, selected, setSelected }) {
  return (
    <div style={styles.stepContent}>
      <label style={styles.label}>How comfortable are you with risk?</label>
      <div style={styles.riskStack}>
        {risks.map((r, i) => (
          <button
            key={r.value}
            type="button"
            onClick={() => setSelected(r.value)}
            style={{
              ...styles.riskCard,
              ...(selected === r.value ? styles.riskCardSelected : {}),
              animationDelay: `${i * 80}ms`,
            }}
            className="mobile-onboarding-chip"
          >
            <span style={{ fontSize: 28 }}>{r.icon}</span>
            <div style={{ textAlign: "left", flex: 1 }}>
              <div style={{ fontWeight: 600, fontSize: 16, color: selected === r.value ? "#c85d1e" : "#222" }}>
                {r.label}
              </div>
              <div style={{ fontSize: 13, color: "#999", marginTop: 2 }}>{r.desc}</div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

function SectorsStep({ sectors, selected, toggle }) {
  return (
    <div style={styles.stepContent}>
      <label style={styles.label}>What industries interest you?</label>
      <p style={styles.hint}>Select all that apply</p>
      <div style={styles.sectorWrap}>
        {sectors.map((s, i) => (
          <button
            key={s}
            type="button"
            onClick={() => toggle(s)}
            style={{
              ...styles.sectorChip,
              ...(selected.includes(s) ? styles.sectorChipSelected : {}),
              animationDelay: `${i * 40}ms`,
            }}
            className="mobile-onboarding-chip"
          >
            {selected.includes(s) && <span style={{ fontSize: 12 }}>✓ </span>}
            {s}
          </button>
        ))}
      </div>
    </div>
  );
}

function PortfolioStep({ preferences, setPreferences }) {
  const tickers = preferences.portfolio_holdings || [];

  return (
    <div style={styles.stepContent}>
      <label style={styles.label}>Add stocks to track</label>
      <p style={styles.hint}>Free plan: up to 3 tickers. Search by symbol or company name.</p>
      <div className="mobile-onboarding-stock-picker">
        <StockPicker
          selectedStocks={tickers}
          onAdd={(sym) =>
            setPreferences((p) => ({
              ...p,
              portfolio_holdings: [...(p.portfolio_holdings || []), sym],
            }))
          }
          onRemove={(sym) =>
            setPreferences((p) => ({
              ...p,
              portfolio_holdings: (p.portfolio_holdings || []).filter((x) => x !== sym),
            }))
          }
          maxStocks={3}
        />
      </div>
    </div>
  );
}

const styles = {
  root: {
    minHeight: "100dvh",
    background: "#faf7f2",
    display: "flex",
    flexDirection: "column",
    overflow: "hidden",
    fontFamily: "'DM Sans', -apple-system, BlinkMacSystemFont, sans-serif",
    paddingTop: "env(safe-area-inset-top, 0px)",
  },
  orbs: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    pointerEvents: "none",
    zIndex: 0,
  },
  orb1: {
    position: "absolute",
    top: "5%",
    right: "10%",
    width: 280,
    height: 280,
    borderRadius: "50%",
    background: "radial-gradient(circle, rgba(224,112,40,0.1) 0%, transparent 70%)",
    filter: "blur(40px)",
  },
  orb2: {
    position: "absolute",
    top: "30%",
    left: "-10%",
    width: 200,
    height: 200,
    borderRadius: "50%",
    background: "radial-gradient(circle, rgba(224,112,40,0.06) 0%, transparent 70%)",
    filter: "blur(30px)",
  },
  orb3: {
    position: "absolute",
    bottom: "15%",
    right: "-5%",
    width: 220,
    height: 220,
    borderRadius: "50%",
    background: "radial-gradient(circle, rgba(224,112,40,0.07) 0%, transparent 70%)",
    filter: "blur(35px)",
  },
  header: {
    padding: "24px 32px 0",
    zIndex: 2,
    flexShrink: 0,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
  },
  progressRow: {
    display: "flex",
    gap: 6,
    marginBottom: 28,
    width: "100%",
  },
  progressSegment: {
    flex: 1,
    height: 3,
    borderRadius: 999,
    transition: "background 0.4s ease",
  },
  title: {
    fontSize: 28,
    fontWeight: 700,
    color: "#1a1a1a",
    margin: 0,
    letterSpacing: "-0.02em",
    lineHeight: 1.15,
    textAlign: "center",
  },
  subtitle: {
    fontSize: 15,
    color: "#888",
    margin: "6px 0 0",
    fontWeight: 400,
    textAlign: "center",
  },
  content: {
    flex: 1,
    padding: "0 32px",
    zIndex: 2,
    overflowY: "auto",
    overflowX: "hidden",
    WebkitOverflowScrolling: "touch",
  },
  stepWrapper: {
    paddingTop: 28,
    width: "100%",
  },
  stepContent: {
    width: "100%",
  },
  label: {
    fontSize: 17,
    fontWeight: 600,
    color: "#222",
    display: "block",
    marginBottom: 4,
    textAlign: "left",
  },
  hint: {
    fontSize: 13,
    color: "#aaa",
    margin: "2px 0 0",
    textAlign: "left",
  },
  input: {
    width: "100%",
    padding: "16px 18px",
    fontSize: 16,
    border: "1.5px solid rgba(0,0,0,0.08)",
    borderRadius: 14,
    background: "rgba(255,255,255,0.7)",
    backdropFilter: "blur(8px)",
    WebkitBackdropFilter: "blur(8px)",
    outline: "none",
    color: "#222",
    fontFamily: "inherit",
    marginTop: 12,
    boxSizing: "border-box",
  },
  chipGrid: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 10,
    marginTop: 16,
    width: "100%",
  },
  goalChip: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    padding: "14px 16px",
    borderRadius: 14,
    border: "1.5px solid rgba(0,0,0,0.06)",
    background: "rgba(255,255,255,0.6)",
    backdropFilter: "blur(8px)",
    WebkitBackdropFilter: "blur(8px)",
    fontFamily: "inherit",
    textAlign: "left",
    cursor: "pointer",
    WebkitTapHighlightColor: "transparent",
    transition: "all 0.2s cubic-bezier(0.34, 1.56, 0.64, 1)",
    animation: "mobileOnboardingFadeUp 0.4s cubic-bezier(0.2, 0.9, 0.3, 1) both",
  },
  goalChipSelected: {
    border: "1.5px solid #e07028",
    background: "rgba(224,112,40,0.06)",
  },
  riskStack: {
    display: "flex",
    flexDirection: "column",
    gap: 12,
    marginTop: 16,
    width: "100%",
  },
  riskCard: {
    display: "flex",
    alignItems: "center",
    gap: 14,
    padding: "18px 20px",
    borderRadius: 16,
    border: "1.5px solid rgba(0,0,0,0.06)",
    background: "rgba(255,255,255,0.6)",
    backdropFilter: "blur(8px)",
    WebkitBackdropFilter: "blur(8px)",
    fontFamily: "inherit",
    textAlign: "left",
    width: "100%",
    cursor: "pointer",
    WebkitTapHighlightColor: "transparent",
    transition: "all 0.25s cubic-bezier(0.34, 1.56, 0.64, 1)",
    animation: "mobileOnboardingFadeUp 0.4s cubic-bezier(0.2, 0.9, 0.3, 1) both",
  },
  riskCardSelected: {
    border: "1.5px solid #e07028",
    background: "rgba(224,112,40,0.06)",
    transform: "scale(1.02)",
  },
  sectorWrap: {
    display: "flex",
    flexWrap: "wrap",
    gap: 10,
    marginTop: 12,
    justifyContent: "flex-start",
    width: "100%",
  },
  sectorChip: {
    padding: "10px 18px",
    borderRadius: 999,
    border: "1.5px solid rgba(0,0,0,0.08)",
    background: "rgba(255,255,255,0.6)",
    backdropFilter: "blur(8px)",
    WebkitBackdropFilter: "blur(8px)",
    fontSize: 14,
    fontWeight: 500,
    color: "#444",
    fontFamily: "inherit",
    cursor: "pointer",
    WebkitTapHighlightColor: "transparent",
    transition: "all 0.25s cubic-bezier(0.34, 1.56, 0.64, 1)",
    animation: "mobileOnboardingFadeUp 0.4s cubic-bezier(0.2, 0.9, 0.3, 1) both",
  },
  sectorChipSelected: {
    border: "1.5px solid #e07028",
    background: "rgba(224,112,40,0.06)",
    color: "#c85d1e",
  },
  portfolioRow: {
    display: "flex",
    gap: 8,
    marginTop: 16,
    alignItems: "stretch",
  },
  addBtn: {
    padding: "0 22px",
    borderRadius: 14,
    background: "linear-gradient(160deg, #f0944a 0%, #e07028 40%, #c85d1e 100%)",
    color: "white",
    fontWeight: 600,
    fontSize: 15,
    border: "none",
    cursor: "pointer",
    fontFamily: "inherit",
    flexShrink: 0,
    minHeight: 52,
    boxShadow: "0 4px 16px rgba(224,112,40,0.3), inset 0 1px 1px rgba(255,255,255,0.25)",
    textShadow: "0 1px 2px rgba(0,0,0,0.15)",
    WebkitTapHighlightColor: "transparent",
  },
  tickerTags: {
    display: "flex",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 14,
  },
  tickerTag: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    padding: "10px 14px",
    borderRadius: 12,
    background: "rgba(224,112,40,0.08)",
    border: "1px solid rgba(224,112,40,0.15)",
    fontSize: 14,
    color: "#c85d1e",
  },
  removeBtn: {
    background: "none",
    border: "none",
    color: "#c85d1e",
    fontSize: 18,
    cursor: "pointer",
    padding: 0,
    lineHeight: 1,
    fontFamily: "inherit",
    WebkitTapHighlightColor: "transparent",
  },
  popularHeader: {
    fontSize: 12,
    fontWeight: 600,
    color: "#aaa",
    letterSpacing: "0.06em",
    textTransform: "uppercase",
    margin: "0 0 10px",
  },
  suggestedWrap: {
    display: "flex",
    flexWrap: "wrap",
    gap: 8,
    justifyContent: "flex-start",
  },
  suggestedChip: {
    display: "flex",
    alignItems: "center",
    gap: 6,
    padding: "8px 14px",
    borderRadius: 10,
    border: "1.5px solid rgba(0,0,0,0.06)",
    background: "rgba(255,255,255,0.6)",
    backdropFilter: "blur(8px)",
    WebkitBackdropFilter: "blur(8px)",
    fontFamily: "inherit",
    fontSize: 13,
    cursor: "pointer",
    WebkitTapHighlightColor: "transparent",
    transition: "all 0.25s cubic-bezier(0.34, 1.56, 0.64, 1)",
    animation: "mobileOnboardingFadeUp 0.35s cubic-bezier(0.2, 0.9, 0.3, 1) both",
  },
  footer: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "16px 32px",
    paddingBottom: "calc(16px + env(safe-area-inset-bottom, 0px))",
    background: "linear-gradient(to top, #faf7f2 60%, transparent)",
    zIndex: 10,
    flexShrink: 0,
  },
  backBtn: {
    padding: "12px 20px",
    borderRadius: 12,
    border: "1.5px solid rgba(0,0,0,0.08)",
    background: "rgba(255,255,255,0.7)",
    fontSize: 14,
    fontWeight: 600,
    color: "#555",
    fontFamily: "inherit",
    cursor: "pointer",
    WebkitTapHighlightColor: "transparent",
    transition: "all 0.25s cubic-bezier(0.34, 1.56, 0.64, 1)",
  },
  continueBtn: {
    padding: "14px 28px",
    borderRadius: 14,
    background: "linear-gradient(160deg, #f0944a 0%, #e07028 40%, #c85d1e 100%)",
    color: "white",
    fontSize: 15,
    fontWeight: 600,
    border: "none",
    cursor: "pointer",
    fontFamily: "inherit",
    boxShadow: "0 6px 24px rgba(224,112,40,0.35), inset 0 1px 1px rgba(255,255,255,0.25), 0 1px 3px rgba(0,0,0,0.1)",
    textShadow: "0 1px 2px rgba(0,0,0,0.15)",
    WebkitTapHighlightColor: "transparent",
    transition: "all 0.25s cubic-bezier(0.34, 1.56, 0.64, 1)",
  },
};
