import { motion } from "framer-motion"
import { AudioPlayerPreview } from "./AudioPlayerPreview"

export function Hero({ onSignIn }) {
  return (
    <section className="relative min-h-screen overflow-hidden">
      {/* Subtle gradient background */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute inset-0 bg-gradient-to-b from-background via-background to-[oklch(0.10_0.01_260)]" />
        <div className="absolute top-0 left-1/2 -translate-x-1/2 h-[800px] w-[1200px] rounded-full bg-[oklch(0.78_0.12_85_/_0.03)] blur-[120px]" />
      </div>

      <div className="relative mx-auto max-w-7xl px-6 lg:px-12">
        {/* Nav */}
        <motion.nav
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.8 }}
          className="flex items-center justify-between py-8 lg:py-10"
        >
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-sm bg-gradient-to-br from-[oklch(0.78_0.12_85)] to-[oklch(0.65_0.10_60)]" />
            <span className="text-lg tracking-wide text-foreground/90">PULSE</span>
          </div>
          <button
            type="button"
            onClick={onSignIn}
            className="text-sm tracking-wide text-muted-foreground transition-colors hover:text-foreground"
          >
            Sign In
          </button>
        </motion.nav>

        {/* Hero content */}
        <div className="grid items-center gap-16 pt-12 lg:grid-cols-2 lg:gap-24 lg:pt-20">
          {/* Left column - Text */}
          <div>
            <motion.p
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
              className="mb-6 text-sm tracking-[0.2em] uppercase text-[oklch(0.78_0.12_85)]"
            >
              Your Morning Intelligence
            </motion.p>
            
            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.1 }}
              className="font-serif text-4xl font-medium leading-[1.1] tracking-tight text-foreground md:text-5xl lg:text-6xl"
            >
              Markets move fast.
              <br />
              <span className="text-[oklch(0.78_0.12_85)]">Stay ahead.</span>
            </motion.h1>
            
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.6, delay: 0.3 }}
              className="my-8 editorial-line w-24"
            />
            
            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.4 }}
              className="text-lg leading-relaxed text-muted-foreground max-w-md"
            >
              AI-curated market briefings delivered to your ears every morning. 
              Five minutes. Personalized to your portfolio. No noise.
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.6 }}
              className="mt-10 flex flex-col gap-6 sm:flex-row sm:items-center"
            >
              <button
                type="button"
                onClick={onSignIn}
                className="group relative overflow-hidden rounded-sm bg-[oklch(0.78_0.12_85)] px-8 py-4 text-sm font-medium tracking-wide text-[oklch(0.12_0.01_260)] transition-all hover:bg-[oklch(0.85_0.12_85)]"
              >
                <span className="relative z-10">Start Free Trial</span>
              </button>
              <div className="flex items-center gap-3 text-sm text-muted-foreground">
                <span className="h-1 w-1 rounded-full bg-[oklch(0.78_0.12_85)]" />
                <span>No credit card required</span>
              </div>
            </motion.div>
          </div>

          {/* Right column - Audio Player */}
          <motion.div
            initial={{ opacity: 0, x: 40 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 1, delay: 0.4 }}
            className="relative lg:justify-self-end"
          >
            <AudioPlayerPreview />
          </motion.div>
        </div>

        {/* Bottom stats */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.8 }}
          className="mt-24 lg:mt-32 pb-16"
        >
          <div className="editorial-line mb-10" />
          <div className="grid grid-cols-2 gap-8 md:grid-cols-4">
            {[
              { value: "5 min", label: "Daily briefing" },
              { value: "7 AM", label: "Delivered sharp" },
              { value: "100%", label: "Personalized" },
              { value: "∞", label: "Market coverage" },
            ].map((stat, i) => (
              <motion.div
                key={stat.label}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.9 + i * 0.1 }}
              >
                <p className="font-serif text-3xl text-[oklch(0.78_0.12_85)]">{stat.value}</p>
                <p className="mt-1 text-sm text-muted-foreground">{stat.label}</p>
              </motion.div>
            ))}
          </div>
        </motion.div>
      </div>
    </section>
  )
}
