import { useState } from "react"
import { Hero } from "./Hero"
import { ValueProps } from "./ValueProps"
import { HowItWorks } from "./HowItWorks"
import { CTASection } from "./CTASection"
import { WaitlistModal } from "./WaitlistModal"

export function LandingPage({ onSignIn }) {
  const [isWaitlistOpen, setIsWaitlistOpen] = useState(false)

  const openWaitlist = () => setIsWaitlistOpen(true)
  const closeWaitlist = () => setIsWaitlistOpen(false)

  return (
    <div className="landing-theme">
      <main className="min-h-screen bg-background text-foreground">
        <Hero onSignIn={onSignIn} onJoinWaitlist={openWaitlist} />
        <ValueProps />
        <HowItWorks />
        <CTASection onSignIn={onSignIn} onJoinWaitlist={openWaitlist} />
      </main>

      <WaitlistModal isOpen={isWaitlistOpen} onClose={closeWaitlist} />
    </div>
  )
}
