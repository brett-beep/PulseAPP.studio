import { useState } from "react"
import { motion } from "framer-motion"
import { Check } from "lucide-react"

const interests = [
  { id: "tech", label: "Tech & AI" },
  { id: "crypto", label: "Crypto" },
  { id: "realestate", label: "Real Estate" },
  { id: "macro", label: "Macro Economy" },
  { id: "commodities", label: "Commodities" },
  { id: "equities", label: "Equities" },
]

export function InterestSelection() {
  const [selected, setSelected] = useState(["tech", "equities"])

  const toggleInterest = (id) => {
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    )
  }

  return (
    <section className="py-32 relative">
      <div className="mx-auto max-w-4xl px-6 lg:px-12">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          className="text-center mb-16"
        >
          <p className="text-sm tracking-[0.2em] uppercase text-[oklch(0.78_0.12_85)] mb-4">
            Personalization
          </p>
          <h2 className="font-serif text-3xl md:text-4xl text-foreground">
            What do you care about?
          </h2>
          <p className="mt-4 text-muted-foreground max-w-md mx-auto">
            Select your interests. We&apos;ll tailor every briefing to what matters to your portfolio.
          </p>
        </motion.div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {interests.map((interest, i) => {
            const isSelected = selected.includes(interest.id)
            return (
              <motion.button
                key={interest.id}
                type="button"
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-50px" }}
                transition={{ duration: 0.4, delay: i * 0.05 }}
                onClick={() => toggleInterest(interest.id)}
                className={`relative flex items-center justify-between rounded-sm border px-5 py-4 text-left transition-all duration-200 ${
                  isSelected
                    ? "border-[oklch(0.78_0.12_85)] bg-[oklch(0.78_0.12_85_/_0.08)]"
                    : "border-[oklch(0.25_0.01_260)] bg-[oklch(0.14_0.01_260)] hover:border-[oklch(0.35_0.01_260)]"
                }`}
              >
                <span
                  className={`text-sm transition-colors ${
                    isSelected ? "text-foreground" : "text-muted-foreground"
                  }`}
                >
                  {interest.label}
                </span>

                <div
                  className={`flex h-5 w-5 items-center justify-center rounded-sm border transition-all ${
                    isSelected
                      ? "border-[oklch(0.78_0.12_85)] bg-[oklch(0.78_0.12_85)]"
                      : "border-[oklch(0.35_0.01_260)]"
                  }`}
                >
                  {isSelected && (
                    <Check className="h-3 w-3 text-[oklch(0.12_0.01_260)]" strokeWidth={3} />
                  )}
                </div>
              </motion.button>
            )
          })}
        </div>

        <motion.p
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ delay: 0.3 }}
          className="mt-8 text-center text-sm text-muted-foreground"
        >
          {selected.length === 0 
            ? "Select at least one interest" 
            : `${selected.length} selected — your briefings will focus on these areas`
          }
        </motion.p>
      </div>
    </section>
  )
}
