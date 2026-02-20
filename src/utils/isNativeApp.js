/**
 * Detect if the app is running inside the native wrapper (e.g. TestFlight/Capacitor)
 * so we can skip the marketing landing page and go straight to login/auth.
 * Browser visits to pulseapp.studio are unchanged.
 */
export function isNativeApp() {
  if (typeof window === "undefined") return false;

  // Check for Capacitor native platform
  if (window.Capacitor?.isNativePlatform?.()) {
    return true;
  }

  // Check for standalone display mode (PWA installed to home screen or Capacitor)
  if (window.matchMedia?.("(display-mode: standalone)").matches) {
    return true;
  }

  // Check for iOS standalone mode
  if (window.navigator?.standalone === true) {
    return true;
  }

  // URL-based: Capacitor/Base44 native app may load from capacitor:// or file:// or ionic://
  const protocol = window.location?.protocol || "";
  if (protocol === "capacitor:" || protocol === "ionic:" || protocol === "file:") {
    return true;
  }

  return false;
}
