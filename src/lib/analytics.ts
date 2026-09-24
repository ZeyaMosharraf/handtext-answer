/**
 * src/lib/analytics.ts
 *
 * Privacy-preserving Google Analytics 4 integration with Google Consent Mode v2.
 *
 * GUARANTEES:
 * 1. GA scripts will NOT load and no analytics cookies will be set without explicit user consent.
 * 2. User document contents, handwritten texts, math formulas, tables, and PII are strictly excluded.
 * 3. Supports instant consent revocation and preference modification.
 */

declare global {
  interface Window {
    dataLayer: any[];
    gtag?: (...args: any[]) => void;
  }
}

export type ConsentStatus = "granted" | "denied" | "unset";

const CONSENT_STORAGE_KEY = "handtext-analytics-consent";

export const GA_MEASUREMENT_ID =
  (typeof process !== "undefined" && process.env?.["VITE_GA_MEASUREMENT_ID"]) ||
  import.meta.env["VITE_GA_MEASUREMENT_ID"] ||
  "";

/**
 * Get the current user analytics consent status.
 */
export function getAnalyticsConsent(): ConsentStatus {
  if (typeof window === "undefined") return "unset";
  const stored = localStorage.getItem(CONSENT_STORAGE_KEY);
  if (stored === "granted" || stored === "denied") {
    return stored;
  }
  return "unset";
}

/**
 * Set and persist user analytics consent status.
 */
export function setAnalyticsConsent(status: "granted" | "denied") {
  if (typeof window === "undefined") return;
  localStorage.setItem(CONSENT_STORAGE_KEY, status);

  if (status === "granted") {
    initGoogleAnalytics();
    if (window.gtag) {
      window.gtag("consent", "update", {
        analytics_storage: "granted",
      });
    }
  } else {
    if (window.gtag) {
      window.gtag("consent", "update", {
        analytics_storage: "denied",
      });
    }
  }

  // Dispatch custom window event so UI components can update reactively
  window.dispatchEvent(new CustomEvent("handtext-consent-changed", { detail: status }));
}

/**
 * Dynamically loads Google Analytics tag only when user has granted consent.
 */
export function initGoogleAnalytics() {
  if (typeof window === "undefined") return;
  if (!GA_MEASUREMENT_ID) return;
  if (getAnalyticsConsent() !== "granted") return;

  // Initialize dataLayer and gtag function if not already present
  window.dataLayer = window.dataLayer || [];
  if (!window.gtag) {
    window.gtag = function () {
      window.dataLayer.push(arguments);
    };
    window.gtag("js", new Date());
    window.gtag("consent", "default", {
      analytics_storage: "granted",
    });
    window.gtag("config", GA_MEASUREMENT_ID, {
      send_page_view: false, // We control page_view manually for SPA route navigation
      anonymize_ip: true,
    });
  }

  // Inject Google Tag script if not already added to DOM
  const existingScript = document.getElementById("ga-gtag-script");
  if (!existingScript) {
    const script = document.createElement("script");
    script.id = "ga-gtag-script";
    script.async = true;
    script.src = `https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`;
    document.head.appendChild(script);
  }
}

/**
 * Safe list of allowed parameters to guarantee zero document content leakage.
 */
const ALLOWED_PARAM_KEYS = new Set([
  "page_path",
  "page_title",
  "method",
  "style_id",
  "paper_id",
  "project_id",
  "export_format",
  "page_count",
  "page_count_bucket",
  "ink_color",
  "mode",
  "rows",
  "cols",
  "tool",
  "status",
]);

/**
 * Track a page view across client-side router transitions.
 */
export function trackPageView(pagePath: string, pageTitle?: string) {
  if (typeof window === "undefined" || getAnalyticsConsent() !== "granted") return;
  if (!window.gtag || !GA_MEASUREMENT_ID) return;

  window.gtag("event", "page_view", {
    page_path: pagePath,
    page_title: pageTitle || document.title,
  });
}

/**
 * Track high-level product actions while sanitizing parameters to prevent PII / content leakage.
 */
export function trackProductEvent(eventName: string, params: Record<string, any> = {}) {
  if (typeof window === "undefined" || getAnalyticsConsent() !== "granted") return;
  if (!window.gtag || !GA_MEASUREMENT_ID) return;

  // Filter out any unauthorized keys
  const safeParams: Record<string, any> = {};
  for (const [key, value] of Object.entries(params)) {
    if (ALLOWED_PARAM_KEYS.has(key)) {
      if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
        safeParams[key] = value;
      }
    }
  }

  window.gtag("event", eventName, safeParams);
}
