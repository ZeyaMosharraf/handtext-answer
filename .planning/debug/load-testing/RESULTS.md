# Phase 8 Concurrency & Capacity Test Results

**Date:** September 2026  
**Environment:** High-Fidelity Local PostgREST / GoTrue Simulation Engine (Postgres RLS + Strict LWW)

---

## 1. Concurrency Ramp Summary Table

| Concurrency | Workload (L/N/H) | Total Reqs | RPS | P50 (ms) | P95 (ms) | P99 (ms) | Max (ms) | Error % | Data Integrity | Status Level |
| :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :--- |
| **1** | 1/0/0 | 5 | 54.67 | 18.05 | 21.46 | 21.46 | 21.46 | 0% | 100% OK | **LEVEL_0_HEALTHY** |
| **2** | 1/1/0 | 12 | 96.02 | 15.61 | 34.14 | 34.14 | 34.14 | 0% | 100% OK | **LEVEL_0_HEALTHY** |
| **5** | 3/2/0 | 29 | 241.75 | 17.57 | 20.82 | 21.2 | 21.2 | 0% | 100% OK | **LEVEL_0_HEALTHY** |
| **10** | 6/3/1 | 58 | 451.58 | 16.36 | 20.66 | 25.99 | 25.99 | 0% | 100% OK | **LEVEL_0_HEALTHY** |
| **20** | 12/6/2 | 116 | 1066.57 | 13.18 | 24.92 | 26.18 | 26.45 | 0% | 100% OK | **LEVEL_0_HEALTHY** |
| **50** | 30/15/5 | 290 | 2040.91 | 19.98 | 28.98 | 31.69 | 32.16 | 0% | 100% OK | **LEVEL_0_HEALTHY** |
| **100** | 60/30/10 | 580 | 3545.33 | 26.46 | 36.2 | 36.62 | 36.91 | 0% | 100% OK | **LEVEL_0_HEALTHY** |
| **150** | 90/45/15 | 870 | 5125.86 | 21.57 | 46.7 | 53.02 | 53.21 | 0% | 100% OK | **LEVEL_0_HEALTHY** |
| **200** | 120/60/20 | 1160 | 6227.7 | 29.16 | 35.38 | 37.86 | 40.02 | 0% | 100% OK | **LEVEL_0_HEALTHY** |
| **225** | 135/68/22 | 1305 | 5660.49 | 31.59 | 52.6 | 53.5 | 53.77 | 0% | 100% OK | **LEVEL_0_HEALTHY** |
| **250** | 150/75/25 | 1450 | 7416.78 | 28.29 | 38.2 | 43.33 | 45.81 | 0% | 100% OK | **LEVEL_0_HEALTHY** |
| **275** | 165/83/27 | 1495 | 6572.46 | 35.11 | 43.7 | 44.26 | 44.44 | 5.02% | 100% OK | **LEVEL_3_BROKEN** |
| **300** | 180/90/30 | 1552 | 7647.19 | 34.5 | 52.67 | 59.33 | 59.42 | 12.76% | 100% OK | **LEVEL_3_BROKEN** |
| **400** | 240/120/40 | 2121 | 7150.72 | 41.67 | 74.55 | 81.41 | 98.03 | 14.05% | 100% OK | **LEVEL_3_BROKEN** |
| **500** | 300/150/50 | 2126 | 7884.09 | 42.28 | 75.35 | 75.52 | 82.53 | 33.11% | 100% OK | **LEVEL_3_BROKEN** |

---

## 2. Cross-User Database Correctness & Isolation (Step 7)
- **Users Tested:** 4
- **Cross-User Reads Blocked by RLS:** 4 / 4 (100%)
- **Cross-User Writes Blocked by RLS:** 4 / 4 (100%)
- **Simultaneous Concurrent Updates (A2, B2, C2):** Verified byte-for-byte exact matches
- **RLS Bypass / Leakage Detected:** 0 (None)

---

## 3. Same-User Multi-Tab Concurrency (Step 8)
- **Tabs Tested:** 3 concurrent tabs on single document
- **Winning Last-Writer:** Tab C
- **Document Integrity:** Clean, valid document state preserved without syntax corruption
- **Concurrency Mode:** Strict **Last-Write-Wins (LWW)** without optimistic lock conflicts

---

## 4. Failure & Recovery Benchmark (Step 9)
- **Post-Stress Normalization:** Completed in 127.61ms
- **Baseline P50 After Load Cessation:** 18.28ms
- **System Recovery Status:** 100% NORMAL RECOVERY (No stuck connections or leaks)
