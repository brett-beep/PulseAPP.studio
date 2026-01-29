import { motion } from "framer-motion"
import { ArrowRight } from "lucide-react"

export function CTASection({ onSignIn }) {
  return (
    <section className="py-24">
      <div className="mx-auto max-w-3xl px-6 text-center">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          className="space-y-8"
        >
          <h2 className="font-serif text-3xl text-foreground md:text-4xl text-balance">
            Ready to transform your mornings?
          </h2>
          
          <motion.button
            type="button"
            onClick={onSignIn}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className="group relative inline-flex items-center gap-2 overflow-hidden rounded-full bg-gradient-to-r from-primary to-accent px-8 py-4 text-lg font-medium text-primary-foreground shadow-lg transition-shadow hover:shadow-xl"
          >
            {/* Pulse animation background */}
            <motion.div
              className="absolute inset-0 bg-gradient-to-r from-accent to-primary opacity-0"
              animate={{ opacity: [0, 0.3, 0] }}
              transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
            />
            <span className="relative">Early Access (Beta)</span>
            <ArrowRight className="relative h-5 w-5 transition-transform group-hover:translate-x-1" />
          </motion.button>

          <p className="text-sm text-muted-foreground">
            No credit card required • First briefing tomorrow at 7am
          </p>
        </motion.div>
      </div>
    </section>
  )
}
