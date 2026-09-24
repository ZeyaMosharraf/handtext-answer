# AI Crawler & Search Engine Policy — HandText

**Objective:** Define precise crawl, indexation, and AEO (Answer Engine Optimization) policies for search engines and generative AI retrieval systems.

---

## 1. Guiding Principles
1. **Public Informational Discovery:** Legitimate search engines (Googlebot, Bingbot) and AI search crawlers (e.g. OpenAI's `OAI-SearchBot`) must be permitted to crawl and index public pages, tools, FAQs, and educational articles.
2. **Strict Privacy Protection:** Private user application data, documents, equations, and dashboard routes (`/dashboard/`, `/editor/`, `/settings/`, `/auth/`, `/_authenticated/`) must be explicitly blocked from crawling in `robots.txt` and fortified via authentication session guards and database RLS.
3. **No Fabricated Guarantees:** Permitting crawler access grants **eligibility** for indexing and generative citation; it does **not** guarantee top placement or AI recommendations.

---

## 2. Crawler Specifications & Directive Mapping

### A. General Search Engine Crawlers
- **Googlebot (`Googlebot`):** Allowed on all public routes. Essential for Google Search, SGE (Search Generative Experience), and Google Gemini grounding.
- **Bingbot (`Bingbot`):** Allowed on all public routes. Essential for Bing Search and Microsoft Copilot grounding queries.

### B. AI & LLM Search Crawlers
- **OAI-SearchBot (`OAI-SearchBot`):**
  - *Purpose:* Used by OpenAI to surface search results in ChatGPT Search.
  - *Policy:* **ALLOW.** Permitted on public pages to enable HandText to be cited as an authoritative source when users query ChatGPT for AI handwriting generators, handwritten assignment makers, or text-to-handwriting tools.
  - *Boundary:* Blocked from `/dashboard/`, `/editor/`, `/settings/`, and `/auth/`.
- **GPTBot (`GPTBot`):**
  - *Purpose:* Large-scale model training crawl.
  - *Policy:* Allowed on public marketing pages with same restrictions as standard bots.
- **ClaudeBot / PerplexityBot:**
  - *Policy:* Allowed on public marketing and educational pages to ensure multi-model grounding accuracy.

---

## 3. Disallowed Directives & Security Boundary

The following paths are universally disallowed for all User-agents:
```robots.txt
Disallow: /dashboard/
Disallow: /editor/
Disallow: /settings/
Disallow: /auth/
Disallow: /_authenticated/
Disallow: /api/
```

**Security Reminder:** `robots.txt` is an advisory directive for well-behaved crawlers, not an access control mechanism. HandText's security boundary is strictly enforced at the application layer via Supabase session validation, TanStack Router `beforeLoad` redirects, and PostgreSQL Row-Level Security (RLS).
