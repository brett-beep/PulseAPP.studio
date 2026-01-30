import { Hero } from "./Hero"
import { ValueProps } from "./ValueProps"
import { HowItWorks } from "./HowItWorks"
import { CTASection } from "./CTASection"

export function LandingPage({ onSignIn }) {
  return (
    <div className="landing-theme">
      <main className="min-h-screen bg-background text-foreground">
        <Hero onSignIn={onSignIn} />
        <ValueProps />
        <HowItWorks />
        <CTASection onSignIn={onSignIn} />
      </main>
    </div>
  )
}
