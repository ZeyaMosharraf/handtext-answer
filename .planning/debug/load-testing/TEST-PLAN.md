# Phase 8 Concurrency, Capacity & Breaking-Point Test Plan

**Document Status:** Draft for Discussion / Alignment  
**Target:** HandText Production Architecture  
**Goal:** Determine the practical capacity ceiling and identify the exact breaking point of HandText under progressively increasing concurrent load.

---

## 1. Tooling Selection Rationale

After auditing the architecture, we distinguish two essential test layers:

### Layer A: High-Throughput Protocol & Database Concurrency Engine
- **Tooling Choice:** Dedicated TypeScript/Node.js load harness (`npx tsx`) leveraging Node 24 native fetch with HTTP keep-alive, connection pooling, and sub-millisecond `performance.now()` instrumentation.
- **Why not k6 or Artillery alone?**
  - PostgREST requests require custom header injection (`apikey`, `Bearer <token>`) and specific Supabase response parsing.
  - Allows direct assertion of data integrity, byte-for-byte document equality, and automatic isolation of test accounts without third-party binary dependencies.
  - Directly shares application types (`Project`, `DocumentBlock`, `DEFAULT_SETTINGS`) from `src/types/document.ts` and `src/lib/projects.ts`.

### Layer B: Multi-Context Browser Concurrency & Isolation Engine
- **Tooling Choice:** Playwright (`npx playwright`) with multi-context browser automation.
- **Why?**
  - Simulates genuine end-to-end browser tabs with separate localStorage, cookies, and IndexedDB stores.
  - Verifies RLS enforcement in the actual UI: User A cannot see User B's project in the dashboard or editor.
  - Verifies multi-tab behavior for the same user (Tab A vs Tab B Last-Write-Wins and local restoration).

---

## 2. Breaking Point Classification (The 5 Degradation Levels)

| Level | Classification | Criteria | Action |
| :--- | :--- | :--- | :--- |
| **Level 0** | **Healthy** | Error rate < 0.1%, P95 latency < 500ms, 100% data persistence accuracy, 0 data corruptions | Proceed to next concurrency step |
| **Level 1** | **Degraded** | P95 latency > 1500ms or P99 > 3000ms, occasional retry, error rate < 2%, zero data corruption | Note degradation threshold; proceed with smaller step increments |
| **Level 2** | **Unstable** | Error rate between 2% and 10%, frequent PostgREST timeouts (>5s), saves failing intermittently | Identify bottleneck subsystem; narrow search around transition point |
| **Level 3** | **Broken** | Error rate > 10%, saves consistently fail, auth token verification fails, database connection refused | Stop ramp; mark Breaking Point |
| **Level 4** | **Safety Boundary** | **CRITICAL FAILURE:** Cross-user data leakage, project overwrite between distinct accounts, RLS bypass, or document corruption | **ABORT IMMEDIATELY.** System failed security/integrity guarantee. |

---

## 3. Progressive Ramp Stages

Ramping proceeds adaptively through the following stages:

```
Stage 1:   1 User   (Baseline sanity check)
Stage 2:   2 Users  (Basic concurrency & race verification)
Stage 3:   5 Users  (Low load)
Stage 4:  10 Users  (Standard multi-user traffic)
Stage 5:  20 Users  (Moderate concurrency)
Stage 6:  50 Users  (Substantial concurrent writing)
Stage 7: 100 Users  (First major capacity milestone)
Stage 8: 200 Users  (High load)
Stage 9: 500 Users  (Stress threshold)
Stage 10: 1000+ Users (Push to failure boundary if stable)
```

**Adaptive Step Rule:**
If a level transition (e.g. Level 0 -> Level 1 or Level 1 -> Level 2) occurs between Stage $N$ and Stage $N+1$ (for example, healthy at 100 but degraded at 200), we back off and perform fine-grained probing (e.g., 120, 140, 160, 180, 200) to isolate the exact tipping point.

---

## 4. Specific Test Scenarios & Invariants

### 4.1 Database Correctness & Isolation Test (Cross-User Integrity)
- **Setup:** Generate isolated test users ($U_1, U_2, \dots, U_n$) with dedicated projects ($P_1, P_2, \dots, P_n$).
- **Action:** Simultaneously dispatch updates:
  - $U_1 \to P_1 \to \text{Save}_1$
  - $U_2 \to P_2 \to \text{Save}_2$
  - $U_n \to P_n \to \text{Save}_n$
- **Verification:**
  - $U_1$ querying $P_2$ must return HTTP 404 or empty (RLS validation).
  - Exact payload of $P_1$ after load must match $\text{Save}_1$ byte-for-byte without collision or cross-contamination.

### 4.2 Multi-Tab Same-User Test (Tab Collision)
- **Setup:** Single user $U_{test}$ with 3 active browser contexts/tabs on Project $P_A$.
- **Action:** Overlapping edits dispatched from Tab 1, Tab 2, and Tab 3.
- **Verification:** Confirm and document current Last-Write-Wins behavior without race-condition crashes.

### 4.3 Recovery Test (Post-Stress Normalization)
- **Action:** After pushing to Level 2/3 degradation:
  1. Abort load traffic.
  2. Measure cool-down latency at $t = 5s, 15s, 30s, 60s$.
  3. Dispatch single baseline request to verify full recovery of database connections, auth endpoints, and save reliability.

---

## 5. Critical Safety Gate & Environment Policy

1. **Test Account Quarantine:** All synthetic load accounts are prefixed with `loadtest_...` and tagged in metadata to prevent mixing with genuine user data.
2. **Rate-Limit Awareness:** Monitor HTTP 429 (`email rate limit exceeded` or PostgREST connection limits) to distinguish platform rate limiting from internal architectural failure.
3. **Automatic Circuit Breaker:** The test harness automatically terminates if:
   - Error rate exceeds 25% across any 10-second window.
   - Any Level 4 safety failure (cross-user data contamination) is detected.
