/**
 * PulseApp Analytics Utility
 * Centralized event tracking with consistent properties.
 * All events go through base44.analytics.track with standardized naming.
 *
 * No PII is ever sent — user_id is the opaque Base44 user ID.
 */

import { base44 } from "@/api/base44Client";

// ── Platform detection (cached after first call) ──
let _platform = null;
export function getPlatform() {
  if (_platform) return _platform;
  const ua = (navigator.userAgent || "").toLowerCase();
  const isMobileUA = /iphone|ipad|ipod|android/i.test(ua);
  const isNativeWrapper =
    ua.includes("median") || ua.includes("gonative") ||
    window.navigator?.standalone === true ||
    window.matchMedia?.("(display-mode: standalone)")?.matches ||
    (isMobileUA && window.location.hostname.endsWith(".base44.app"));
  _platform = isNativeWrapper || (isMobileUA && window.location.hostname.endsWith(".base44.app"))
    ? "mobile"
    : isMobileUA ? "mobile_web" : "web";
  return _platform;
}

// ── Cached user id (set once after login) ──
let _userId = null;
let _userIdPromise = null;

export async function resolveUserId() {
  if (_userId) return _userId;
  if (_userIdPromise) return _userIdPromise;
  _userIdPromise = (async () => {
    try {
      const user = await base44.auth.me();
      _userId = user?.id || null;
      return _userId;
    } catch {
      return null;
    }
  })();
  return _userIdPromise;
}

/** Set user id synchronously when you already have it from a query. */
export function setUserId(id) {
  _userId = id || null;
}

export function getUserId() {
  return _userId;
}

// ── Session id (unique per page load) ──
const _sessionId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
export function getSessionId() {
  return _sessionId;
}

// ── Core track function ──
export function track(eventName, properties = {}) {
  try {
    const enriched = {
      platform: getPlatform(),
      session_id: _sessionId,
      ...(properties || {}),
    };
    // Attach user_id if available (never email)
    if (_userId) enriched.user_id = _userId;
    base44.analytics.track({ eventName, properties: enriched });
  } catch (e) {
    // Analytics should never break the app
    console.warn("[Analytics] track failed:", e);
  }
}

/** Fire-and-forget beacon (for unload events). Falls back to sync track. */
export function trackBeacon(eventName, properties = {}) {
  try {
    const enriched = {
      platform: getPlatform(),
      session_id: _sessionId,
      ...(properties || {}),
    };
    if (_userId) enriched.user_id = _userId;
    // sendBeacon with base44 analytics isn't directly supported,
    // so we just call the normal track (it's fire-and-forget internally).
    base44.analytics.track({ eventName, properties: enriched });
  } catch {
    // swallow
  }
}