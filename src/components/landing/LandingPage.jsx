import { useState, useRef } from "react"
import { Hero } from "./Hero"
import { ValueProps } from "./ValueProps"
import { HowItWorks } from "./HowItWorks"
import { CTASection } from "./CTASection"
import { Footer } from "./Footer"
import { WaitlistModal } from "./WaitlistModal"

export function LandingPage({ onSignIn }) {
  const [isWaitlistOpen, setIsWaitlistOpen] = useState(false)
  const [hasConverted, setHasConverted] = useState(false)
  
  // Refs for section tracking
  const heroRef = useRef(null)
  const valuePropsRef = useRef(null)
  const howItWorksRef = useRef(null)
  const ctaRef = useRef(null)
  const footerRef = useRef(null)

  const openWaitlist = (location = 'Unknown') => {
    setIsWaitlistOpen(true)
  }
  
  const closeWaitlist = () => {
    setIsWaitlistOpen(false)
  }
  
  const handleWaitlistSuccess = () => {
    setHasConverted(true)
  }

  return (
    <div className="landing-theme">
      <main className="min-h-screen bg-background text-foreground">
        <div ref={heroRef} data-section="Hero">
          <Hero onSignIn={onSignIn} onJoinWaitlist={() => openWaitlist('Hero')} />
        </div>
        <div ref={valuePropsRef} data-section="Value Props">
          <ValueProps />
        </div>
        <div ref={howItWorksRef} data-section="How It Works">
          <HowItWorks />
        </div>
        <div ref={ctaRef} data-section="CTA Section">
          <CTASection onSignIn={onSignIn} onJoinWaitlist={() => openWaitlist('CTA Section')} />
        </div>
        <div ref={footerRef} data-section="Footer">
          <Footer />
        </div>
      </main>

      <WaitlistModal 
        isOpen={isWaitlistOpen} 
        onClose={closeWaitlist}
        onSuccess={handleWaitlistSuccess}
      />
    </div>
  )
}
