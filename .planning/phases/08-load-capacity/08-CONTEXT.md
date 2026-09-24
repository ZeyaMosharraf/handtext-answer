# Phase 8 — Concurrency, Capacity & Breaking-Point Testing: Context & Decisions

**Phase:** Phase 8  
**Status:** Discussed & Decisions Locked  
**Created:** September 2026  
**Artifacts Directory:** `.planning/debug/load-testing/`

---

## 1. Locked Architectural & Environment Decisions

1. **Target Environment:**
   - **Decision:** Direct testing against the remote Supabase project (`https://aojpzcmwretmknftvzde.supabase.co`).
   - **Account Strategy:** Pre-seed a dedicated pool of isolated test accounts (`loadtest_user_*@example.com`) and reuse cached JWT tokens. This completely circumvents GoTrue email signup / password reset rate limits while keeping all downstream PostgREST and RLS evaluation 100% genuine and cloud-tested.

2. **Workload Model & Persistence Invariants:**
   - Keystroke typing in HandText is **100% client-side** (debounced 3000ms write to IndexedDB `handtext-local`).
   - Network PostgREST calls occur on **explicit cloud save** (Save button, `Ctrl+S`, page generation), project list/open, and user usage lookups.
   - Workload distribution:
     - 60% Workload A (Light: load, 1 edit, 1 save, reload)
     - 30% Workload B (Normal: load, multi-block edit, 2 saves, generate usage RPC, reload)
     - 10% Workload C (Heavy: 50–150KB document with 5 MathBlocks, Table, Graph, rapid saves, multi-tab reload)

3. **Tooling Strategy:**
   - **Layer A (Protocol & Database Concurrency):** High-performance TypeScript harness (`tests/load/run-load-test.ts`) using Node 24 native fetch, HTTP keep-alive connection pooling, sub-millisecond `performance.now()` metrics, and strict cryptographic / byte-level data verification.
   - **Layer B (Multi-Context Browser Isolation):** Playwright multi-context test (`tests/load/browser-concurrency.test.ts`) validating cross-user data isolation (User A cannot view/mutate User B's project) and same-user multi-tab Last-Write-Wins behavior.

4. **Progressive Ramp & Adaptive Search:**
   - Increments: 1, 2, 5, 10, 20, 50, 100, 200, 500...
   - Adaptive search around transition boundaries (Level 0 Healthy -> Level 1 Degraded -> Level 2 Unstable -> Level 3 Broken -> Level 4 Safety Boundary).
   - Automatic circuit breaker: Halts if error rate > 25% or if any cross-user data leakage occurs.

5. **Reporting & Deliverables:**
   - Machine-readable result files: `.planning/debug/load-testing/results/<stage>-users.json`
   - Detailed synthesis:
     - `.planning/debug/load-testing/RESULTS.md`
     - `.planning/debug/load-testing/BREAKING-POINT.md`
     - `.planning/debug/load-testing/RECOMMENDATIONS.md`
