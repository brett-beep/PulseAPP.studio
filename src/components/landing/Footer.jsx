import { motion } from "framer-motion"
import { Zap } from "lucide-react"

export function Footer() {
  return (
    <footer className="border-t border-border/50 py-12">
      <div className="mx-auto max-w-6xl px-6">
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          className="flex flex-col items-center justify-between gap-6 md:flex-row"
        >
          {/* Logo */}
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-primary to-accent">
              <Zap className="h-4 w-4 text-primary-foreground" />
            </div>
            <span className="font-serif text-lg text-foreground">PulseApp</span>
          </div>

          {/* Tagline */}
          <p className="text-center text-muted-foreground">
            Made for investors who value their time
          </p>

          {/* Social proof */}
          <div className="flex items-center gap-2">
            <div className="flex -space-x-2">
              {[...Array(4)].map((_, i) => (
                <div
                  key={i}
                  className="h-8 w-8 rounded-full border-2 border-background bg-gradient-to-br from-muted to-secondary"
                  style={{
                    backgroundImage: `linear-gradient(135deg, hsl(${30 + i * 15}, 40%, 70%), hsl(${40 + i * 15}, 30%, 80%))`,
                  }}
                />
              ))}
            </div>
            <span className="text-sm text-muted-foreground">
              Join 200+ investors
            </span>
          </div>
        </motion.div>

        <div className="mt-8 border-t border-border/30 pt-8 text-center text-sm text-muted-foreground/60">
          © 2026 PulseApp. All rights reserved.
        </div>
      </div>
    </footer>
  )
}
