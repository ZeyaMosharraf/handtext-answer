/**
 * src/lib/siteConfig.ts
 *
 * Central configuration for HandText SEO, AEO, canonical URLs, and entity identity.
 * Prepares the application for clean future domain migration without hardcoded URLs.
 */

export const SITE_URL =
  (typeof process !== "undefined" && process.env?.["VITE_SITE_URL"]) ||
  import.meta.env["VITE_SITE_URL"] ||
  "https://handtext-answer.vercel.app";

export const SITE_CONFIG = {
  name: "HandText",
  legalName: "HandText",
  category: "AI Handwriting Generator",
  tagline: "Turn Typed Text Into Realistic Handwriting",
  description:
    "HandText is an online AI handwriting generator that converts typed text into realistic handwritten pages, notes, assignments, math equations, and A4 documents.",
  siteUrl: SITE_URL,
  ogImage: `${SITE_URL}/og-image.png`,
  creatorTwitter: "@handtextapp",
  keywords: [
    "AI handwriting generator",
    "handwriting generator",
    "text to handwriting",
    "handwritten assignment generator",
    "handwritten notes generator",
    "handwritten math generator",
    "A4 handwriting generator",
  ],
};

/**
 * Returns a fully-qualified canonical URL for any given path.
 */
export function getCanonicalUrl(path: string = "/"): string {
  const cleanPath = path.startsWith("/") ? path : `/${path}`;
  return `${SITE_URL}${cleanPath === "/" ? "" : cleanPath}`;
}

export interface PageSeoProps {
  title: string;
  description: string;
  path: string;
  ogType?: "website" | "article";
  structuredData?: Record<string, any> | Array<Record<string, any>>;
  noindex?: boolean;
}

/**
 * Helper to construct TanStack Router route head meta definitions.
 */
export function buildRouteMeta({
  title,
  description,
  path,
  ogType = "website",
  structuredData,
  noindex = false,
}: PageSeoProps) {
  const canonicalUrl = getCanonicalUrl(path);

  const meta: Array<Record<string, string>> = [
    { title },
    { name: "description", content: description },
    { property: "og:site_name", content: SITE_CONFIG.name },
    { property: "og:title", content: title },
    { property: "og:description", content: description },
    { property: "og:url", content: canonicalUrl },
    { property: "og:type", content: ogType },
    { property: "og:image", content: SITE_CONFIG.ogImage },
    { name: "twitter:card", content: "summary_large_image" },
    { name: "twitter:title", content: title },
    { name: "twitter:description", content: description },
    { name: "twitter:image", content: SITE_CONFIG.ogImage },
  ];

  if (noindex) {
    meta.push({ name: "robots", content: "noindex, nofollow" });
  } else {
    meta.push({ name: "robots", content: "index, follow" });
  }

  const links = [{ rel: "canonical", href: canonicalUrl }];

  const scripts = structuredData
    ? [
        {
          type: "application/ld+json",
          children: JSON.stringify(structuredData),
        },
      ]
    : [];

  return { meta, links, scripts };
}
