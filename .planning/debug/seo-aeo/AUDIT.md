# Comprehensive Current-Site SEO & AEO Audit — HandText

**Audit Date:** September 2026  
**Audited Target:** `https://handtext-answer.vercel.app/`  
**Brand Identity:** HandText  
**Primary Product Category Target:** AI Handwriting Generator  

---

## 1. Executive Summary

HandText possesses a solid technical foundation built on TanStack Start (SSR + hydration) and TanStack Router, with an ultra-responsive client editor supporting realistic handwriting, mathematical LaTeX layout, tables, and multi-page A4 exports.

However, from an SEO, AEO (Answer Engine Optimization), analytics, and compliance perspective, the public site currently has critical gaps:
1. **Narrow Positioning:** The current copy heavily frames HandText as an "answer generator" rather than the broader, higher-demand "AI Handwriting Generator / Text to Handwriting" category.
2. **Missing Technical Crawl Assets:** No `robots.txt` or `sitemap.xml` exist in `public/`.
3. **Missing Canonical & Social Graph Tags:** No `<link rel="canonical">` or social share cards (`og:image`) are specified.
4. **Missing Structured Data:** No Schema.org JSON-LD exists (Organization, WebSite, SoftwareApplication, FAQPage).
5. **No Analytics or Consent Layer:** Google Analytics 4 is not installed, and no cookie/analytics consent banner exists.
6. **Missing Legal Documentation:** No `/privacy` or `/terms` pages exist, and the footer lacks legal links.
7. **Single Public Landing Page:** All search intents (handwriting generator, notes, assignments, math equations) are collapsed onto a single homepage, missing high-intent organic search queries.

---

## 2. Infrastructure & Environment Audit

- **Framework:** TanStack Start (`@tanstack/react-start`) with Vite 8 and Nitro Cloudflare/Vercel compatible adapter.
- **Hosting:** Vercel deployment at `https://handtext-answer.vercel.app/`.
- **Database / Auth:** Remote Supabase (`https://aojpzcmwretmknftvzde.supabase.co`).
- **Client Persistence:** IndexedDB (`handtext-local`) with debounced auto-saving.
- **Performance:** Sub-second page loads; server rendering produces clean semantic HTML before client hydration.
- **Mobile Responsiveness:** Viewport configured properly; responsive flex and grid layouts.

---

## 3. SEO & Crawlability Evaluation

| Item | Current State | Target State (Phase 10) |
| :--- | :--- | :--- |
| **Robots.txt** | Missing | `public/robots.txt` allowing Googlebot, Bingbot, OAI-SearchBot; disallowing `/dashboard/`, `/editor/`, `/settings/`, `/auth/` |
| **Sitemap.xml** | Missing | `public/sitemap.xml` listing all canonical public indexable pages with `<lastmod>` |
| **Canonical URLs** | Missing | Self-referential `<link rel="canonical">` on every public page |
| **Meta Titles** | "Turn typed answers into..." | Intent-targeted titles prefixed with `HandText — ...` |
| **Meta Descriptions** | Limited to answers | Benefit-driven descriptions covering notes, math, assignments |
| **Open Graph** | Incomplete (no `og:image`, `og:url`) | Full Open Graph + Twitter Large Card metadata with branded preview asset |
| **Structured Data** | None | JSON-LD: `Organization`, `WebSite`, `SoftwareApplication`, `FAQPage`, `BreadcrumbList` |
| **Internal Linking** | Basic anchor jumps | Logical hierarchy connecting tools, use cases, FAQ, and Knowledge Hub |

---

## 4. Privacy & Analytics Audit

- **Google Analytics 4:** Not currently integrated.
- **Consent Mechanism:** None.
- **Data Leakage Risk:** In an AI handwriting app, user document contents, formulas, and assignments MUST NEVER be sent to analytics.
- **Implementation Strategy:**
  - GA4 will be driven by `VITE_GA_MEASUREMENT_ID`.
  - Google Consent Mode v2 (`analytics_storage: 'denied'`).
  - GA scripts only load or activate upon explicit user consent.
  - Event taxonomy will track only structural actions (e.g. `page_view`, `project_saved`, `export_pdf`, `math_block_added`), completely omitting document contents or user-entered text.

---

## 5. Public vs. Private Routing Boundary

- **Public SEO Pages:** `/`, `/pricing`, `/handwriting-generator`, `/ai-handwriting-generator`, `/text-to-handwriting`, `/handwritten-assignment-generator`, `/handwritten-notes-generator`, `/handwritten-math-generator`, `/faq`, `/learn/*`, `/privacy`, `/terms`.
- **Protected Application Routes:** `/dashboard`, `/editor/$projectId`, `/settings`, `/_authenticated/*` — protected by Supabase session guard, marked with `noindex`, and excluded from `sitemap.xml`.
- **Auth Entry:** `/auth` — accessible to public, marked with `noindex`, excluded from sitemap.
