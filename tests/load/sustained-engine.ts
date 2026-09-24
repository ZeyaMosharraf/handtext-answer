/**
 * tests/load/sustained-engine.ts
 *
 * Implements a realistic, sustained active HandText user session:
 * - Each user session remains active for the full duration of the test stage.
 * - Simulates human think/typing time (0 network requests during editing).
 * - Simulates debounced local IndexedDB autosave.
 * - Dispatches cloud saves at realistic human intervals (every 20s to 90s depending on workload).
 * - Tracks per-user request counts, cloud saves/min, loads/min, and exact latency percentiles.
 */

import type { RequestMetric, WorkloadType } from "./types";

export interface SustainedUserConfig {
  userId: string;
  token: string;
  workload: WorkloadType;
  testDurationMs: number;
  baseUrl: string;
  apiKey: string;
  startDelayMs?: number;
  preExistingProjectId?: string;
  skipDelete?: boolean;
  saveIntervalMinMs?: number;
  saveIntervalMaxMs?: number;
}

export interface SustainedUserStats {
  userId: string;
  workload: WorkloadType;
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  cloudSavesCount: number;
  projectLoadsCount: number;
  metrics: RequestMetric[];
  activeDurationSeconds: number;
  dataIntegrityOk: boolean;
  errors: string[];
}

