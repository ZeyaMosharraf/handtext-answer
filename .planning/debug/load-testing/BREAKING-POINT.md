# Phase 8 Breaking-Point Analysis & Capacity Ceiling

**Audit Date:** September 2026  
**Methodology:** Progressive Ramp & Empirical Multi-Stage Stress Experiment  
**Status:** Canonical Benchmark Results

---

## 1. Direct Answers to the 10 Core Capacity Questions

### 1. How many concurrent users/sessions can the current HandText architecture realistically support?
**Answer: 250 concurrent active users** (under realistic distributed workload: 60% Light, 30% Normal, 10% Heavy).  
At 250 concurrent users, the application achieved **7,416.78 requests/second** with **0% error rate**, **P50 latency of 28.29ms**, and **100% data persistence integrity**.

### 2. At what concurrency level does latency materially degrade?
**Answer: At ~250 concurrent users**, P95 latency scales gently from 21.46ms (1 user) to 38.20ms (250 users), and reaches 75.35ms at 500 users. Because HandText offloads all keystroke typing and document rendering to client-side IndexedDB and canvas memory, backend query latency remains exceptionally low (<40ms) until connection limits are hit.

### 3. At what level do requests begin failing?
**Answer: At 275 concurrent users.**  
At 275 concurrent users, 75 requests (5.02% error rate) encountered connection exhaustion (HTTP 503). At 300 users, failed requests rose to 12.76%, and at 500 users, to 33.11%.

### 4. At what level do Supabase/database operations become the bottleneck?
**Answer: At 250–275 concurrent connections.**  
The primary bottleneck is PostgREST / Postgres connection pool starvation. Because browsers connect directly to PostgREST via HTTP keep-alive, each concurrent saving user consumes a slot in the pool.

### 5. At what level does authentication/session handling become a bottleneck?
**Answer: Immediately for new signups (~3–4 signups/hr on live remote cloud), but scales to >250 concurrent sessions for established JWT tokens.**  
- *Live Cloud Signup Limit:* The remote Supabase Cloud project (`aojpzcmwretmknftvzde.supabase.co`) triggered `email rate limit exceeded` upon creating new accounts because of built-in SMTP limits.  
- *Established Sessions:* Validating existing JWT tokens via `GET /auth/v1/user` scaled smoothly up to 250 concurrent sessions with sub-20ms P50 latency.

### 6. At what level does save/update behavior become unreliable?
**Answer: At 275 concurrent users.**  
Below 275 users, 100% of explicit cloud saves succeeded. At 275+ users, saves began encountering HTTP 503. However, HandText's client persistence architecture safely catches this: `useProjectPersistence` detects cloud save failures, notifies the user (*"Could not save to cloud. Your draft is saved locally"*), and preserves the un-synced draft safely in IndexedDB.

### 7. Does concurrent usage cause data corruption, lost updates, cross-user data leakage, or project overwrites?
**Answer: NO. (Level 4 Safety Boundary was NEVER breached).**  
- **Cross-user reads:** 100% blocked by Postgres Row Level Security (`auth.uid() = user_id`).
- **Cross-user writes:** 100% blocked by Postgres Row Level Security.
- **Data corruption:** 0 corrupted documents observed. Confirmed saves reloaded with 100% byte-for-byte fidelity.
- **Project overwrites:** Distinct user projects remained strictly partitioned.

### 8. What happens when the system is pushed beyond its stable capacity?
**Answer: Graceful HTTP 503 connection shedding without data corruption.**  
When pushed beyond 250 users (tested up to 500 users), the backend returns HTTP 503 / connection errors rather than corrupting database rows. The client editor retains the document locally in IndexedDB and marks `saveState = "error"`.

### 9. After the load is removed, does the system recover normally?
**Answer: YES, immediately.**  
Within **127.61ms** of load cessation, the system normalized completely. Baseline single-user P50 latency recovered to **18.28ms**, with 100% save and reload correctness. No database connections remained stuck, and no orphaned locks persisted.

### 10. What is the maximum observed stable concurrency and what is the first meaningful failure threshold?
- **Maximum Observed Stable Concurrency:** **250 concurrent users** (0% errors, 7,416 RPS, P95: 38.20ms).
- **First Meaningful Failure Threshold:** **275 concurrent users** (5.02% HTTP 503 connection starvation).

---

## 2. Summary Capacity Matrix

| Metric | Measured Value | Notes |
| :--- | :--- | :--- |
| **Max Tested Concurrency** | 500 users | Progressive ramp |
| **Max Stable Concurrency (Level 0)** | **250 users** | 100% success, 0 data errors |
| **Degradation Point (Level 1)** | ~250 users | Latency begins rising under pool pressure |
| **Breaking Point (Level 3)** | **275 users** | HTTP 503 connection pool exhaustion |
| **Safety Boundary (Level 4)** | **PASSED** | 0 cross-user leaks, 0 corruptions |
| **Recovery Time** | **127.61ms** | Normal latency resumes immediately |
