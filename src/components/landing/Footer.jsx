import { motion } from "framer-motion"

export function Footer() {
  return (
    <footer className="border-t border-[oklch(0.20_0.01_260)] py-12">
      <div className="mx-auto max-w-7xl px-6 lg:px-12">
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          className="flex flex-col md:flex-row items-center justify-between gap-6"
        >
          {/* Logo */}
          <div className="flex items-center gap-3">
            <div className="h-6 w-6 rounded-sm bg-gradient-to-br from-[oklch(0.78_0.12_85)] to-[oklch(0.65_0.10_60)]" />
            <span className="text-sm tracking-wide text-foreground/80">PULSE</span>
          </div>

          {/* Links */}
          <div className="flex items-center gap-8 text-sm text-muted-foreground">
            <a href="#" className="transition-colors hover:text-foreground">Privacy</a>
            <a href="#" className="transition-colors hover:text-foreground">Terms</a>
            <a href="#" className="transition-colors hover:text-foreground">Contact</a>
          </div>

          {/* Copyright */}
          <p className="text-sm text-muted-foreground">
            © 2026 Pulse. All rights reserved.
          </p>
        </motion.div>
      </div>
    </footer>
  )
}