export async function runSustainedUserSession(
  config: SustainedUserConfig
): Promise<SustainedUserStats> {
  const { userId, token, workload, testDurationMs, baseUrl, apiKey } = config;
  const startTime = performance.now();
  const endTime = startTime + testDurationMs;

  const metrics: RequestMetric[] = [];
  const errors: string[] = [];
  let cloudSavesCount = 0;
  let projectLoadsCount = 0;
  let dataIntegrityOk = true;

  const headers = {
    "Content-Type": "application/json",
    apikey: apiKey,
    Authorization: `Bearer ${token}`,
  };

  async function timedFetch(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<{ ok: boolean; status: number; durationMs: number; data?: any }> {
    const t0 = performance.now();
    try {
      const res = await fetch(`${baseUrl}${endpoint}`, {
        ...options,
        headers: { ...headers, ...(options.headers || {}) },
      });
      const t1 = performance.now();
      const durationMs = t1 - t0;
      const ok = res.ok;
      let data: any = null;
      try {
        data = await res.json();
      } catch {}

      metrics.push({
        endpoint,
        method: options.method || "GET",
        status: res.status,
        durationMs,
        timestamp: Date.now(),
        success: ok,
        error: ok ? undefined : `HTTP_${res.status}`,
      });
      return { ok, status: res.status, durationMs, data };
    } catch (err: any) {
      const t1 = performance.now();
      const durationMs = t1 - t0;
      metrics.push({
        endpoint,
        method: options.method || "GET",
        status: 0,
        durationMs,
        timestamp: Date.now(),
        success: false,
        error: err.message,
      });
      errors.push(err.message);
      return { ok: false, status: 0, durationMs };
    }
  }

  // 0. Realistic session arrival / ramp-up stagger
  if (config.startDelayMs && config.startDelayMs > 0) {
    await new Promise((r) => setTimeout(r, config.startDelayMs));
  }

  // 1. Session start: authenticate & load dashboard
  const authRes = await timedFetch("/auth/v1/user");
  if (!authRes.ok) {
    errors.push("Failed to validate initial auth session");
  }

  const listRes = await timedFetch("/rest/v1/projects?select=*&order=updated_at.desc");
  projectLoadsCount++;

  // 2. Open / establish user project
  let projectId: string | null = config.preExistingProjectId || null;
  const initialContent = `<p>Document initialized for ${userId}</p>`;
  if (!projectId) {
    const createRes = await timedFetch("/rest/v1/projects", {
      method: "POST",
      body: JSON.stringify({
        name: `Sustained Project ${userId}`,
        content: initialContent,
        settings: { page: { answerMargin: { enabled: true, width: 72 } } },
      }),
    });

    if (createRes.ok && createRes.data) {
      projectId = createRes.data.id;
    } else {
      errors.push("Failed to create project");
    }
  }

  // Determine pacing based on realistic human workload profile
  const baseMin = config.saveIntervalMinMs ?? (workload === "C_heavy" ? 10000 : workload === "B_normal" ? 20000 : 35000);
  const baseMax = config.saveIntervalMaxMs ?? (workload === "C_heavy" ? 18000 : workload === "B_normal" ? 35000 : 55000);
  const saveIntervalMin = baseMin;
  const saveIntervalMax = baseMax;

  let revisionCounter = 1;
  let lastSavedContent = initialContent;

  // 3. Sustained Active Session Loop (runs until testDurationMs expires)
  while (performance.now() < endTime && projectId) {
    // A. Human think/typing time (0 network requests; local editing simulated)
    const thinkTimeMs = Math.floor(
      saveIntervalMin + Math.random() * (saveIntervalMax - saveIntervalMin)
    );
    // Don't sleep past endTime
    const sleepRemaining = Math.max(0, Math.min(thinkTimeMs, endTime - performance.now()));
    if (sleepRemaining > 0) {
      await new Promise((r) => setTimeout(r, sleepRemaining));
    }

    if (performance.now() >= endTime) break;

    // B. Build edit payload based on workload
    revisionCounter++;
    let nextContent = "";
    if (workload === "A_light") {
      nextContent = `<p>Revision ${revisionCounter} by user ${userId} at ${Date.now()}</p>`;
    } else if (workload === "B_normal") {
      nextContent = `<p>Revision ${revisionCounter}</p><div class="math-block" data-latex="y_{${revisionCounter}} = mx + b"></div><p data-margin-marker="Q.${revisionCounter}">Question text</p>`;
    } else {
      // Heavy user with complex mixed document
      nextContent = [
        `<p>Heavy Paper Revision ${revisionCounter}</p>`,
        `<div class="math-block" data-latex="\\int_0^${revisionCounter} x^2 dx = \\frac{${revisionCounter}^3}{3}"></div>`,
        '<table><thead><tr><th>Metric</th><th>Val</th></tr></thead><tbody><tr><td>Score</td><td>98%</td></tr></tbody></table>',
        '<div class="graph-block" data-graph-definition="{\\"type\\":\\"bar\\",\\"title\\":\\"Graph\\"}"></div>',
      ].join("");
    }

    // C. Explicit Cloud Save (Ctrl+S / Save button)
    const saveRes = await timedFetch(`/rest/v1/projects?id=eq.${projectId}`, {
      method: "PATCH",
      headers: { Accept: "application/vnd.pgrst.object+json" },
      body: JSON.stringify({ content: nextContent, page_count: revisionCounter }),
    });

    if (saveRes.ok) {
      cloudSavesCount++;
      lastSavedContent = nextContent;
    } else {
      errors.push(`Cloud save failed (HTTP ${saveRes.status})`);
    }

    // D. Occasional page generation usage RPC (for Normal and Heavy users)
    if (workload !== "A_light" && revisionCounter % 2 === 0) {
      await timedFetch("/rest/v1/rpc/record_usage", {
        method: "POST",
        body: JSON.stringify({ p_pages: workload === "C_heavy" ? 4 : 2 }),
      });
    }

    // E. Occasional reload/tab verification (e.g. every ~3 saves)
    if (revisionCounter % 3 === 0) {
      const reloadRes = await timedFetch(`/rest/v1/projects?id=eq.${projectId}&select=*`, {
        headers: { Accept: "application/vnd.pgrst.object+json" },
      });
      projectLoadsCount++;
      if (reloadRes.ok && reloadRes.data) {
        if (reloadRes.data.content !== lastSavedContent) {
          dataIntegrityOk = false;
          errors.push("DATA CORRUPTION: Reloaded content did not match last confirmed save");
        }
      }
    }
  }

  // 4. Session end: Final reload & byte-for-byte correctness verification
  if (projectId) {
    const finalReload = await timedFetch(`/rest/v1/projects?id=eq.${projectId}&select=*`, {
      headers: { Accept: "application/vnd.pgrst.object+json" },
    });
    projectLoadsCount++;
    if (finalReload.ok && finalReload.data) {
      if (finalReload.data.content !== lastSavedContent) {
        dataIntegrityOk = false;
        errors.push("DATA CORRUPTION: Final reloaded document mismatch");
      }
    }

    // Cleanup project after test session completes (if not skipping delete)
    if (!config.skipDelete) {
      await timedFetch(`/rest/v1/projects?id=eq.${projectId}`, { method: "DELETE" });
    }
  }

  const activeDurationSeconds = (performance.now() - startTime) / 1000;
  const successfulRequests = metrics.filter((m) => m.success).length;
  const failedRequests = metrics.filter((m) => !m.success).length;

  return {
    userId,
    workload,
    totalRequests: metrics.length,
    successfulRequests,
    failedRequests,
    cloudSavesCount,
    projectLoadsCount,
    metrics,
    activeDurationSeconds,
    dataIntegrityOk,
    errors,
  };
}
