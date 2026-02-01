import { useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Cpu, Bitcoin, Building2, TrendingUp, Gem, BarChart3, Check } from "lucide-react"
import { base44 } from "@/api/base44Client"

const interests = [
  { id: "tech", label: "Tech Stocks", icon: Cpu },
  { id: "crypto", label: "Crypto", icon: Bitcoin },
  { id: "realestate", label: "Real Estate", icon: Building2 },
  { id: "economy", label: "Economy", icon: TrendingUp },
  { id: "commodities", label: "Commodities", icon: Gem },
  { id: "markets", label: "Markets", icon: BarChart3 },
]

export function InterestSelection() {
  const [selected, setSelected] = useState(["tech", "markets"])

  const toggleInterest = (id) => {
    const wasSelected = selected.includes(id)
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    )
    
    // Track interest button clicks
    base44.analytics.track({
      eventName: "interest_button_clicked",
      properties: {
        interest_id: id,
        interest_label: interests.find(i => i.id === id)?.label,
        action: wasSelected ? "unselected" : "selected"
      }
    })
  }

  return (
    <section className="py-24">
      <div className="mx-auto max-w-4xl px-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          className="mb-12 text-center"
        >
          <h2 className="font-serif text-3xl text-foreground md:text-4xl text-balance">
            What matters to you?
          </h2>
          <p className="mt-4 text-lg text-muted-foreground">
            Select your interests to personalize your briefings
          </p>
        </motion.div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {interests.map((interest, i) => {
            const isSelected = selected.includes(interest.id)
            const IconComponent = interest.icon
            return (
              <motion.button
                key={interest.id}
                type="button"
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-50px" }}
                transition={{ duration: 0.4, delay: i * 0.08 }}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => toggleInterest(interest.id)}
                className={`relative flex items-center gap-4 rounded-xl border p-5 text-left transition-all duration-300 ${
                  isSelected
                    ? "border-primary/50 bg-primary/5 shadow-md shadow-primary/10"
                    : "border-border/50 bg-card/40 hover:border-border hover:bg-card/60"
                }`}
              >
                <div
                  className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-lg transition-colors ${
                    isSelected ? "bg-primary/20" : "bg-muted/50"
                  }`}
                >
                  <IconComponent
                    className={`h-5 w-5 transition-colors ${
                      isSelected ? "text-primary" : "text-muted-foreground"
                    }`}
                  />
                </div>
                <span
                  className={`font-medium transition-colors ${
                    isSelected ? "text-foreground" : "text-muted-foreground"
                  }`}
                >
                  {interest.label}
                </span>

                {/* Check indicator */}
                <AnimatePresence>
                  {isSelected && (
                    <motion.div
                      initial={{ scale: 0, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      exit={{ scale: 0, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      className="absolute right-4 flex h-6 w-6 items-center justify-center rounded-full bg-primary"
                    >
                      <Check className="h-3.5 w-3.5 text-primary-foreground" />
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Selected glow effect */}
                {isSelected && (
                  <div className="pointer-events-none absolute inset-0 -z-10 rounded-xl bg-primary/5" />
                )}
              </motion.button>
            )
          })}
        </div>
      </div>
    </section>
  )
}