/**
 * tests/load/local-backend.ts
 *
 * High-fidelity local Supabase simulation engine (PostgREST + GoTrue + RLS)
 *
 * Matches exact HandText production database schema:
 * - public.profiles (RLS: auth.uid() = id)
 * - public.projects (RLS: auth.uid() = user_id for SELECT, INSERT, UPDATE, DELETE)
 * - public.usage (RLS: auth.uid() = user_id for SELECT, record_usage RPC for writes)
 * - public.record_usage(p_pages integer)
 *
 * Supports true HTTP concurrency, connection limits, and latency simulation.
 */

import http from "node:http";
import { URL } from "node:url";

export interface LocalBackendOptions {
  port?: number;
  simulatedDbLatencyMs?: number;
  maxConcurrentConnections?: number;
}

export class LocalSupabaseServer {
  public server: http.Server;
  public port: number;
  public baseUrl: string = "";

  // In-memory relational tables
  private users = new Map<string, { id: string; email: string; password: string }>();
  private profiles = new Map<string, { id: string; email: string; full_name?: string; plan: string }>();
  private projects = new Map<string, {
    id: string;
    user_id: string;
    name: string;
    question: string;
    content: string;
    settings: any;
    page_count: number;
    status: string;
    created_at: string;
    updated_at: string;
  }>();
  private usage = new Map<string, { id: string; user_id: string; pages_generated: number; generation_date: string }>();

  private activeConnections = 0;
  private maxConcurrentConnections: number;
  private simulatedDbLatencyMs: number;

  constructor(options: LocalBackendOptions = {}) {
    this.port = options.port ?? 54321;
    this.simulatedDbLatencyMs = options.simulatedDbLatencyMs ?? 5;
    this.maxConcurrentConnections = options.maxConcurrentConnections ?? 250;

    this.server = http.createServer((req, res) => this.handleRequest(req, res));
  }

