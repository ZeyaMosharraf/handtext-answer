# HandText Workload Profiles — Phase 8 Concurrency Testing

**Document Status:** Canonical  
**Context:** Defines the realistic user journeys, request cadences, and payload dimensions to be simulated during concurrency testing.

---

## 1. Typical User Session Journey

A standard HandText user session comprises the following lifecycle:

```
[1. Authenticate]
      │
      ▼
[2. Route Guard Validation] ─── GET /auth/v1/user
      │
      ▼
[3. Dashboard Load] ─────────── GET /rest/v1/projects (order by updated_at desc)
      │                         GET /rest/v1/profiles (select plan)
      │                         GET /rest/v1/usage (monthly usage check)
      │
      ▼
[4. Open Project] ───────────── GET /rest/v1/projects?id=eq.<id>&select=*
      │
      ▼
[5. Local Editing] ──────────── Client-side React state + IndexedDB autosave
      │                         (NO HTTP PostgREST traffic)
      │
      ▼
[6. Cloud Save (Ctrl+S)] ────── PATCH /rest/v1/projects?id=eq.<id>
      │                         Payload: { name, question, content, settings }
      │
      ▼
[7. Generation (Optional)] ──── POST /rest/v1/rpc/record_usage { p_pages: N }
      │                         PATCH /rest/v1/projects?id=eq.<id> { page_count, status: "generated" }
      │
      ▼
[8. Reload / Re-fetch] ──────── GET /rest/v1/projects?id=eq.<id>&select=*
                                Compare with IndexedDB draft
```

---

## 2. Workload Definitions

### Workload A: Light User ("The Quick Editor")
- **Behavior:**
  1. Authenticates / validates existing JWT session.
  2. Loads project list and opens single project (~5KB payload).
  3. Performs minor text edit.
  4. Waits 5 seconds, triggers 1 explicit Cloud Save (`Ctrl+S`).
  5. Refreshes / verifies project data.
- **Request Profile:**
  - 1 Auth validation (`GET /auth/v1/user`)
  - 2 Project reads (`GET /rest/v1/projects`)
  - 1 Cloud save (`PATCH /rest/v1/projects`)
  - **Save Frequency:** 1 save per 30–60 seconds.

---

### Workload B: Normal Editor ("The Homework Student")
- **Behavior:**
  1. Authenticates / validates session.
  2. Opens project with existing content (~15KB payload).
  3. Types continuously for 60 seconds (generates 20 local IndexedDB writes; 0 network writes).
  4. Inserts a MathBlock (`x = \frac{-b \pm \sqrt{b^2 - 4ac}}{2a}`).
  5. Presses `Ctrl+S` (Save 1).
  6. Edits another paragraph, adds Answer Margin notation (`Q.1`).
  7. Presses `Ctrl+S` (Save 2).
  8. Generates handwritten preview pages (calls `record_usage` RPC + PATCH status).
  9. Reloads project to inspect rendered pages.
- **Request Profile:**
  - 1 Auth validation
  - 2 Project reads
  - 2 Cloud saves (`PATCH /rest/v1/projects`)
  - 1 Usage record (`POST /rest/v1/rpc/record_usage`)
  - **Save Frequency:** 1 save per 15–20 seconds.

---

### Workload C: Heavy Editor ("The Exam Producer")
- **Behavior:**
  1. Authenticates.
  2. Loads large document with multiple blocks: Text, 5 MathBlocks, 1 Table (3x4), 1 GraphBlock (~60KB–150KB payload).
  3. Modifies table cells and complex LaTeX expressions.
  4. Performs repeated cloud saves (every 5–10 seconds under active revision).
  5. Triggers page generation for 4–8 pages (`record_usage` RPC with `p_pages: 6`).
  6. Simultaneously opens second tab to verify generated output.
- **Request Profile:**
  - 2 Auth validations
  - 4 Project reads
  - 5–8 Cloud saves with large JSON payload (up to 150KB per PATCH)
  - 1–2 Usage record RPCs
  - **Save Frequency:** 1 save per 5–10 seconds.

---

## 3. Workload Distribution Matrix for Progressive Ramp

In realistic production traffic, users do not all behave identically. For concurrency testing, we distribute simulated users across workloads:
- **Workload A (Light):** 60% of concurrent pool
- **Workload B (Normal):** 30% of concurrent pool
- **Workload C (Heavy):** 10% of concurrent pool

This prevents unrealistically skewing the test into purely synthetic 100% heavy stress while guaranteeing that heavy document payloads and RPC operations are continuously executed under load.
