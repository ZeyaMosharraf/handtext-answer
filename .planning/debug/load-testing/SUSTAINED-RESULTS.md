# Phase 8B Sustained Realistic User Benchmark Results

**Date:** September 2026  
**Methodology:** Sustained Multi-User Sessions with Think-Time, Debounced IndexedDB Autosave & Realistic Cloud Saves  
**Workload Distribution:** 60% Light, 30% Normal, 10% Heavy  

---

## 1. Sustained Concurrency Ramp Summary

| Active Users | Duration | Total Reqs | Sustained RPS | Req/User/Min | Saves/User/Min | P50 (ms) | P95 (ms) | P99 (ms) | Max (ms) | Error % | Data Integrity | Status Level |
| :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :--- |
| **10** | 12.06s | 84 | 6.96 | 41.79 | 12.44 | 31.97 | 34.25 | 34.75 | 34.75 | 0% | 100% OK | **LEVEL_0_HEALTHY** |
| **25** | 12.02s | 211 | 17.55 | 42.12 | 12.78 | 30.47 | 34.07 | 35.59 | 37.03 | 0% | 100% OK | **LEVEL_0_HEALTHY** |
| **50** | 12.05s | 406 | 33.68 | 40.42 | 11.95 | 31.97 | 35.31 | 39.64 | 39.77 | 0% | 100% OK | **LEVEL_0_HEALTHY** |
| **100** | 12.06s | 843 | 69.89 | 41.93 | 12.53 | 31.78 | 35.31 | 37.44 | 46.82 | 0% | 100% OK | **LEVEL_0_HEALTHY** |
| **200** | 12.12s | 1653 | 136.37 | 40.91 | 12.2 | 30.98 | 44.89 | 51.61 | 62.77 | 0% | 100% OK | **LEVEL_0_HEALTHY** |
| **300** | 16.13s | 2914 | 180.66 | 36.13 | 13.14 | 30.96 | 78.46 | 84.21 | 89.69 | 1.82% | 100% OK | **LEVEL_1_DEGRADED** |
| **500** | 16.14s | 4826 | 299.04 | 35.88 | 12.99 | 18.94 | 94.39 | 111.93 | 122.93 | 5.3% | 100% OK | **LEVEL_2_UNSTABLE** |
| **750** | 16.19s | 7319 | 452.2 | 36.18 | 13.17 | 18.46 | 72.29 | 141.95 | 155.44 | 6.83% | 100% OK | **LEVEL_2_UNSTABLE** |
| **1000** | 16.21s | 9737 | 600.75 | 36.05 | 13.15 | 18.35 | 88.32 | 177.33 | 188.79 | 7.63% | 100% OK | **LEVEL_2_UNSTABLE** |
| **1500** | 16.33s | 14616 | 894.92 | 35.8 | 13.06 | 18.04 | 134.34 | 258.05 | 274.8 | 8.4% | 100% OK | **LEVEL_2_UNSTABLE** |
| **2000** | 16.45s | 19520 | 1186.86 | 35.61 | 13.02 | 17.72 | 197.68 | 371.99 | 384.94 | 8.82% | 100% OK | **LEVEL_2_UNSTABLE** |

---

## 2. Playwright Real Browser Context Concurrency (Step 11)

| Browser Contexts | P50 (ms) | P95 (ms) | Max (ms) | Success Rate | Document Integrity |
| :---: | :---: | :---: | :---: | :---: | :---: |
| **10 contexts** | 1167.89ms | 1191.57ms | 1191.57ms | 10/10 (100%) | 100% PASS ✓ |
| **25 contexts** | 3013.07ms | 3447.12ms | 3447.16ms | 25/25 (100%) | 100% PASS ✓ |
| **50 contexts** | 7642.66ms | 8411.57ms | 8495.1ms | 50/50 (100%) | 100% PASS ✓ |

- **Verification Details:** Real Chromium instances running isolated BrowserContexts.
- **Workflow Verified:** Session restoration, editor DOM initialization, human typing, MathBlock (<div class="math-block" data-latex="...">), TableBlock (<table>), local persistence (IndexedDB/localStorage), Cloud Save PATCH, and page reload verification.
- **Cross-Context Security:** 100% isolated storage and state between contexts.

---

## 3. Cross-User Database Correctness & Isolation (Step 12)
- **Users Tested:** 4
- **Cross-User Reads Blocked:** 4 / 4 (100%)
- **Cross-User Writes Blocked:** 4 / 4 (100%)
- **Data Integrity:** 100% byte-for-byte exact equality confirmed across all reloaded documents.

---

## 4. Same-User Multi-Tab Concurrency (Step 12)
- **Tabs Tested:** 3 concurrent tabs on a single document
- **Winning Last-Writer:** Tab C
- **Integrity:** Clean document preserved without syntax corruption
- **Mode:** Strict Last-Write-Wins (LWW)

---

## 5. Failure & Recovery Benchmark (Step 13)
- **Recovery Time:** 4039.64ms
- **Baseline P50 After Load:** 16.80ms
- **System Health:** 100% normal recovery without orphaned transactions or stuck connection locks.
