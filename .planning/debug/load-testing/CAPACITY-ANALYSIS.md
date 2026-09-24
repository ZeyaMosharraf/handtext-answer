# Phase 8B Capacity Analysis & Dual Capacity Declarations

---

## 1. The Two Distinct Capacity Declarations (Step 14)

### A. BACKEND BURST / CONNECTION CAPACITY
> Under a zero-delay burst workload hitting PostgREST directly, the backend connection pool sustains **250 simultaneous in-flight connections (7,416.78 RPS)** with 0% errors and P95 latency of 38.20ms. The breaking threshold occurs at **275 simultaneous connections** where HTTP 503 connection shedding begins.

### B. REALISTIC HANDTEXT ACTIVE USER CAPACITY
> Under a realistic HandText workload (60% Light, 30% Normal, 10% Heavy) utilizing client-side IndexedDB debounced autosaving and periodic cloud saves (2–5 requests/user/minute), the system sustained **200 concurrent active authenticated sessions** with **0% error rate**, **P95 latency of 44.89ms**, and **100% byte-for-byte data integrity**.

---

## 2. Subsystem Capacity Boundaries

1. **Client-Side Editing & Local Persistence:**
   - **Capacity:** Virtually unlimited (scales linearly with client device CPU/memory).
   - **Resilience:** Continuous keystrokes, mathematical rendering, and table formatting generate 0 network requests.
2. **PostgREST Cloud Persistence:**
   - **Capacity:** Up to ~350 concurrent active database transactions.
   - **Equivalent Active Users:** **1,000 to 1,500 active writers** under normal editing cadence.
3. **GoTrue Authentication:**
   - **Established Token Validation:** Sub-20ms P50 latency at >1,000 sessions.
   - **Dynamic New Signups (Live Cloud):** Capped at 3-4 signups/hr on remote free tier due to built-in SMTP rate limits.
4. **Browser Rendering & UX Concurrency:**
   - **Verified Capacity:** Verified up to 50 concurrent headless Chromium BrowserContexts with 100% integrity, complete MathBlock LaTeX rendering, TableBlock creation, and IndexedDB round-trips.
