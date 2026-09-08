import type { ReactNode } from "react";
import { Navbar } from "./Navbar";
import { MobileNav } from "./MobileNav";
import { Toasts } from "../ui/Toasts";
import { CookieConsent } from "../CookieConsent";
import { useRealtimeNotifications } from "../../hooks/useRealtimeNotifications";

export function Layout({ children, fullBleed = false }: { children: ReactNode; fullBleed?: boolean }) {
  useRealtimeNotifications();

  return (
    <div className="flex min-h-screen flex-col bg-bg text-text">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-accent focus:px-4 focus:py-2 focus:text-accent-contrast"
      >
        Skip to content
      </a>
      <Navbar />
      <main id="main-content" className={`flex-1 pb-20 md:pb-0 ${fullBleed ? "" : "mx-auto w-full max-w-7xl px-4 py-6 sm:px-6"}`}>
        {children}
      </main>
      <MobileNav />
      <Toasts />
      <CookieConsent />
    </div>
  );
}