  public async start(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.server.listen(this.port, "127.0.0.1", () => {
        this.baseUrl = `http://127.0.0.1:${this.port}`;
        resolve();
      });
      this.server.on("error", reject);
    });
  }

  public async stop(): Promise<void> {
    return new Promise((resolve) => {
      this.server.close(() => resolve());
    });
  }

  public resetData(): void {
    this.users.clear();
    this.profiles.clear();
    this.projects.clear();
    this.usage.clear();
  }

  private parseToken(req: http.IncomingMessage): string | null {
    const authHeader = req.headers["authorization"] || "";
    if (authHeader.startsWith("Bearer ")) {
      return authHeader.slice(7).trim();
    }
    return null;
  }

  private getUserIdFromToken(token: string | null): string | null {
    if (!token) return null;
    // In our test engine, token is format `test_token_${userId}`
    if (token.startsWith("test_token_")) {
      const id = token.slice("test_token_".length);
      if (!this.users.has(id)) {
        this.users.set(id, { id, email: `${id}@handtext.internal`, password: "test-password" });
        this.profiles.set(id, { id, email: `${id}@handtext.internal`, plan: "free" });
      }
      return id;
    }
    return null;
  }

  private async handleRequest(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
    this.activeConnections++;

    // Connection overload simulation
    if (this.activeConnections > this.maxConcurrentConnections) {
      this.activeConnections--;
      res.writeHead(503, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Server connection pool exhausted (HTTP 503)" }));
      return;
    }

    // CORS headers
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, PATCH, DELETE, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, apikey, Prefer");

    if (req.method === "OPTIONS") {
      this.activeConnections--;
      res.writeHead(204);
      res.end();
      return;
    }

    // Read body
    let body = "";
    req.on("data", (chunk) => (body += chunk));
    req.on("end", async () => {
      try {
        if (this.simulatedDbLatencyMs > 0) {
          await new Promise((r) => setTimeout(r, this.simulatedDbLatencyMs));
        }

        const url = new URL(req.url ?? "/", `http://${req.headers.host || "localhost"}`);

        // Web UI Test Harness Route
        if (url.pathname === "/editor-test" && req.method === "GET") {
          const uid = url.searchParams.get("uid") || "anon";
          const tok = url.searchParams.get("tok") || "";
          const pid = url.searchParams.get("pid") || "proj_1";
          const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>HandText Browser Session</title>
  <style>
    body { font-family: sans-serif; margin: 20px; }
    #editor { border: 1px solid #cbd5e1; min-height: 180px; padding: 12px; border-radius: 6px; }
    .math-block { background: #e0f2fe; padding: 4px 8px; border-radius: 4px; display: inline-block; margin: 4px 0; font-family: monospace; }
    table { border-collapse: collapse; width: 100%; margin: 8px 0; }
    td, th { border: 1px solid #cbd5e1; padding: 6px 10px; }
    button { background: #2563eb; color: white; border: none; padding: 8px 16px; border-radius: 4px; cursor: pointer; }
    #status { margin-bottom: 8px; font-weight: bold; color: #1e293b; }
  </style>
</head>
<body>
  <div id="status">Editor Ready</div>
  <div id="editor" contenteditable="true"><p>Initial document text for user ${uid}</p></div>
  <div style="margin-top: 12px;">
    <button id="saveBtn">Save to Cloud</button>
  </div>
  <div id="savedState" style="display:none;"></div>

  <script>
    const uid = "${uid}";
    const tok = "${tok}";
    const pid = "${pid}";
    const editor = document.getElementById("editor");
    const status = document.getElementById("status");
    const saveBtn = document.getElementById("saveBtn");
    const savedState = document.getElementById("savedState");

    // Initialize local storage persistence
    localStorage.setItem("sb-auth-token", JSON.stringify({
      access_token: tok,
      user: { id: uid, email: uid + "@handtext.internal" }
    }));

    // Debounced local persistence (IndexedDB / localStorage)
    editor.addEventListener("input", () => {
      localStorage.setItem("handtext_local_" + pid, editor.innerHTML);
    });

    saveBtn.addEventListener("click", async () => {
      status.textContent = "Saving...";
      try {
        const res = await fetch("/rest/v1/projects?id=eq." + pid, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            "apikey": "handtext-phase8b-key",
            "Authorization": "Bearer " + tok
          },
          body: JSON.stringify({ content: editor.innerHTML })
        });
        if (res.ok) {
          status.textContent = "Saved";
          savedState.textContent = editor.innerHTML;
        } else {
          status.textContent = "Save Failed: " + res.status;
        }
      } catch (err) {
        status.textContent = "Error: " + err.message;
      }
    });
  </script>
</body>
</html>`;
          res.writeHead(200, { "Content-Type": "text/html" });
          res.end(html);
          return;
        }

        const token = this.parseToken(req);
        const currentUserId = this.getUserIdFromToken(token);

        // 1. GoTrue Auth Routes
        if (url.pathname === "/auth/v1/signup" && req.method === "POST") {
          const payload = JSON.parse(body || "{}");
          const email = payload.email;
          const password = payload.password;
          if (!email || !password) {
            res.writeHead(400, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ error: "Email and password required" }));
            return;
          }

          let existing = Array.from(this.users.values()).find((u) => u.email === email);
          if (!existing) {
            const id = `usr_${Math.random().toString(36).slice(2, 10)}`;
            existing = { id, email, password };
            this.users.set(id, existing);
            this.profiles.set(id, { id, email, plan: "free" });
          }

          const userToken = `test_token_${existing.id}`;
          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(
            JSON.stringify({
              user: { id: existing.id, email: existing.email },
              session: { access_token: userToken, token_type: "bearer", expires_in: 3600 },
            })
          );
          return;
        }

        if (url.pathname === "/auth/v1/token" && req.method === "POST") {
          const payload = JSON.parse(body || "{}");
          const user = Array.from(this.users.values()).find(
            (u) => u.email === payload.email && u.password === payload.password
          );
          if (!user) {
            res.writeHead(400, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ error: "Invalid login credentials" }));
            return;
          }
          const userToken = `test_token_${user.id}`;
          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(
            JSON.stringify({
              access_token: userToken,
              token_type: "bearer",
              expires_in: 3600,
              user: { id: user.id, email: user.email },
            })
          );
          return;
        }

        if (url.pathname === "/auth/v1/user" && req.method === "GET") {
          if (!currentUserId || !this.users.has(currentUserId)) {
            res.writeHead(401, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ error: "Unauthorized" }));
            return;
          }
          const user = this.users.get(currentUserId)!;
          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ id: user.id, email: user.email }));
          return;
        }

        // 2. PostgREST /rest/v1/projects
        if (url.pathname === "/rest/v1/projects") {
          if (!currentUserId) {
            res.writeHead(401, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ message: "permission denied for table projects" }));
            return;
          }

          // GET (SELECT) with RLS: auth.uid() = user_id
          if (req.method === "GET") {
            const idFilter = url.searchParams.get("id");
            let targetId: string | null = null;
            if (idFilter && idFilter.startsWith("eq.")) {
              targetId = idFilter.slice(3);
            }

            // RLS filter
            let userProjects = Array.from(this.projects.values()).filter(
              (p) => p.user_id === currentUserId
            );

            if (targetId) {
              userProjects = userProjects.filter((p) => p.id === targetId);
              if (req.headers["accept"]?.includes("vnd.pgrst.object+json")) {
                if (userProjects.length === 0) {
                  res.writeHead(404, { "Content-Type": "application/json" });
                  res.end(JSON.stringify({ message: "JSON object requested, multiple (or no) rows returned" }));
                  return;
                }
                res.writeHead(200, { "Content-Type": "application/json" });
                res.end(JSON.stringify(userProjects[0]));
                return;
              }
            }

            res.writeHead(200, { "Content-Type": "application/json" });
            res.end(JSON.stringify(userProjects));
            return;
          }

          // POST (INSERT) with RLS check: auth.uid() = user_id
          if (req.method === "POST") {
            const payload = JSON.parse(body || "{}");
            const newId = payload.id || `proj_${Math.random().toString(36).slice(2, 12)}`;
            const now = new Date().toISOString();
            const project = {
              id: newId,
              user_id: currentUserId,
              name: payload.name || "Untitled answer",
              question: payload.question || "",
              content: payload.content || "",
              settings: payload.settings || {},
              page_count: payload.page_count ?? 0,
              status: payload.status || "draft",
              created_at: now,
              updated_at: now,
            };
            this.projects.set(newId, project);

            res.writeHead(201, { "Content-Type": "application/json" });
            res.end(JSON.stringify(project));
            return;
          }

          // PATCH (UPDATE) with RLS: auth.uid() = user_id
          if (req.method === "PATCH") {
            const idFilter = url.searchParams.get("id");
            let targetId: string | null = null;
            if (idFilter && idFilter.startsWith("eq.")) {
              targetId = idFilter.slice(3);
            }

            if (!targetId || !this.projects.has(targetId)) {
              res.writeHead(200, { "Content-Type": "application/json" });
              res.end(JSON.stringify([]));
              return;
            }

            const existing = this.projects.get(targetId)!;
            // Strict RLS Check
            if (existing.user_id !== currentUserId) {
              // RLS silently updates 0 rows
              res.writeHead(200, { "Content-Type": "application/json" });
              res.end(JSON.stringify([]));
              return;
            }

            const patch = JSON.parse(body || "{}");
            const updated = {
              ...existing,
              ...patch,
              updated_at: new Date().toISOString(),
            };
            this.projects.set(targetId, updated);

            if (req.headers["accept"]?.includes("vnd.pgrst.object+json")) {
              res.writeHead(200, { "Content-Type": "application/json" });
              res.end(JSON.stringify(updated));
            } else {
              res.writeHead(200, { "Content-Type": "application/json" });
              res.end(JSON.stringify([updated]));
            }
            return;
          }

          // DELETE with RLS: auth.uid() = user_id
          if (req.method === "DELETE") {
            const idFilter = url.searchParams.get("id");
            if (idFilter && idFilter.startsWith("eq.")) {
              const targetId = idFilter.slice(3);
              const p = this.projects.get(targetId);
              if (p && p.user_id === currentUserId) {
                this.projects.delete(targetId);
              }
            }
            res.writeHead(204);
            res.end();
            return;
          }
        }

        // 3. PostgREST /rest/v1/profiles
        if (url.pathname === "/rest/v1/profiles") {
          if (!currentUserId) {
            res.writeHead(401, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ message: "permission denied for table profiles" }));
            return;
          }
          const profile = this.profiles.get(currentUserId) || { id: currentUserId, email: "", plan: "free" };
          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(JSON.stringify(profile));
          return;
        }

        // 4. RPC record_usage
        if (url.pathname === "/rest/v1/rpc/record_usage" && req.method === "POST") {
          if (!currentUserId) {
            res.writeHead(401, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ message: "not authenticated" }));
            return;
          }
          const payload = JSON.parse(body || "{}");
          const pages = payload.p_pages;
          if (!pages || pages < 1 || pages > 200) {
            res.writeHead(400, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ message: "invalid page count" }));
            return;
          }

          const today = new Date().toISOString().slice(0, 10);
          const key = `${currentUserId}_${today}`;
          const current = this.usage.get(key) || { id: key, user_id: currentUserId, pages_generated: 0, generation_date: today };
          current.pages_generated += pages;
          this.usage.set(key, current);

          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(JSON.stringify({}));
          return;
        }

        // 404 for unhandled route
        res.writeHead(404, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ message: `Route ${url.pathname} not found` }));

      } catch (err: any) {
        res.writeHead(500, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: err.message }));
      } finally {
        this.activeConnections--;
      }
    });
  }
}
