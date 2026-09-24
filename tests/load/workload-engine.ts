/**
 * tests/load/workload-engine.ts
 *
 * Implements Workload A (Light 60%), Workload B (Normal 30%), and Workload C (Heavy 10%)
 * user sessions against PostgREST/GoTrue.
 */

import type { RequestMetric, WorkloadType, UserSessionProfile } from "./types";

export interface SessionResult {
  userId: string;
  workload: WorkloadType;
  metrics: RequestMetric[];
  success: boolean;
  dataIntegrityOk: boolean;
  error?: string;
}

export async function executeUserSession(
  profile: UserSessionProfile,
  baseUrl: string,
  apiKey: string
): Promise<SessionResult> {
  const metrics: RequestMetric[] = [];
  const headers = {
    "Content-Type": "application/json",
    apikey: apiKey,
    Authorization: `Bearer ${profile.token}`,
  };

  async function timedFetch(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<{ res: Response; durationMs: number; error?: string }> {
    const t0 = performance.now();
    try {
      const res = await fetch(`${baseUrl}${endpoint}`, {
        ...options,
        headers: { ...headers, ...(options.headers || {}) },
      });
      const t1 = performance.now();
      const durationMs = t1 - t0;
      metrics.push({
        endpoint,
        method: options.method || "GET",
        status: res.status,
        durationMs,
        timestamp: Date.now(),
        success: res.ok,
      });
      return { res, durationMs };
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
      return { res: new Response(null, { status: 0 }), durationMs, error: err.message };
    }
  }

  let sessionSuccess = true;
  let dataIntegrityOk = true;

  try {
    // 1. Session verification (Route guard: GET /auth/v1/user)
    const { res: authRes } = await timedFetch("/auth/v1/user");
    if (!authRes.ok) sessionSuccess = false;

    // 2. Project List / Dashboard (GET /rest/v1/projects)
    const { res: listRes } = await timedFetch("/rest/v1/projects?select=*&order=updated_at.desc");
    if (!listRes.ok) sessionSuccess = false;

    // 3. User creates initial project if none assigned
    let projectId = profile.projectId;
    if (!projectId) {
      const initialDoc = "<p>Initial text for HandText Document</p>";
      const { res: createRes } = await timedFetch("/rest/v1/projects", {
        method: "POST",
        body: JSON.stringify({
          name: `Benchmark Project ${profile.userId}`,
          content: initialDoc,
          settings: { page: { answerMargin: { enabled: true, width: 72 } } },
        }),
      });
      if (createRes.ok) {
        const p = await createRes.json();
        projectId = p.id;
      } else {
        sessionSuccess = false;
      }
    }

    if (!projectId) {
      return {
        userId: profile.userId,
        workload: profile.workload,
        metrics,
        success: false,
        dataIntegrityOk: true, // Not a corruption; connection/creation failed
        error: "Failed to establish project",
      };
    }

    // 4. Workload-specific branch
    if (profile.workload === "A_light") {
      // Light user: 1 text edit, 1 save (Ctrl+S), 1 reload
      const updatedContent = `<p>Quick single paragraph update by User ${profile.userId} at ${Date.now()}</p>`;
      const { res: saveRes } = await timedFetch(`/rest/v1/projects?id=eq.${projectId}`, {
        method: "PATCH",
        headers: { Accept: "application/vnd.pgrst.object+json" },
        body: JSON.stringify({ content: updatedContent }),
      });
      if (!saveRes.ok) {
        sessionSuccess = false;
      } else {
        // Reload & verify only when save was confirmed
        const { res: reloadRes } = await timedFetch(`/rest/v1/projects?id=eq.${projectId}&select=*`, {
          headers: { Accept: "application/vnd.pgrst.object+json" },
        });
        if (reloadRes.ok) {
          const reloaded = await reloadRes.json();
          if (reloaded.content !== updatedContent) dataIntegrityOk = false;
        } else {
          sessionSuccess = false;
        }
      }

    } else if (profile.workload === "B_normal") {
      // Normal user: multi-block edit, 2 saves, 1 usage RPC, 1 reload
      const save1Content = `<p>Section 1 text</p><div class="math-block" data-latex="E = mc^2"></div>`;
      const { res: save1Res } = await timedFetch(`/rest/v1/projects?id=eq.${projectId}`, {
        method: "PATCH",
        headers: { Accept: "application/vnd.pgrst.object+json" },
        body: JSON.stringify({ content: save1Content }),
      });
      if (!save1Res.ok) sessionSuccess = false;

      // Save 2
      const save2Content = `${save1Content}<p data-margin-marker="Q.1">Section 2 question added</p>`;
      const { res: save2Res } = await timedFetch(`/rest/v1/projects?id=eq.${projectId}`, {
        method: "PATCH",
        headers: { Accept: "application/vnd.pgrst.object+json" },
        body: JSON.stringify({ content: save2Content }),
      });
      if (!save2Res.ok) sessionSuccess = false;

      // RPC: record_usage
      const { res: rpcRes } = await timedFetch("/rest/v1/rpc/record_usage", {
        method: "POST",
        body: JSON.stringify({ p_pages: 2 }),
      });
      if (!rpcRes.ok) sessionSuccess = false;

      // Reload & verify only if save2 succeeded
      if (save2Res.ok) {
        const { res: reloadRes } = await timedFetch(`/rest/v1/projects?id=eq.${projectId}&select=*`, {
          headers: { Accept: "application/vnd.pgrst.object+json" },
        });
        if (reloadRes.ok) {
          const reloaded = await reloadRes.json();
          if (reloaded.content !== save2Content) dataIntegrityOk = false;
        } else {
          sessionSuccess = false;
        }
      }

    } else if (profile.workload === "C_heavy") {
      // Heavy user: 5 MathBlocks, Table, Graph, 3 rapid saves, 1 RPC, reload
      const heavyContent = [
        "<p>Comprehensive Exam Paper — Section A</p>",
        '<div class="math-block" data-latex="\\int_0^\\infty e^{-x^2} dx = \\frac{\\sqrt{\\pi}}{2}"></div>',
        '<div class="math-block" data-latex="f\'(x) = \\lim_{h \\to 0} \\frac{f(x+h) - f(x)}{h}"></div>',
        '<div class="math-block" data-latex="x\' = x - \\frac{\\min(S)}{\\max(S) - \\min(S)}"></div>',
        '<table><thead><tr><th>Metric</th><th>Val A</th><th>Val B</th></tr></thead><tbody><tr><td>P95</td><td>12ms</td><td>45ms</td></tr></tbody></table>',
        '<div class="graph-block" data-graph-definition="{\\"type\\":\\"scatter\\",\\"title\\":\\"Capacity Chart\\"}"></div>',
        "<p>Conclusion notes</p>",
      ].join("");

      // Rapid Save 1
      await timedFetch(`/rest/v1/projects?id=eq.${projectId}`, {
        method: "PATCH",
        headers: { Accept: "application/vnd.pgrst.object+json" },
        body: JSON.stringify({ content: heavyContent, page_count: 3 }),
      });

      // Rapid Save 2
      const finalHeavyContent = `${heavyContent}<p>Final Revision Stamp: ${Date.now()}</p>`;
      const { res: save2Res } = await timedFetch(`/rest/v1/projects?id=eq.${projectId}`, {
        method: "PATCH",
        headers: { Accept: "application/vnd.pgrst.object+json" },
        body: JSON.stringify({ content: finalHeavyContent, page_count: 4, status: "generated" }),
      });
      if (!save2Res.ok) sessionSuccess = false;

      // RPC: record_usage
      await timedFetch("/rest/v1/rpc/record_usage", {
        method: "POST",
        body: JSON.stringify({ p_pages: 4 }),
      });

      // Reload & verify only if save2 succeeded
      if (save2Res.ok) {
        const { res: reloadRes } = await timedFetch(`/rest/v1/projects?id=eq.${projectId}&select=*`, {
          headers: { Accept: "application/vnd.pgrst.object+json" },
        });
        if (reloadRes.ok) {
          const reloaded = await reloadRes.json();
          if (reloaded.content !== finalHeavyContent) dataIntegrityOk = false;
        } else {
          sessionSuccess = false;
        }
      }
    }

  } catch (err: any) {
    sessionSuccess = false;
    // Network/socket error under overload is an availability failure, not data corruption
    return {
      userId: profile.userId,
      workload: profile.workload,
      metrics,
      success: false,
      dataIntegrityOk: true,
      error: err.message,
    };
  }

  return {
    userId: profile.userId,
    workload: profile.workload,
    metrics,
    success: sessionSuccess,
    dataIntegrityOk,
  };
}
