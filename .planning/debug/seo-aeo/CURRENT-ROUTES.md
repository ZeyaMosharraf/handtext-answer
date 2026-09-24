# Current Routes Audit — HandText

**Audit Date:** September 2026  
**Framework:** TanStack Start (`@tanstack/react-start`) + TanStack Router (`@tanstack/react-router`)  
**Production URL:** `https://handtext-answer.vercel.app/`  

---

## 1. Route Map

| Path | Type | SSR / Client | Auth Guard | Current Head Metadata | Purpose |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `/` | Public | SSR + Client | None | `HandText — Turn typed answers into handwritten pages` | Landing / Homepage |
| `/pricing` | Public | SSR + Client | None | `Pricing — HandText` | Pricing plans table |
| `/auth` | Public (Auth) | SSR + Client | None (Redirects if logged in) | `Sign in — HandText` (`noindex`) | Login, Signup, Password Reset |
| `/_authenticated` | Layout | Client only (`ssr: false`) | `beforeLoad` checks Supabase auth | None | Authenticated route wrapper |
| `/dashboard` | Private | Client only (`_authenticated`) | Supabase User Session | `My projects — HandText` (`noindex`) | User projects list & creation |
| `/editor/$projectId` | Private | Client only (`_authenticated`) | Supabase User Session | `Editor — HandText` (`noindex`) | Full document editing workspace |
| `/settings` | Private | Client only (`_authenticated`) | Supabase User Session | `Settings — HandText` (`noindex`) | Profile, handwriting defaults, account |

---

## 2. Route Classification

### A. Public Indexable Candidates
- `/` (Home)
- `/pricing`

### B. Public Non-Indexable (Utility / Auth)
- `/auth` (Login / Register / Password Recovery) — tagged with `noindex`

### C. Private Application Routes (Must remain protected and omitted from sitemap)
- `/_authenticated`
- `/dashboard`
- `/editor/$projectId`
- `/settings`

### D. Missing Planned Public Routes
To fulfill Phase 4, Phase 10, Phase 11, and Phase 18:
- `/handwriting-generator` (Core handwriting tool landing page)
- `/ai-handwriting-generator` (AI handwriting intent landing page)
- `/text-to-handwriting` (Text-to-handwriting intent landing page)
- `/handwritten-assignment-generator` (Assignment maker intent landing page)
- `/handwritten-notes-generator` (Notes maker intent landing page)
- `/handwritten-math-generator` (Math & equations handwriting intent landing page)
- `/faq` (Frequently Asked Questions)
- `/learn` (Knowledge Hub index)
- `/learn/how-to-convert-text-to-handwriting`
- `/learn/how-to-create-handwritten-assignments`
- `/learn/how-to-create-realistic-handwritten-notes`
- `/learn/how-to-format-handwritten-math-equations`
- `/privacy` (Privacy Policy)
- `/terms` (Terms of Service)
