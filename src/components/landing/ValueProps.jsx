import { motion } from "framer-motion"

const features = [
  {
    number: "01",
    title: "Personalized Intelligence",
    description: "Our AI analyzes your portfolio and investment interests to curate only what matters to you. No generic market recaps.",
  },
  {
    number: "02",
    title: "Five Minutes, Every Morning",
    description: "Delivered at 7am. Listen during your commute, workout, or morning coffee. Everything you need, nothing you don't.",
  },
  {
    number: "03",
    title: "Actionable Insights",
    description: "Not just news—context. We explain what happened, why it matters, and what you might consider doing about it.",
  },
]

export function ValueProps() {
  return (
    <section className="py-32 relative">
      {/* Background */}
      <div className="absolute inset-0 bg-[oklch(0.10_0.01_260)]" />
      
      <div className="relative mx-auto max-w-7xl px-6 lg:px-12">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          className="mb-20"
        >
          <p className="text-sm tracking-[0.2em] uppercase text-[oklch(0.78_0.12_85)] mb-4">
            Why Pulse
          </p>
          <h2 className="font-serif text-3xl md:text-4xl lg:text-5xl text-foreground max-w-2xl leading-tight">
            Stop drowning in financial news.
            <span className="text-muted-foreground"> Start making sense of it.</span>
          </h2>
        </motion.div>

        <div className="grid gap-px bg-[oklch(0.25_0.01_260)] md:grid-cols-3">
          {features.map((feature, i) => (
            <motion.div
              key={feature.number}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-50px" }}
              transition={{ duration: 0.5, delay: i * 0.1 }}
              className="bg-[oklch(0.10_0.01_260)] p-8 lg:p-12 group"
            >
              <span className="font-mono text-sm text-[oklch(0.78_0.12_85)]">
                {feature.number}
              </span>
              <h3 className="mt-6 font-serif text-xl lg:text-2xl text-foreground">
                {feature.title}
              </h3>
              <p className="mt-4 text-muted-foreground leading-relaxed">
                {feature.description}
              </p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}
