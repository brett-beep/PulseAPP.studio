/**
 * App theme: light | dark. Stored in localStorage, default light.
 * Use getTheme() / setTheme() from React; main.jsx applies on load and listens for changes.
 */

const STORAGE_KEY = "pulse_app_theme";
const THEME_EVENT = "pulse-theme-change";

export function getTheme() {
  if (typeof window === "undefined") return "light";
  const stored = window.localStorage.getItem(STORAGE_KEY);
  if (stored === "dark" || stored === "light") return stored;
  return "light";
}

export function applyTheme(theme) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  const isDark = theme === "dark";
  root.classList.toggle("dark", isDark);
  root.style.colorScheme = isDark ? "dark" : "light";
}

export function setTheme(theme) {
  if (theme !== "light" && theme !== "dark") return;
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, theme);
  applyTheme(theme);
  window.dispatchEvent(new CustomEvent(THEME_EVENT, { detail: theme }));
}

export function getThemeEventName() {
  return THEME_EVENT;
}
