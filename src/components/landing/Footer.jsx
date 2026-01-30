import { motion } from "framer-motion"

export function Footer() {
  return (
    <footer className="border-t border-border/30 py-12">
      <div className="mx-auto max-w-6xl px-6">
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          className="flex flex-col items-center justify-between gap-8 md:flex-row"
        >
          {/* Logo */}
          <div className="flex items-center gap-3">
            <img
              src="/pulse-logo.svg"
              alt="PulseApp"
              className="h-10 w-10 object-contain"
            />
            <span className="font-serif text-xl font-medium text-foreground">PulseApp</span>
          </div>

          {/* Tagline */}
          <p className="text-center text-muted-foreground font-medium">
            Made for investors who value their time
          </p>

          {/* Social proof */}
          <div className="flex items-center gap-3">
            <div className="flex -space-x-2">
              {[...Array(4)].map((_, i) => (
                <div
                  key={i}
                  className="h-9 w-9 rounded-full border-2 border-background shadow-md"
                  style={{
                    backgroundImage: `linear-gradient(135deg, hsl(${25 + i * 20}, 50%, 65%), hsl(${35 + i * 20}, 40%, 75%))`,
                  }}
                />
              ))}
            </div>
            <span className="text-sm font-medium text-muted-foreground">
              Join 200+ investors
            </span>
          </div>
        </motion.div>

        <div className="mt-10 border-t border-border/20 pt-8 text-center text-sm text-muted-foreground/70">
          © 2026 PulseApp. All rights reserved.
        </div>
      </div>
    </footer>
  )
}
