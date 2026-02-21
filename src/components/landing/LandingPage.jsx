NOimport { useState, useRef, useEffect } from "react"
import { Hero } from "./Hero"
import { ValueProps } from "./ValueProps"
import { HowItWorks } from "./HowItWorks"
import { CTASection } from "./CTASection"
import { Footer } from "./Footer"
import { WaitlistModal } from "./WaitlistModal"
import { isNativeApp } from "@/utils/isNativeApp"

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

  // Skip landing page in native app — go straight to /login
  useEffect(() => {
    if (isNativeApp()) {
      window.location.replace("/login")
    }
  }, [])

  // Open waitlist modal when user lands via share link: /#waitlist or ?waitlist=1
  useEffect(() => {
    const hash = window.location.hash?.toLowerCase().replace(/^#/, "")
    const params = new URLSearchParams(window.location.search)
    const fromQuery = params.get("waitlist") === "1" || params.get("open") === "waitlist"
    if (hash === "waitlist" || fromQuery) {
      setIsWaitlistOpen(true)
      if (fromQuery) {
        params.delete("waitlist")
        params.delete("open")
        const clean = params.toString() ? `?${params.toString()}` : window.location.pathname || ""
        window.history.replaceState(null, "", clean + (window.location.hash || ""))
      }
    }
  }, [])

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
