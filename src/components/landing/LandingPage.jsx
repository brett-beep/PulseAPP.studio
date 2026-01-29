import { Hero } from "./Hero"
import { ValueProps } from "./ValueProps"
import { InterestSelection } from "./InterestSelection"
import { CTASection } from "./CTASection"
import { Footer } from "./Footer"

export function LandingPage({ onSignIn }) {
  return (
    <div className="landing-theme">
      <main className="min-h-screen bg-background text-foreground">
        <Hero onSignIn={onSignIn} />
        <ValueProps />
        <InterestSelection />
        <CTASection onSignIn={onSignIn} />
        <Footer />
      </main>
    </div>
  )
}
