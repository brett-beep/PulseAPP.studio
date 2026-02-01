import { useState, useEffect, useRef } from "react"
import { Hero } from "./Hero"
import { ValueProps } from "./ValueProps"
import { HowItWorks } from "./HowItWorks"
import { CTASection } from "./CTASection"
import { Footer } from "./Footer"
import { WaitlistModal } from "./WaitlistModal"
import {
  trackLandingPageView,
  trackLandingPageExit,
  setupSectionTracking,
  trackCTAClick,
} from "@/components/lib/mixpanel"

export function LandingPage({ onSignIn }) {
  const [isWaitlistOpen, setIsWaitlistOpen] = useState(false)
  const [hasConverted, setHasConverted] = useState(false)
  
  // Refs for section tracking
  const heroRef = useRef(null)
  const valuePropsRef = useRef(null)
  const howItWorksRef = useRef(null)
  const ctaRef = useRef(null)
  const footerRef = useRef(null)

  // Track page view on mount
  useEffect(() => {
    trackLandingPageView()
    
    // Track page exit on unmount or beforeunload
    const handleBeforeUnload = () => {
      trackLandingPageExit(hasConverted)
    }
    
    window.addEventListener('beforeunload', handleBeforeUnload)
    
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload)
      trackLandingPageExit(hasConverted)
    }
  }, [hasConverted])
  
  // Set up IntersectionObserver for section tracking
  useEffect(() => {
    const cleanup = setupSectionTracking([
      heroRef,
      valuePropsRef,
      howItWorksRef,
      ctaRef,
      footerRef,
    ])
    
    return cleanup
  }, [])

  const openWaitlist = (location = 'Unknown') => {
    trackCTAClick(location)
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