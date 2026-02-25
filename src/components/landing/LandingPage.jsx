import { useState, useRef, useEffect } from "react"
import { Hero } from "./Hero"
import { ValueProps } from "./ValueProps"
import { HowItWorks } from "./HowItWorks"
import { CTASection } from "./CTASection"
import { Footer } from "./Footer"
import { WaitlistModal } from "./WaitlistModal"
import { isNativeApp } from "@/utils/isNativeApp"
import { base44 } from "@/api/base44Client"

/**
 * Extended native-app check:
 * The Base44 mobile wrapper uses a plain WKWebView with no special UA or standalone flags.
 * The most reliable signal is: mobile device + loaded from the .base44.app domain.
 */
function shouldSkipLanding() {
  if (isNativeApp()) return true
  const ua = (navigator.userAgent || "").toLowerCase()
  // Median / GoNative UA check
  if (ua.includes("median") || ua.includes("gonative")) return true
  // URL override
  const params = new URLSearchParams(window.location.search)
  if (params.get("app") === "1") return true
  // Base44 mobile wrapper: mobile UA + .base44.app domain
  const isMobileUA = /iphone|ipad|ipod|android/i.test(ua)
  const isBase44Domain = window.location.hostname.endsWith(".base44.app")
  if (isMobileUA && isBase44Domain) return true
  return false
}

export function LandingPage({ onSignIn }) {
  const [isWaitlistOpen, setIsWaitlistOpen] = useState(false)
  const [hasConverted, setHasConverted] = useState(false)
  // Initialize synchronously — if native app, start as true so landing page NEVER flashes
  const [redirectingNative, setRedirectingNative] = useState(() => shouldSkipLanding())
  
  // Refs for section tracking
  const heroRef = useRef(null)
  const valuePropsRef = useRef(null)
  const howItWorksRef = useRef(null)
  const ctaRef = useRef(null)
  const footerRef = useRef(null)

  const openWaitlist = (location = 'Unknown') => {
    setIsWaitlistOpen(true)
  }

  // Skip landing page in native app — go straight to login
  useEffect(() => {
    const debugInfo = {
      shouldSkip: shouldSkipLanding(),
      isNativeApp: isNativeApp(),
      ua: navigator.userAgent,
      standalone: window.navigator?.standalone,
      displayMode: window.matchMedia?.("(display-mode: standalone)")?.matches,
      protocol: window.location?.protocol,
      href: window.location?.href,
      capacitor: !!window.Capacitor,
      urlApp: new URLSearchParams(window.location.search).get("app"),
    }

    if (shouldSkipLanding()) {
      console.log("[LandingPage] Native app detected, redirecting to login...", debugInfo)
      setRedirectingNative(true)
      onSignIn()
      return
    }
    console.log("[LandingPage] shouldSkipLanding() = false", debugInfo)
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

  // While redirecting native app users, show nothing (prevent landing page flash)
  if (redirectingNative) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "#faf7f2" }}>
        <div className="flex gap-2">
          <div className="splash-dot" style={{ animationDelay: "0s" }} />
          <div className="splash-dot" style={{ animationDelay: "0.2s" }} />
          <div className="splash-dot" style={{ animationDelay: "0.4s" }} />
        </div>
      </div>
    )
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