import { motion } from "framer-motion"

export function Footer() {
  const currentYear = new Date().getFullYear()

  return (
    <footer className="border-t border-border/30 py-12 bg-background/50">
      <div className="mx-auto max-w-6xl px-6">
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          className="flex flex-col items-center justify-between gap-8 md:flex-row"
        >
          {/* Logo */}
          <div className="flex items-center gap-3">
            <img
              src="/pulse-logo.svg"
              alt="PulseApp"
              className="h-10 w-10 object-contain"
            />
            <span className="font-serif text-xl font-medium text-foreground">PulseApp</span>
          </div>

          {/* Tagline */}
          <p className="text-center text-muted-foreground font-medium">
            Made for investors who value their time
          </p>

          {/* Social proof */}
          <div className="flex items-center gap-3">
            <div className="flex -space-x-2">
              {[
                "/team/investor-1.png",
                "/team/investor-2.png",
                "/team/investor-3.png",
                "/team/investor-4.png",
              ].map((photo, i) => (
                <img
                  key={i}
                  src={photo}
                  alt={`Investor ${i + 1}`}
                  className="h-9 w-9 rounded-full border-2 border-background shadow-md object-cover"
                  onError={(e) => {
                    // Fallback to gradient if image fails to load
                    e.target.style.display = 'none'
                    const fallback = document.createElement('div')
                    fallback.className = 'h-9 w-9 rounded-full border-2 border-background shadow-md'
                    fallback.style.backgroundImage = `linear-gradient(135deg, hsl(${25 + i * 20}, 50%, 65%), hsl(${35 + i * 20}, 40%, 75%))`
                    e.target.parentNode.insertBefore(fallback, e.target)
                  }}
                />
              ))}
            </div>
            <span className="text-sm font-medium text-muted-foreground">
              Join 200+ investors
            </span>
          </div>
        </motion.div>

        {/* Bottom section */}
        <div className="mt-10 border-t border-border/20 pt-8 flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="text-sm text-muted-foreground/70">
            © {currentYear} PulseApp. All rights reserved.
          </p>
          <div className="flex items-center gap-6">
            <a href="#" className="text-sm text-muted-foreground/70 hover:text-foreground transition-colors">
              Privacy Policy
            </a>
            <a href="#" className="text-sm text-muted-foreground/70 hover:text-foreground transition-colors">
              Terms of Service
            </a>
            <a href="mailto:hello@pulseapp.studio" className="text-sm text-muted-foreground/70 hover:text-foreground transition-colors">
              Contact
            </a>
          </div>
        </div>
      </div>
    </footer>
  )
}
