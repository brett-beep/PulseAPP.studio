/**
 * Detect if the app is running inside the native wrapper (e.g. TestFlight/Capacitor)
 * so we can skip the marketing landing page and go straight to login/auth.
 * Browser visits to pulseapp.studio are unchanged.
 */
export function isNativeApp() {
  if (typeof window !== "undefined") {
    // 1. Capacitor native platform
    if (window.Capacitor?.isNativePlatform?.()) return true;
    if (window.Capacitor?.getPlatform?.() === "ios") return true;
    if (window.Capacitor?.getPlatform?.() === "android") return true;

    // 2. iOS standalone (added to home screen)
    if (window.navigator?.standalone === true) return true;

    // 3. Display mode standalone (PWA or Capacitor)
    if (window.matchMedia?.("(display-mode: standalone)")?.matches) return true;

    // 4. Capacitor protocol detection
    const protocol = window.location?.protocol || "";
    if (protocol === "capacitor:" || protocol === "ionic:") return true;

    // 5. User agent WebView markers
    const ua = navigator.userAgent || "";
    if (ua.includes("CapacitorApp") || ua.includes("GoNativeIOS") || ua.includes("median"))
      return true;
  }

  return false;
}
