import { motion } from "framer-motion"
import { Brain, Clock, Headphones } from "lucide-react"

const props = [
  {
    icon: Brain,
    title: "Personalized Intelligence",
    description: "AI curates news specifically for your portfolio and investment interests.",
  },
  {
    icon: Clock,
    title: "5 Minutes Daily",
    description: "Delivered at 7am sharp. Everything you need to know, nothing you don't.",
  },
  {
    icon: Headphones,
    title: "Audio First",
    description: "Listen during your commute, workout, or morning coffee.",
  },
]

export function ValueProps() {
  return (
    <section className="py-20">
      <div className="mx-auto max-w-6xl px-6">
        <div className="grid gap-6 md:grid-cols-3">
          {props.map((prop, i) => (
            <motion.div
              key={prop.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-100px" }}
              transition={{ duration: 0.5, delay: i * 0.1 }}
              whileHover={{ y: -6, scale: 1.02 }}
              className="group glass-card rounded-2xl p-8 transition-all duration-300 hover:shadow-xl hover:glow-primary"
            >
              <div className="mb-5 inline-flex rounded-xl bg-gradient-to-br from-primary/15 to-accent/10 p-4">
                <prop.icon className="h-6 w-6 text-primary" />
              </div>
              <h3 className="mb-3 font-serif text-xl font-medium text-foreground">{prop.title}</h3>
              <p className="leading-relaxed text-muted-foreground">{prop.description}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}
