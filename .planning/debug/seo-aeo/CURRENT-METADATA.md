# Current Metadata & Head Tag Audit — HandText

**Audit Date:** September 2026  
**Base Root:** `src/routes/__root.tsx`  
**Current Production Host:** `https://handtext-answer.vercel.app/`  

---

## 1. Global Head Configuration (`__root.tsx`)

| Tag / Property | Current Value | Assessment |
| :--- | :--- | :--- |
| `charSet` | `utf-8` | Correct |
| `viewport` | `width=device-width, initial-scale=1` | Correct |
| `og:site_name` | `HandText` | Correct entity name |
| `og:type` | `website` | Correct |
| `twitter:card` | `summary_large_image` | Good, but missing `twitter:title`, `twitter:description`, `twitter:image` |
| `canonical` | **MISSING** globally and per-route | Needs canonical URL on all public pages |
| `og:url` | **MISSING** globally and per-route | Needs canonical URL per route |
| `og:image` | **MISSING** | Needs social share card asset |
| `robots.txt` | **MISSING** in `public/` | Needs standard crawlers configuration |
| `sitemap.xml` | **MISSING** in `public/` | Needs standard XML sitemap |
| `JSON-LD` | **MISSING** | Needs Schema.org structured data |

---

## 2. Route-by-Route Metadata

### 1. `/` (Landing Page)
- **Title:** `HandText — Turn typed answers into handwritten pages`
  - *Critique:* Needs shift from "typed answers" to canonical category: `HandText — AI Handwriting Generator | Text to Handwriting`
- **Meta Description:** `Paste your answer, pick a handwriting style, customise the page and export realistic handwritten answer sheets as PDF or PNG.`
  - *Critique:* Repetitive focus on "answer sheets" rather than broader realistic handwriting generator (assignments, notes, mathematical formulas, tables, multi-page A4 documents).
- **OG Title:** `HandText — Realistic handwritten answer sheets`
- **OG Description:** `Convert typed assignments and notes into realistic handwritten pages, ready to print or export.`
- **Canonical:** Missing.
- **H1:** `Turn your answers into realistic handwritten pages`
  - *Critique:* Should align with recommended canonical H1: `Turn Typed Text Into Realistic Handwriting`

### 2. `/pricing`
- **Title:** `Pricing — HandText`
- **Meta Description:** `Simple plans for students: a free tier, a Pro plan with unlimited styles and a discounted Student plan.`
- **OG Title:** `Pricing — HandText`
- **OG Description:** `Free, Pro and Student plans for handwritten answer sheets.`
- **Canonical:** Missing.

### 3. `/auth`
- **Title:** `Sign in — HandText`
- **Meta Description:** `Sign in or create a free HandText account to generate handwritten answer sheets.`
- **Robots:** `noindex` (Correct)

### 4. `/dashboard`, `/editor/$projectId`, `/settings`
- **Robots:** `noindex` (Correct)

---

## 3. SEO Gaps Summary
1. No canonical URL tags anywhere in head.
2. Missing Open Graph images (`og:image`, `twitter:image`).
3. No Schema.org structured data (Organization, WebSite, SoftwareApplication, FAQPage, BreadcrumbList).
4. No `robots.txt` file in `public/`.
5. No `sitemap.xml` file in `public/`.
6. No Google Analytics 4 integration script or measurement ID.
7. No Cookie / Analytics consent management mechanism.
8. No footer links to legal documentation (Privacy Policy, Terms of Service, Cookie Preferences).
