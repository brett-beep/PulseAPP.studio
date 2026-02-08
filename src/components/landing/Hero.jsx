import { motion } from "framer-motion"
import { Zap, ArrowRight } from "lucide-react"
import { AudioPlayerPreview } from "./AudioPlayerPreview"
import { MarketTicker } from "./MarketTicker"
import { base44 } from "@/api/base44Client"

export function Hero({ onSignIn, onJoinWaitlist }) {
  return (
    <section className="relative min-h-screen overflow-hidden pb-12 pt-8">
      {/* Background with ambient glows */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        {/* Large ambient circles */}
        <div className="absolute -right-1/4 -top-1/4 h-[700px] w-[700px] rounded-full bg-gradient-to-br from-primary/15 to-accent/10 blur-3xl" />
        <div className="absolute -bottom-1/4 -left-1/4 h-[600px] w-[600px] rounded-full bg-gradient-to-tr from-accent/10 to-primary/5 blur-3xl" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-[400px] w-[400px] rounded-full bg-primary/5 blur-3xl" />
      </div>

      <div className="relative mx-auto max-w-6xl px-6">
        {/* Nav - Glass style */}
        <motion.nav
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="flex items-center justify-between py-6"
        >
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 flex items-center justify-center overflow-hidden flex-shrink-0">
              <img
                src="/pulse-logo.svg"
                alt="PulseApp"
                className="h-full w-full object-contain"
              />
            </div>
            <span className="font-serif text-2xl font-medium text-foreground">PulseApp</span>
          </div>
          {/* Sign In button hidden for waitlist phase */}
        </motion.nav>

        {/* Hero content */}
        <div className="grid items-center gap-12 pt-16 lg:grid-cols-2 lg:gap-20 lg:pt-28">
          {/* Left column - Text */}
          <div className="text-center lg:text-left">
            {/* Badge */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              className="mb-6 inline-flex items-center gap-2 glass-subtle rounded-full px-4 py-2"
            >
              <span className="flex h-2 w-2 rounded-full bg-gradient-to-r from-primary to-accent" />
              <span className="text-sm font-medium text-foreground/80">AI-Powered Market Intelligence</span>
            </motion.div>

            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.1 }}
              className="font-serif text-5xl font-medium leading-[1.1] tracking-tight text-foreground md:text-6xl lg:text-7xl"
            >
              Your <span className="text-gradient">Personal</span>
              <br />
              Financial News Anchor
            </motion.h1>
            
            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.3 }}
              className="mt-6 text-lg leading-relaxed text-muted-foreground md:text-xl lg:text-xl max-w-xl mx-auto lg:mx-0"
            >
              <strong className="font-semibold">PulseApp</strong> turns financial news into personalized audio briefings you can listen to every morning.
              <br className="hidden sm:block" />
              <span className="sm:block">Focus on what matters. Cut through market noise.</span>
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.5 }}
              className="mt-10 flex flex-col items-center gap-4 sm:flex-row lg:justify-start"
            >
              <button
                type="button"
                onClick={() => {
                  base44.analytics.track({
                    eventName: "cta_button_clicked",
                    properties: { location: "hero_top" }
                  })
                  onSignIn()
                }}
                className="group flex w-full items-center justify-center gap-2 rounded-full bg-gradient-to-r from-primary to-accent px-8 py-4 text-base font-semibold text-primary-foreground shadow-xl glow-primary transition-all hover:shadow-2xl hover:scale-[1.02] sm:w-auto whitespace-nowrap"
              >
                Start Listening (Beta)
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
              </button>
              <span className="text-sm text-muted-foreground whitespace-nowrap">
                Free to start. No credit card required
              </span>
            </motion.div>
          </div>

          {/* Right column - Audio Player Preview */}
          <div className="relative">
            <AudioPlayerPreview />
          </div>
        </div>

        {/* Market Ticker */}
        <MarketTicker />
      </div>
    </section>
  )
}