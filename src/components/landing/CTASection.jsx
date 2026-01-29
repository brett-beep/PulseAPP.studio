import { motion } from "framer-motion"

export function CTASection({ onSignIn }) {
  return (
    <section className="py-32 relative overflow-hidden">
      {/* Background gradient */}
      <div className="absolute inset-0 bg-gradient-to-b from-background to-[oklch(0.10_0.01_260)]" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-[600px] w-[800px] rounded-full bg-[oklch(0.78_0.12_85_/_0.04)] blur-[100px]" />
      
      <div className="relative mx-auto max-w-3xl px-6 text-center">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
        >
          <p className="text-sm tracking-[0.2em] uppercase text-[oklch(0.78_0.12_85)] mb-6">
            Get Started
          </p>
          
          <h2 className="font-serif text-3xl md:text-4xl lg:text-5xl text-foreground leading-tight">
            Your first briefing arrives
            <br />
            <span className="text-[oklch(0.78_0.12_85)]">tomorrow at 7am</span>
          </h2>
          
          <p className="mt-6 text-lg text-muted-foreground max-w-md mx-auto">
            Join the beta. Start your mornings informed, not overwhelmed.
          </p>
          
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.2 }}
            className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4"
          >
            <button
              type="button"
              onClick={onSignIn}
              className="w-full sm:w-auto rounded-sm bg-[oklch(0.78_0.12_85)] px-10 py-4 text-sm font-medium tracking-wide text-[oklch(0.12_0.01_260)] transition-all hover:bg-[oklch(0.85_0.12_85)]"
            >
              Start Free Trial
            </button>
            
            <button
              type="button"
              className="w-full sm:w-auto rounded-sm border border-[oklch(0.35_0.01_260)] bg-transparent px-10 py-4 text-sm font-medium tracking-wide text-foreground transition-all hover:border-[oklch(0.50_0.01_260)] hover:bg-[oklch(0.18_0.01_260)]"
            >
              Learn More
            </button>
          </motion.div>

          <motion.p
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ delay: 0.3 }}
            className="mt-6 text-sm text-muted-foreground"
          >
            No credit card required • Cancel anytime
          </motion.p>
        </motion.div>
      </div>
    </section>
  )
}
