import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { getConsent, setConsent } from "../lib/analytics";

export function CookieConsent() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    setVisible(getConsent() === null);
  }, []);

  if (!visible) return null;

  function respond(value: "accepted" | "declined") {
    setConsent(value);
    setVisible(false);
  }

  return (
    <div
      role="dialog"
      aria-label="Cookie consent"
      aria-describedby="cookie-consent-description"
      // Bottom offset matches MobileNav's own "md:hidden" breakpoint exactly,
      // so below md this banner sits above the bottom nav bar instead of
      // hiding it, and at md+ (where MobileNav is gone) it docks to the
      // corner instead.
      className="fixed inset-x-0 bottom-16 z-50 border-t border-border bg-surface p-4 shadow-raised md:bottom-4 md:left-4 md:right-auto md:max-w-md md:rounded-xl md:border"
      style={{ marginBottom: "env(safe-area-inset-bottom)" }}
    >
      <p id="cookie-consent-description" className="text-sm text-text">
        ChessLA uses essential cookies to keep you signed in and to run games securely. With your
        consent we also use privacy-respecting analytics to understand how the site is used. See our{" "}
        <Link to="/privacy" className="underline hover:text-accent">
          Privacy Policy
        </Link>
        .
      </p>
      <div className="mt-3 flex gap-2">
        <button className="btn-primary flex-1" onClick={() => respond("accepted")}>
          Accept
        </button>
        <button className="btn-secondary flex-1" onClick={() => respond("declined")}>
          Decline
        </button>
      </div>
    </div>
  );
}
