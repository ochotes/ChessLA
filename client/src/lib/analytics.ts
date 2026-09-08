// A tiny, provider-agnostic analytics gate. Nothing loads until the visitor
// has actively accepted cookies (see CookieConsent.tsx) AND a real provider
// ID has been configured via VITE_ANALYTICS_ID. With no ID set — the
// out-of-the-box state — this module never fetches anything, so the app is
// fully usable and honest about tracking with zero setup.

const CONSENT_KEY = "chessla_cookie_consent"; // "accepted" | "declined"

export type ConsentState = "accepted" | "declined" | null;

export function getConsent(): ConsentState {
  try {
    const v = localStorage.getItem(CONSENT_KEY);
    return v === "accepted" || v === "declined" ? v : null;
  } catch {
    return null;
  }
}

export function setConsent(value: "accepted" | "declined") {
  try {
    localStorage.setItem(CONSENT_KEY, value);
  } catch {
    /* private browsing / storage blocked — the banner will just reappear next visit, which is an acceptable fallback */
  }
  if (value === "accepted") loadAnalyticsIfConfigured();
}

let loaded = false;

export function loadAnalyticsIfConfigured() {
  if (loaded) return;
  const provider = import.meta.env.VITE_ANALYTICS_PROVIDER;
  const id = import.meta.env.VITE_ANALYTICS_ID;
  if (!provider || !id || getConsent() !== "accepted") return;

  loaded = true;
  if (provider === "plausible") {
    const script = document.createElement("script");
    script.defer = true;
    script.dataset.domain = id;
    script.src = "https://plausible.io/js/script.js";
    document.head.appendChild(script);
  } else if (provider === "ga4") {
    const script = document.createElement("script");
    script.async = true;
    script.src = `https://www.googletagmanager.com/gtag/js?id=${id}`;
    document.head.appendChild(script);
    const inline = document.createElement("script");
    inline.textContent = `window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','${id}',{anonymize_ip:true});`;
    document.head.appendChild(inline);
  }
}

/** Call once at app startup — a no-op unless consent was already granted on a previous visit. */
export function initAnalytics() {
  if (getConsent() === "accepted") loadAnalyticsIfConfigured();
}
