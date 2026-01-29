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
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => toggleInterest(interest.id)}
            className={`relative flex items-center gap-3 rounded-xl border p-4 text-left transition-all duration-300 ${
              isSelected
                ? "border-primary/50 bg-primary/5 shadow-md shadow-primary/10"
                : "border-border/50 bg-card/40 hover:border-border hover:bg-card/60"
            }`}
          >
            <div
              className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg transition-colors ${
                isSelected ? "bg-primary/20" : "bg-muted/50"
              }`}
            >
              <IconComponent
                className={`h-4 w-4 transition-colors ${
                  isSelected ? "text-primary" : "text-muted-foreground"
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

            <AnimatePresence>
              {isSelected && (
                <motion.div
                  initial={{ scale: 0, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0, opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="absolute right-3 flex h-5 w-5 items-center justify-center rounded-full bg-primary"
                >
                  <Check className="h-3 w-3 text-primary-foreground" />
                </motion.div>
              )}
            </AnimatePresence>
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
    // Animate cursor moving to play button and clicking
    const sequence = async () => {
      await new Promise(r => setTimeout(r, 1000))
      setCursorPosition({ x: 50, y: 50 })
      setIsHovering(true)
      await new Promise(r => setTimeout(r, 800))
      setIsPlaying(true)
      await new Promise(r => setTimeout(r, 3000))
      setIsPlaying(false)
      setIsHovering(false)
      setCursorPosition({ x: 80, y: 60 })
    }
    
    sequence()
    const interval = setInterval(sequence, 6000)
    return () => clearInterval(interval)
  }, [])

  return (
    <div className="relative">
      {/* Brushstroke fade effect */}
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-background pointer-events-none z-10" />
      <div className="absolute inset-0 bg-gradient-to-r from-background/50 via-transparent to-background/50 pointer-events-none z-10" />
      
      <motion.div 
        className="relative mx-auto max-w-xs rounded-2xl bg-card/80 p-5 shadow-lg backdrop-blur-sm border border-border/50"
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
      >
        {/* Mini waveform */}
        <div className="mb-4 flex h-12 items-center justify-center gap-0.5">
          {[...Array(32)].map((_, i) => (
            <motion.div
              key={i}
              className="w-1 rounded-full bg-primary/50"
              animate={
                isPlaying
                  ? {
                      height: [8, Math.random() * 30 + 10, 8],
                    }
                  : { height: 8 }
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
        <div className="mb-4">
          <div className="h-1 w-full rounded-full bg-muted overflow-hidden">
            <motion.div
              className="h-full rounded-full bg-gradient-to-r from-primary to-accent"
              animate={{ width: isPlaying ? "60%" : "0%" }}
              transition={{ duration: 3, ease: "linear" }}
            />
          </div>
          <div className="mt-1 flex justify-between text-xs text-muted-foreground">
            <span>{isPlaying ? "1:48" : "0:00"}</span>
            <span>5:00</span>
          </div>
        </div>

        {/* Controls */}
        <div className="flex items-center justify-center">
          <motion.div
            className={`flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-primary to-accent text-primary-foreground shadow-lg transition-transform ${isHovering ? 'scale-110' : ''}`}
          >
            <AnimatePresence mode="wait">
              {isPlaying ? (
                <motion.div
                  key="pause"
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  exit={{ scale: 0 }}
                >
                  <Pause className="h-5 w-5" fill="currentColor" />
                </motion.div>
              ) : (
                <motion.div
                  key="play"
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  exit={{ scale: 0 }}
                >
                  <Play className="h-5 w-5 translate-x-0.5" fill="currentColor" />
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
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" className="drop-shadow-lg">
            <path d="M5 3L19 12L12 13L9 20L5 3Z" fill="white" stroke="#333" strokeWidth="1.5"/>
          </svg>
        </motion.div>
      </motion.div>
    </div>
  )
}

function WorkflowIntegrations() {
  return (
    <div className="relative">
      {/* Brushstroke fade effect */}
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-background pointer-events-none z-10" />
      
      <motion.div
        className="relative mx-auto max-w-md"
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
      >
        {/* Integration cards flowing together */}
        <div className="relative flex items-center justify-center gap-4">
          {/* Email integration */}
          <motion.div
            className="rounded-xl bg-card/80 p-4 shadow-lg backdrop-blur-sm border border-border/50"
            animate={{ y: [0, -5, 0] }}
            transition={{ duration: 3, repeat: Infinity, delay: 0 }}
          >
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-500/10">
                <Mail className="h-5 w-5 text-blue-500" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Email</p>
                <p className="text-sm font-medium text-foreground">7:00 AM</p>
              </div>
            </div>
          </motion.div>

          {/* Arrow */}
          <motion.div
            animate={{ x: [0, 5, 0] }}
            transition={{ duration: 1.5, repeat: Infinity }}
          >
            <ArrowRight className="h-5 w-5 text-muted-foreground" />
          </motion.div>

          {/* Calendar integration */}
          <motion.div
            className="rounded-xl bg-card/80 p-4 shadow-lg backdrop-blur-sm border border-border/50"
            animate={{ y: [0, -5, 0] }}
            transition={{ duration: 3, repeat: Infinity, delay: 0.5 }}
          >
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-green-500/10">
                <Calendar className="h-5 w-5 text-green-500" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Calendar</p>
                <p className="text-sm font-medium text-foreground">Synced</p>
              </div>
            </div>
          </motion.div>

          {/* Arrow */}
          <motion.div
            animate={{ x: [0, 5, 0] }}
            transition={{ duration: 1.5, repeat: Infinity, delay: 0.3 }}
          >
            <ArrowRight className="h-5 w-5 text-muted-foreground" />
          </motion.div>

          {/* Portfolio integration */}
          <motion.div
            className="rounded-xl bg-card/80 p-4 shadow-lg backdrop-blur-sm border border-border/50"
            animate={{ y: [0, -5, 0] }}
            transition={{ duration: 3, repeat: Infinity, delay: 1 }}
          >
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-purple-500/10">
                <Briefcase className="h-5 w-5 text-purple-500" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Portfolio</p>
                <p className="text-sm font-medium text-foreground">Context</p>
              </div>
            </div>
          </motion.div>
        </div>

        {/* Connection lines */}
        <motion.div 
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-0.5 bg-gradient-to-r from-transparent via-primary/20 to-transparent -z-10"
          animate={{ opacity: [0.3, 0.6, 0.3] }}
          transition={{ duration: 2, repeat: Infinity }}
        />
      </motion.div>
    </div>
  )
}

export function HowItWorks() {
  return (
    <section className="py-24">
      <div className="mx-auto max-w-6xl px-6">
        {/* Section header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          className="mb-16 text-center"
        >
          <h2 className="font-serif text-3xl text-foreground md:text-4xl lg:text-5xl">
            How It Works
          </h2>
        </motion.div>

        {/* Three steps */}
        <div className="space-y-24">
          {/* Step 1: What Matters To You */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            className="grid gap-8 lg:grid-cols-2 lg:gap-12 items-center"
          >
            <div>
              <div className="flex items-center gap-3 mb-4">
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary">1</span>
                <h3 className="font-serif text-2xl text-foreground">What Matters To You</h3>
              </div>
              <p className="text-lg text-muted-foreground mb-6">
                Select your interests to personalize your briefings
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
            className="grid gap-8 lg:grid-cols-2 lg:gap-12 items-center"
          >
            <div className="lg:order-2">
              <div className="flex items-center gap-3 mb-4">
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary">2</span>
                <h3 className="font-serif text-2xl text-foreground">Get Your Briefings</h3>
              </div>
              <p className="text-lg text-muted-foreground">
                PulseApp generates up to 3 audio market briefings per day, prioritizing market-moving developments relevant to your selections
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
            className="grid gap-8 lg:grid-cols-2 lg:gap-12 items-center"
          >
            <div>
              <div className="flex items-center gap-3 mb-4">
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary">3</span>
                <h3 className="font-serif text-2xl text-foreground">Connect Your Workflow</h3>
                <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">Coming Soon</span>
              </div>
              <p className="text-lg text-muted-foreground">
                Optional integrations with email, calendar, and financial planning tools—so briefings arrive at the right time and reflect what's relevant to your day and your portfolio context.
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
