import { motion } from "framer-motion"
import { ArrowRight, Sparkles } from "lucide-react"
import { base44 } from "@/api/base44Client"

export function CTASection({ onSignIn, onJoinWaitlist }) {
  return (
    <section className="py-24 relative">
      {/* Background glow */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-[500px] w-[700px] rounded-full bg-gradient-to-br from-primary/10 to-accent/10 blur-3xl" />
      </div>

      <div className="relative mx-auto max-w-4xl px-6 text-center">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          className="glass-card-strong rounded-2xl sm:rounded-3xl p-8 sm:p-12 md:p-16 glow-primary"
        >
          {/* Badge */}
          <motion.div className="mb-6 inline-flex items-center gap-2 glass-subtle rounded-full px-3 sm:px-4 py-1.5 sm:py-2">
            <Sparkles className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-primary flex-shrink-0" />
            <span className="text-xs sm:text-sm font-medium text-foreground/80 whitespace-nowrap">Limited Beta Access</span>
          </motion.div>

          <h2 className="font-serif text-2xl sm:text-3xl font-medium text-foreground md:text-4xl lg:text-5xl text-balance leading-tight">
            Ready to transform your <span className="text-gradient">mornings</span>?
          </h2>
          
          <p className="mt-4 text-base sm:text-lg text-muted-foreground max-w-lg mx-auto">
            Join investors who start their day informed, not overwhelmed.
          </p>
          
          <motion.button
            type="button"
            onClick={() => {
              base44.analytics.track({
                eventName: "cta_button_clicked",
                properties: { location: "cta_section_bottom" }
              })
              onSignIn()
            }}
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.98 }}
            className="group relative mt-8 sm:mt-10 inline-flex items-center gap-2 sm:gap-3 overflow-hidden rounded-full bg-gradient-to-r from-primary to-accent px-8 sm:px-10 py-4 sm:py-5 text-base sm:text-lg font-semibold text-primary-foreground shadow-xl glow-primary transition-all hover:shadow-2xl whitespace-nowrap"
          >
            {/* Pulse animation background */}
            <motion.div
              className="absolute inset-0 bg-gradient-to-r from-accent to-primary opacity-0"
              animate={{ opacity: [0, 0.4, 0] }}
              transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut" }}
            />
            <span className="relative">Early Access (Beta)</span>
            <ArrowRight className="relative h-4 w-4 sm:h-5 sm:w-5 transition-transform group-hover:translate-x-1 flex-shrink-0" />
          </motion.button>

          <p className="mt-6 text-sm text-muted-foreground">
            Free to start • Personalized daily briefings
          </p>
        </motion.div>
      </div>
    </section>
  )
}