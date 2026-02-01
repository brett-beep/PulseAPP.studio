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
          className="glass-card-strong rounded-3xl p-12 md:p-16 glow-primary"
        >
          {/* Badge */}
          <motion.div className="mb-6 inline-flex items-center gap-2 glass-subtle rounded-full px-4 py-2">
            <Sparkles className="h-4 w-4 text-primary" />
            <span className="text-sm font-medium text-foreground/80">Limited Beta Access</span>
          </motion.div>

          <h2 className="font-serif text-3xl font-medium text-foreground md:text-4xl lg:text-5xl text-balance leading-tight">
            Ready to transform your <span className="text-gradient">mornings</span>?
          </h2>
          
          <p className="mt-4 text-lg text-muted-foreground max-w-lg mx-auto">
            Join thousands of investors who start their day informed, not overwhelmed.
          </p>
          
          <motion.button
            type="button"
            onClick={() => {
              base44.analytics.track({
                eventName: "cta_button_clicked",
                properties: { location: "cta_section_bottom" }
              })
              onJoinWaitlist()
            }}
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.98 }}
            className="group relative mt-10 inline-flex items-center gap-3 overflow-hidden rounded-full bg-gradient-to-r from-primary to-accent px-10 py-5 text-lg font-semibold text-primary-foreground shadow-xl glow-primary transition-all hover:shadow-2xl"
          >
            {/* Pulse animation background */}
            <motion.div
              className="absolute inset-0 bg-gradient-to-r from-accent to-primary opacity-0"
              animate={{ opacity: [0, 0.4, 0] }}
              transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut" }}
            />
            <span className="relative">Join the Waitlist</span>
            <ArrowRight className="relative h-5 w-5 transition-transform group-hover:translate-x-1" />
          </motion.button>

          <p className="mt-6 text-sm text-muted-foreground">
            No credit card required • First briefing tomorrow at 7am
          </p>
        </motion.div>
      </div>
    </section>
  )
}