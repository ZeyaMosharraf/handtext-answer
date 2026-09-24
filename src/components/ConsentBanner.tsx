/**
 * src/components/ConsentBanner.tsx
 *
 * User consent management UI for privacy & analytics.
 * Supports:
 * - Persistent consent preference
 * - Non-intrusive first-visit banner
 * - Modal preference manager triggered from the footer
 */

import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { ShieldCheck, Cookie, X } from "lucide-react";
import {
  getAnalyticsConsent,
  setAnalyticsConsent,
  type ConsentStatus,
} from "@/lib/analytics";
import { Button } from "@/components/ui/primitives";

export function ConsentBanner() {
  const [consent, setConsent] = useState<ConsentStatus>("unset");
  const [mounted, setMounted] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);

  useEffect(() => {
    setMounted(true);
    setConsent(getAnalyticsConsent());

    const handleConsentChange = (e: any) => {
      setConsent(e.detail);
    };

    const handleOpenModal = () => {
      setModalOpen(true);
    };

    window.addEventListener("handtext-consent-changed", handleConsentChange);
    window.addEventListener("open-cookie-preferences", handleOpenModal);

    return () => {
      window.removeEventListener("handtext-consent-changed", handleConsentChange);
      window.removeEventListener("open-cookie-preferences", handleOpenModal);
    };
  }, []);

  if (!mounted) return null;

  const handleAccept = () => {
    setAnalyticsConsent("granted");
    setModalOpen(false);
  };

  const handleDecline = () => {
    setAnalyticsConsent("denied");
    setModalOpen(false);
  };

  return (
    <>
      {/* First-visit Bottom Banner (Shown only when consent is unset) */}
      {consent === "unset" && (
        <div
          role="region"
          aria-label="Cookie and Privacy Consent"
          className="fixed bottom-0 left-0 right-0 z-50 border-t border-border bg-background/95 p-4 shadow-2xl backdrop-blur-md sm:p-5"
        >
          <div className="mx-auto flex max-w-6xl flex-col items-start justify-between gap-4 md:flex-row md:items-center">
            <div className="flex items-start gap-3">
              <div className="mt-0.5 rounded-md bg-primary/10 p-2 text-primary">
                <Cookie className="size-5" />
              </div>
              <div className="text-sm leading-relaxed text-muted-foreground">
                <p className="font-semibold text-foreground">Privacy & Analytics Preferences</p>
                <p className="mt-0.5">
                  We use privacy-focused analytics to improve HandText. Your document contents,
                  handwritten text, notes, and mathematical formulas are strictly private and are
                  never shared or sent to analytics.{" "}
                  <Link to="/privacy" className="text-primary underline hover:text-primary/90">
                    Read our Privacy Policy
                  </Link>
                  .
                </p>
              </div>
            </div>
            <div className="flex w-full shrink-0 flex-wrap items-center gap-2 sm:w-auto">
              <Button variant="outline" size="sm" onClick={handleDecline} className="flex-1 sm:flex-initial">
                Decline
              </Button>
              <Button size="sm" onClick={handleAccept} className="flex-1 sm:flex-initial">
                Accept Analytics
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Preferences Modal (Triggered via Footer or Action) */}
      {modalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="cookie-modal-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs"
        >
          <div className="relative w-full max-w-md rounded-xl border border-border bg-card p-6 shadow-2xl">
            <button
              onClick={() => setModalOpen(false)}
              aria-label="Close preferences modal"
              className="absolute right-4 top-4 rounded-md p-1 text-muted-foreground hover:bg-surface hover:text-foreground"
            >
              <X className="size-5" />
            </button>

            <div className="flex items-center gap-2.5 text-foreground">
              <ShieldCheck className="size-6 text-primary" />
              <h2 id="cookie-modal-title" className="text-lg font-bold">
                Cookie & Privacy Preferences
              </h2>
            </div>

            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
              Configure how HandText collects analytics. Essential cookies necessary for core
              application authentication, session management, and local document persistence are
              always active.
            </p>

            <div className="mt-4 space-y-3">
              <div className="rounded-lg border border-border bg-surface p-3.5">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-foreground">Essential Functionality</span>
                  <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">Always Active</span>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  Authentication, security tokens, and local IndexedDB autosave. Cannot be disabled.
                </p>
              </div>

              <div className="rounded-lg border border-border bg-surface p-3.5">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-foreground">Usage Analytics</span>
                  <span className="text-xs font-medium text-muted-foreground">
                    Current: {consent === "granted" ? "Accepted" : consent === "denied" ? "Declined" : "Unset"}
                  </span>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  Anonymous metrics to measure feature performance. Never collects user document text or math formulas.
                </p>
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-2.5">
              <Button variant="outline" size="sm" onClick={handleDecline}>
                Decline Optional
              </Button>
              <Button size="sm" onClick={handleAccept}>
                Accept Analytics
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

/**
 * Utility to open the cookie preferences modal from any link (e.g. Footer).
 */
export function openCookiePreferences() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("open-cookie-preferences"));
  }
}
