# Domain Strategy & Migration Readiness — HandText

**Current Production URL:** `https://handtext-answer.vercel.app/`  
**Brand Entity:** HandText  
**Product Category:** AI Handwriting Generator  

---

## 1. Current State & Rationale
HandText is currently deployed on Vercel at `https://handtext-answer.vercel.app/`.
This domain serves as a stable, verified staging and initial production host.
**Rule:** The application must remain fully functional and indexed at `https://handtext-answer.vercel.app/` during Phase 10 without breaking existing OAuth callbacks, Supabase credentials, or internal routing.

---

## 2. Characteristics of Desired Future Custom Domain
When transitioning to a permanent custom brand domain, the domain should satisfy:
1. **Short & Memorable:** Easy to type, share, and speak without spelling ambiguity.
2. **Brand-Aligned:** Directly reflects `HandText` without confusing hyphens or irrelevant modifiers.
3. **No Product Contraction:** Avoid narrowing the brand to a single use case (e.g. avoiding `-answer`, `-homework`, `-exam`).
4. **Clean TLD:** Prioritize `.com`, `.app`, `.ai`, or `.io` if available and legally vetted.
5. **Collision Clearance:** Vetted against existing registered trademarks or conflicting software products in the handwriting / OCR space.

### Candidate Explorations (For Future Evaluation Only — Not Purchased):
- `handtext.app` (Product utility)
- `handtext.ai` (AI generator alignment)
- `handtext.io` (Web app standard)
- `gethandtext.com` / `usehandtext.com` (Action-oriented fallback)

---

## 3. Architecture for Zero-Downtime Future Migration

To ensure migration to a custom domain is seamless when initiated in a future phase:
1. **Centralized Base URL Helper:** All canonical links, Open Graph URLs, sitemaps, and Schema.org IDs must reference a single source of truth (`src/lib/siteConfig.ts`).
2. **Dynamic Origin Resolution:** In server/client runtime, canonical base is configurable via environment variable:
   `VITE_SITE_URL` defaulting to `https://handtext-answer.vercel.app`.
3. **Checklist for Future Domain Migration:**
   - [ ] Purchase and verify ownership of new domain.
   - [ ] Configure DNS in Vercel (CNAME / A records).
   - [ ] Update `VITE_SITE_URL` in Vercel project environment variables.
   - [ ] Add 301 Permanent Redirect rule from `handtext-answer.vercel.app` to new domain.
   - [ ] Update Supabase Authentication -> URL Configuration:
     - Site URL -> `https://<new-domain>/`
     - Redirect URLs -> `https://<new-domain>/**`
   - [ ] Update Google OAuth / third-party provider Authorized Origins and Redirect URIs.
   - [ ] Submit Address Change in Google Search Console.
   - [ ] Submit Address Change in Bing Webmaster Tools.
   - [ ] Update Google Analytics 4 Data Stream web URL.
   - [ ] Ping sitemap submission endpoints with new URL.
