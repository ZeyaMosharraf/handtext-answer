# HandText — SEO Technical & Content Implementation

## 1. Executive Summary
This document records the complete SEO implementation for HandText (`https://handtext-answer.vercel.app/`), establishing the product's discoverability under the canonical brand identity **HandText** and primary category **AI Handwriting Generator**.

The implementation strictly avoids keyword stuffing, artificial backlinks, or exaggerated ranking guarantees. Every page provides genuine utility, unique copy, and accurate product representation.

---

## 2. Brand & Entity Definition
- **Brand Entity**: HandText
- **Product Category**: AI Handwriting Generator
- **Core Value Proposition**: Turn typed text into realistic handwritten pages.
- **Production URL**: `https://handtext-answer.vercel.app/`
- **Dynamic Site URL Config**: `src/lib/siteConfig.ts` controls all canonical generation, allowing single-variable domain switching when ready.

---

## 3. Public Crawl & Discovery Assets

### 3.1 `robots.txt` (`public/robots.txt`)
- Explicitly allows major legitimate search engines (`Googlebot`, `Bingbot`) and AI search systems (`OAI-SearchBot`, `GPTBot`, `PerplexityBot`).
- Strictly disallows private, authenticated, or temporary application routes:
  - `/dashboard/`
  - `/editor/`
  - `/settings/`
  - `/auth/`
  - `/_authenticated/`
  - `/api/`
- Points directly to canonical sitemap: `Sitemap: https://handtext-answer.vercel.app/sitemap.xml`.

### 3.2 `sitemap.xml` (`public/sitemap.xml`)
Contains exactly 15 public, indexable, canonical URLs (pricing-page navigation and indexing disabled during the free validation launch):
1. `https://handtext-answer.vercel.app/` (Home, priority 1.0)
2. `https://handtext-answer.vercel.app/handwriting-generator` (Core Tool, priority 0.9)
3. `https://handtext-answer.vercel.app/ai-handwriting-generator` (AI Tool, priority 0.9)
4. `https://handtext-answer.vercel.app/text-to-handwriting` (Converter, priority 0.9)
5. `https://handtext-answer.vercel.app/handwritten-assignment-generator` (Academic use-case, priority 0.8)
6. `https://handtext-answer.vercel.app/handwritten-notes-generator` (Study notes use-case, priority 0.8)
7. `https://handtext-answer.vercel.app/handwritten-math-generator` (Math & LaTeX use-case, priority 0.8)
8. `https://handtext-answer.vercel.app/learn` (Knowledge Hub Index, priority 0.7)
9. `https://handtext-answer.vercel.app/learn/how-to-convert-text-to-handwriting` (Guide, priority 0.7)
10. `https://handtext-answer.vercel.app/learn/how-to-create-handwritten-assignments` (Guide, priority 0.7)
11. `https://handtext-answer.vercel.app/learn/how-to-create-realistic-handwritten-notes` (Guide, priority 0.7)
12. `https://handtext-answer.vercel.app/learn/how-to-format-handwritten-math-equations` (Guide, priority 0.7)
13. `https://handtext-answer.vercel.app/faq` (FAQ, priority 0.6)
14. `https://handtext-answer.vercel.app/privacy` (Privacy Policy, priority 0.5)
15. `https://handtext-answer.vercel.app/terms` (Terms of Service, priority 0.5)

Zero private or authenticated URLs are in the sitemap.

---

## 4. Metadata Architecture (`src/lib/siteConfig.ts`)
Each public route uses `buildRouteMeta()` which automatically constructs:
- `<title>`: Unique, descriptive title reflecting primary keyword without stuffing.
- `<meta name="description">`: Concise 140–160 character factual summary.
- `<link rel="canonical">`: Explicit canonical tag pointing to the production URL.
- Open Graph (`og:title`, `og:description`, `og:url`, `og:type`, `og:image`, `og:site_name`).
- Twitter/X Card (`twitter:card`, `twitter:title`, `twitter:description`, `twitter:image`).
- JSON-LD Structured Data: Injected into the document head for semantic indexing.

---

## 5. Structured Data (Schema.org)
All structured data reflects visible content on the page:
1. **Organization (`src/lib/siteConfig.ts`)**:
   - `@type`: `Organization`
   - `name`: HandText
   - `url`: `https://handtext-answer.vercel.app`
   - `logo`: `https://handtext-answer.vercel.app/og-image.png`
2. **SoftwareApplication (`src/lib/siteConfig.ts`)**:
   - `@type`: `SoftwareApplication`
   - `name`: HandText AI Handwriting Generator
   - `applicationCategory`: `DesignApplication`
   - `operatingSystem`: `Web Browser`
   - `offers`: Free tier with Pro upgrade.
3. **FAQPage (`src/routes/faq.tsx`)**:
   - Encodes 10 actual product questions and answers.
4. **Article (`src/routes/learn/*`)**:
   - Encodes educational guide metadata (`headline`, `description`, `author`, `publisher`).

---

## 6. Social Share Card Asset
- Asset: `public/og-image.png` (1200x630px).
- Generates rich card previews on Twitter/X, Discord, Slack, LinkedIn, and Facebook with correct HandText branding and tagline.
