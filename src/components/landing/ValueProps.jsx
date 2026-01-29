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
    <section className="py-12 -mt-8">
      <div className="mx-auto max-w-6xl px-6">
        <div className="grid gap-8 md:grid-cols-3">
          {props.map((prop, i) => (
            <motion.div
              key={prop.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-100px" }}
              transition={{ duration: 0.5, delay: i * 0.1 }}
              whileHover={{ y: -4 }}
              className="group rounded-2xl bg-card/60 p-8 backdrop-blur-sm border border-border/50 transition-shadow duration-300 hover:shadow-lg"
            >
              <div className="mb-4 inline-flex rounded-xl bg-primary/10 p-3">
                <prop.icon className="h-6 w-6 text-primary" />
              </div>
              <h3 className="mb-2 font-serif text-xl text-card-foreground">{prop.title}</h3>
              <p className="leading-relaxed text-muted-foreground">{prop.description}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}
