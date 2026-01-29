import { motion } from "framer-motion"
import { Zap } from "lucide-react"
import { AudioPlayerPreview } from "./AudioPlayerPreview"
import { MarketTicker } from "./MarketTicker"

export function Hero({ onSignIn }) {
  return (
    <section className="relative min-h-screen overflow-hidden pb-12 pt-8">
      {/* Background gradient */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -right-1/4 -top-1/4 h-[600px] w-[600px] rounded-full bg-primary/5 blur-3xl" />
        <div className="absolute -bottom-1/4 -left-1/4 h-[600px] w-[600px] rounded-full bg-accent/5 blur-3xl" />
      </div>

      <div className="relative mx-auto max-w-6xl px-6">
        {/* Nav */}
        <motion.nav
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="flex items-center justify-between py-6"
        >
          <div className="flex items-center gap-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-accent">
              <Zap className="h-5 w-5 text-primary-foreground" />
            </div>
            <span className="font-serif text-xl text-foreground">PulseApp</span>
          </div>
          <button
            type="button"
            onClick={onSignIn}
            className="rounded-full border border-border bg-card/60 px-5 py-2 text-sm font-medium text-foreground backdrop-blur-sm transition-colors hover:bg-card"
          >
            Sign In
          </button>
        </motion.nav>

        {/* Hero content */}
        <div className="grid items-center gap-12 pt-12 lg:grid-cols-2 lg:gap-16 lg:pt-24">
          {/* Left column - Text */}
          <div className="text-center lg:text-left">
            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.1 }}
              className="font-serif text-4xl leading-tight text-foreground md:text-5xl lg:text-6xl text-balance"
            >
              Your Daily Financial Market Briefing
            </motion.h1>
            
            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.3 }}
              className="mt-6 text-lg leading-relaxed text-muted-foreground md:text-xl text-pretty"
            >
              PulseApp turns financial news into personalized audio briefings you can listen to every morning. Focus on what matters. Cut through market noise.
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.5 }}
              className="mt-8 flex flex-col items-center gap-4 sm:flex-row lg:justify-start"
            >
              <button
                type="button"
                onClick={onSignIn}
                className="group flex w-full items-center justify-center gap-2 rounded-full bg-gradient-to-r from-primary to-accent px-8 py-4 font-medium text-primary-foreground shadow-lg transition-all hover:shadow-xl sm:w-auto"
              >
                Start Listening (Beta)
                <span className="transition-transform group-hover:translate-x-0.5">→</span>
              </button>
              <span className="text-sm text-muted-foreground">
                No credit card required
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
