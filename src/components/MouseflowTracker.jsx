import { useEffect } from "react";

/**
 * Loads the Mouseflow tracking script once and identifies the current user.
 * Drop this component anywhere in the authenticated app tree.
 */
export default function MouseflowTracker({ user }) {
  // 1. Load Mouseflow script (once)
  useEffect(() => {
    if (window._mfq) return; // already loaded
    window._mfq = window._mfq || [];

    const mf = document.createElement("script");
    mf.type = "text/javascript";
    mf.defer = true;
    mf.src = "//cdn.mouseflow.com/projects/d96f8159-e47c-43ad-928c-0a70c28b3584.js";
    document.getElementsByTagName("head")[0].appendChild(mf);
  }, []);

  // 2. Identify user for per-user tracking
  useEffect(() => {
    if (!user?.email) return;
    window._mfq = window._mfq || [];
    window._mfq.push(["setVariable", "userId", user.id || ""]);
    window._mfq.push(["setVariable", "email", user.email]);
    if (user.full_name) {
      window._mfq.push(["setVariable", "name", user.full_name]);
    }
  }, [user?.email, user?.id, user?.full_name]);

  return null;
}