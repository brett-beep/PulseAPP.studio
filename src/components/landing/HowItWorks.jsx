import { useState, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Cpu, Bitcoin, Building2, TrendingUp, Gem, BarChart3, Check, Play, Pause, Calendar, Mail, Briefcase, ArrowRight } from "lucide-react"

const interests = [
  { id: "tech", label: "Tech Stocks", icon: Cpu },
  { id: "crypto", label: "Crypto", icon: Bitcoin },
  { id: "realestate", label: "Real Estate", icon: Building2 },
  { id: "economy", label: "Economy", icon: TrendingUp },
  { id: "commodities", label: "Commodities", icon: Gem },
  { id: "markets", label: "Markets", icon: BarChart3 },
]

function InterestSelector() {
  const [selected, setSelected] = useState(["tech", "markets"])

  const toggleInterest = (id) => {
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    )
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {interests.map((interest, i) => {
        const isSelected = selected.includes(interest.id)
        const IconComponent = interest.icon
        return (
          <motion.button
            key={interest.id}
            type="button"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-50px" }}
            transition={{ duration: 0.4, delay: i * 0.08 }}
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => toggleInterest(interest.id)}
            className={`relative flex items-center gap-3 rounded-xl p-4 pr-14 text-left transition-all duration-300 ${
              isSelected
                ? "glass-card-strong shadow-lg glow-primary"
                : "glass-card hover:shadow-lg"
            }`}
          >
            <div
              className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition-all ${
                isSelected 
                  ? "bg-gradient-to-br from-primary to-accent shadow-md" 
                  : "bg-muted/50"
              }`}
            >
              <IconComponent
                className={`h-4 w-4 transition-colors ${
                  isSelected ? "text-primary-foreground" : "text-muted-foreground"
                }`}
              />
            </div>
            <span
              className={`text-sm font-medium transition-colors ${
                isSelected ? "text-foreground" : "text-muted-foreground"
              }`}
            >
              {interest.label}
            </span>

            {/* Check indicator - positioned absolutely with proper spacing */}
            <div className="absolute right-4 top-1/2 -translate-y-1/2">
              <AnimatePresence>
                {isSelected && (
                  <motion.div
                    initial={{ scale: 0, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="flex h-6 w-6 items-center justify-center rounded-full bg-gradient-to-br from-primary to-accent shadow-md"
                  >
                    <Check className="h-3.5 w-3.5 text-primary-foreground" />
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.button>
        )
      })}
    </div>
  )
}

function AnimatedAudioPlayer() {
  const [isPlaying, setIsPlaying] = useState(false)
  const [cursorPosition, setCursorPosition] = useState({ x: 80, y: 60 })
  const [isHovering, setIsHovering] = useState(false)

  useEffect(() => {
    const sequence = async () => {
      await new Promise(r => setTimeout(r, 1000))
      // Move cursor precisely to center of play button
      setCursorPosition({ x: 46, y: 72 })
      setIsHovering(true)
      await new Promise(r => setTimeout(r, 800))
      setIsPlaying(true)
      await new Promise(r => setTimeout(r, 3000))
      setIsPlaying(false)
      setIsHovering(false)
      setCursorPosition({ x: 75, y: 30 })
    }
    
    sequence()
    const interval = setInterval(sequence, 6000)
    return () => clearInterval(interval)
  }, [])

  return (
    <div className="relative">
      {/* Brushstroke fade effect */}
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-background/80 pointer-events-none z-10 rounded-3xl" />
      <div className="absolute inset-0 bg-gradient-to-r from-background/30 via-transparent to-background/30 pointer-events-none z-10 rounded-3xl" />
      
      <motion.div 
        className="relative mx-auto max-w-xs glass-card-strong rounded-2xl p-6"
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
      >
        {/* Mini waveform */}
        <div className="mb-5 flex h-14 items-center justify-center gap-0.5">
          {[...Array(32)].map((_, i) => (
            <motion.div
              key={i}
              className="w-1 rounded-full bg-gradient-to-t from-primary/60 to-accent/60"
              animate={
                isPlaying
                  ? {
                      height: [8, Math.random() * 35 + 12, 8],
                    }
                  : { height: 10 }
              }
              transition={{
                duration: 0.6,
                repeat: isPlaying ? Infinity : 0,
                delay: i * 0.02,
                ease: "easeInOut",
              }}
            />
          ))}
        </div>

        {/* Progress bar */}
        <div className="mb-5">
          <div className="h-1.5 w-full rounded-full bg-muted/40 overflow-hidden glass-border">
            <motion.div
              className="h-full rounded-full bg-gradient-to-r from-primary to-accent"
              animate={{ width: isPlaying ? "60%" : "0%" }}
              transition={{ duration: 3, ease: "linear" }}
            />
          </div>
          <div className="mt-2 flex justify-between text-xs text-muted-foreground font-medium">
            <span>{isPlaying ? "1:48" : "0:00"}</span>
            <span>5:00</span>
          </div>
        </div>

        {/* Controls */}
        <div className="flex items-center justify-center">
          <motion.div
            className={`flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-primary to-accent text-primary-foreground shadow-xl transition-all ${isHovering ? 'scale-110 glow-primary' : ''}`}
          >
            <AnimatePresence mode="wait">
              {isPlaying ? (
                <motion.div
                  key="pause"
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  exit={{ scale: 0 }}
                >
                  <Pause className="h-6 w-6" fill="currentColor" />
                </motion.div>
              ) : (
                <motion.div
                  key="play"
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  exit={{ scale: 0 }}
                >
                  <Play className="h-6 w-6 translate-x-0.5" fill="currentColor" />
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        </div>

        {/* Animated cursor */}
        <motion.div
          className="absolute z-20 pointer-events-none"
          animate={{ 
            left: `${cursorPosition.x}%`, 
            top: `${cursorPosition.y}%`,
          }}
          transition={{ duration: 0.8, ease: "easeInOut" }}
        >
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" className="drop-shadow-xl">
            <path d="M5 3L19 12L12 13L9 20L5 3Z" fill="white" stroke="#333" strokeWidth="1.5"/>
          </svg>
        </motion.div>

        {/* Glow behind */}
        <div className="absolute -inset-4 -z-10 rounded-3xl bg-gradient-to-br from-primary/20 to-accent/20 opacity-50 blur-2xl" />
      </motion.div>
    </div>
  )
}

function WorkflowIntegrations() {
  return (
    <div className="relative">
      {/* Brushstroke fade effect */}
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-background/60 pointer-events-none z-10" />
      
      <motion.div
        className="relative mx-auto max-w-lg"
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
      >
        {/* Integration cards flowing together */}
        <div className="relative flex flex-wrap items-center justify-center gap-4">
          {/* Email integration */}
          <motion.div
            className="glass-card-strong rounded-xl p-4 shadow-lg"
            animate={{ y: [0, -6, 0] }}
            transition={{ duration: 3, repeat: Infinity, delay: 0 }}
          >
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-500/15">
                <Mail className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground font-medium">Email</p>
                <p className="text-sm font-semibold text-foreground">7:00 AM</p>
              </div>
            </div>
          </motion.div>

          {/* Arrow */}
          <motion.div
            animate={{ x: [0, 6, 0], opacity: [0.5, 1, 0.5] }}
            transition={{ duration: 1.5, repeat: Infinity }}
            className="hidden sm:block"
          >
            <ArrowRight className="h-5 w-5 text-primary" />
          </motion.div>

          {/* Calendar integration */}
          <motion.div
            className="glass-card-strong rounded-xl p-4 shadow-lg"
            animate={{ y: [0, -6, 0] }}
            transition={{ duration: 3, repeat: Infinity, delay: 0.5 }}
          >
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-green-500/15">
                <Calendar className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground font-medium">Calendar</p>
                <p className="text-sm font-semibold text-foreground">Synced</p>
              </div>
            </div>
          </motion.div>

          {/* Arrow */}
          <motion.div
            animate={{ x: [0, 6, 0], opacity: [0.5, 1, 0.5] }}
            transition={{ duration: 1.5, repeat: Infinity, delay: 0.3 }}
            className="hidden sm:block"
          >
            <ArrowRight className="h-5 w-5 text-primary" />
          </motion.div>

          {/* Portfolio integration */}
          <motion.div
            className="glass-card-strong rounded-xl p-4 shadow-lg"
            animate={{ y: [0, -6, 0] }}
            transition={{ duration: 3, repeat: Infinity, delay: 1 }}
          >
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-purple-500/15">
                <Briefcase className="h-5 w-5 text-purple-600" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground font-medium">Portfolio</p>
                <p className="text-sm font-semibold text-foreground">Context</p>
              </div>
            </div>
          </motion.div>
        </div>

        {/* Connection line glow */}
        <motion.div 
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-3/4 h-1 bg-gradient-to-r from-transparent via-primary/30 to-transparent -z-10 blur-sm hidden sm:block"
          animate={{ opacity: [0.3, 0.7, 0.3] }}
          transition={{ duration: 2, repeat: Infinity }}
        />
      </motion.div>
    </div>
  )
}

export function HowItWorks() {
  return (
    <section className="py-24 relative">
      {/* Background ambient glow */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute top-1/4 -left-1/4 h-[500px] w-[500px] rounded-full bg-primary/5 blur-3xl" />
        <div className="absolute bottom-1/4 -right-1/4 h-[400px] w-[400px] rounded-full bg-accent/5 blur-3xl" />
      </div>

      <div className="relative mx-auto max-w-6xl px-6">
        {/* Section header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          className="mb-20 text-center"
        >
          <motion.div className="mb-4 inline-flex items-center gap-2 glass-subtle rounded-full px-4 py-2">
            <span className="flex h-2 w-2 rounded-full bg-gradient-to-r from-primary to-accent" />
            <span className="text-sm font-medium text-foreground/80">Simple 3-Step Process</span>
          </motion.div>
          <h2 className="font-serif text-4xl font-medium text-foreground md:text-5xl lg:text-6xl">
            How It <span className="text-gradient">Works</span>
          </h2>
        </motion.div>

        {/* Three steps */}
        <div className="space-y-28">
          {/* Step 1: What Matters To You */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            className="grid gap-10 lg:grid-cols-2 lg:gap-16 items-center"
          >
            <div>
              <div className="flex items-center gap-4 mb-5">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-accent text-base font-bold text-primary-foreground shadow-lg">1</span>
                <h3 className="font-serif text-2xl md:text-3xl font-medium text-foreground">What Matters To You</h3>
              </div>
              <p className="text-lg text-muted-foreground leading-relaxed">
                Select your interests to personalize your briefings.
                <br />
                Choose the topics, sectors, and companies you care about.
              </p>
            </div>
            <div>
              <InterestSelector />
            </div>
          </motion.div>

          {/* Step 2: Get Your Briefings */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            className="grid gap-10 lg:grid-cols-2 lg:gap-16 items-center"
          >
            <div className="lg:order-2">
              <div className="flex items-center gap-4 mb-5">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-accent text-base font-bold text-primary-foreground shadow-lg">2</span>
                <h3 className="font-serif text-2xl md:text-3xl font-medium text-foreground">Get Your Briefings</h3>
              </div>
              <p className="text-lg text-muted-foreground leading-relaxed">
                PulseApp generates up to <strong className="text-foreground font-semibold">3 audio market briefings</strong> per day, prioritizing market-moving developments relevant to your selections.
                <br />
                Prioritize convenience and investor-related takeaways.
              </p>
            </div>
            <div className="lg:order-1">
              <AnimatedAudioPlayer />
            </div>
          </motion.div>

          {/* Step 3: Connect Your Workflow */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            className="grid gap-10 lg:grid-cols-2 lg:gap-16 items-center"
          >
            <div>
              <div className="flex items-center gap-4 mb-5">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-accent text-base font-bold text-primary-foreground shadow-lg">3</span>
                <h3 className="font-serif text-2xl md:text-3xl font-medium text-foreground">Connect Your Workflow</h3>
                <span className="glass-subtle rounded-full px-3 py-1 text-xs font-semibold text-muted-foreground">Coming Soon</span>
              </div>
              <p className="text-lg text-muted-foreground leading-relaxed">
                Integrations with email, calendar, and financial planning tools.
                <br />
                An audio briefing assistant that fits your workflow.
              </p>
            </div>
            <div>
              <WorkflowIntegrations />
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  )
}
