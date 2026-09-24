# Architecture Audit — HandText Load & Capacity

**Audit Date:** September 2026  
**Target:** HandText Production Architecture (v2.0)  
**Purpose:** Foundational architectural analysis prior to Phase 8 Concurrency, Capacity & Breaking-Point Testing.

---

## 1. High-Level Architectural Topology

```
[Browser Client]
  │
  ├── 1. Client-Side State & IndexedDB (Debounced Autosave — 3000ms)
  │      └── Database: "handtext-local" (Store: "drafts") [ZERO Network Traffic]
  │
  ├── 2. Direct HTTPS / TLS to Supabase PostgREST & GoTrue
  │      ├── Auth: https://<project-ref>.supabase.co/auth/v1/token (GoTrue)
  │      ├── Projects CRUD: https://<project-ref>.supabase.co/rest/v1/projects (PostgREST)
  │      ├── Profile & Usage: https://<project-ref>.supabase.co/rest/v1/profiles, usage
  │      └── RPC: https://<project-ref>.supabase.co/rest/v1/rpc/record_usage
  │
  └── 3. Static Assets & SSR via Cloudflare Workers (Nitro Engine)
         ├── SSR Route Guards (`src/routes/_authenticated/route.tsx`)
         └── Server Function: `improveAnswer` (TanStack Start Server Function -> Lovable AI Gateway)
```

---

## 2. Supabase Client & Authentication Layer

### 2.1 Client Initialization (`src/integrations/supabase/client.ts`)
- **Library:** `@supabase/supabase-js` v2
- **Key Handling:** Custom fetch wrapper `createSupabaseFetch` handles opaque publishable keys (`sb_publishable_...`).
- **Session Storage:** Custom brokered preview storage with fallback to localStorage / cookies (`persistSession: true, autoRefreshToken: true`).
- **Auth Flow:**
  - Login calls `supabase.auth.signInWithPassword({ email, password })`.
  - Route guard `src/routes/_authenticated/route.tsx` validates session via `supabase.auth.getUser()`. If invalid or unauthenticated, redirects to `/auth`.

---

## 3. Document Persistence & Save Flow

### 3.1 Two-Tier Persistence Strategy (`src/hooks/useProjectPersistence.ts`)

1. **Local Autosave (IndexedDB — Client Side Only):**
   - Every keystroke and format change updates React draft state and triggers an internal 3000ms debounce timer (`AUTOSAVE_DELAY_MS`).
   - On timer expiration, `performLocalSave()` writes the snapshot to browser IndexedDB (`saveLocalDraft`).
   - **Critical finding:** Keystrokes, paragraph edits, and local typing **do not generate HTTP/PostgREST traffic**. Typing load is 100% client-side memory and disk I/O.

2. **Cloud Save (Supabase PostgREST — Explicit Only):**
   - Cloud save is executed **only** upon:
     - User clicking the "Save" button
     - User pressing `Ctrl+S` / `Cmd+S`
     - Generating handwriting (`updateProject(id, { page_count, status: "generated" })`)
   - **Client-Side Equality Guard:**
     `isProjectSnapshotEqual(snapshotToPersist, lastCloudSavedSnapshotRef.current)` checks if content or settings actually changed. If identical, **no Supabase request is dispatched**.
   - **In-Flight Serialization:**
     `isCloudSavingRef` and `pendingCloudSaveRef` queue simultaneous saves in the same browser tab, ensuring only one PATCH request is active at a time per client.

### 3.2 Concurrency & Conflict Model
- **Mechanism:** Direct `UPDATE projects SET ... WHERE id = :id`.
- **Concurrency Control:** **Last-Write-Wins (LWW)** without optimistic concurrency checks (no version counter or conditional `updated_at` check).
- **Multi-Tab Behavior:** If the same user opens Tab A and Tab B, Tab B saving will overwrite Tab A's cloud state without conflict notification. On reload, Tab A restores its local IndexedDB draft if newer than cloud `updated_at`.

---

## 4. Database Schema & RLS Policies (`supabase/migrations/`)

### 4.1 Tables & Indices

| Table | Primary Key | Key Columns | Indexes | RLS Policies |
| :--- | :--- | :--- | :--- | :--- |
| `projects` | `id (UUID)` | `user_id`, `name`, `question`, `content`, `settings (JSONB)`, `page_count`, `status`, `updated_at` | `projects_user_updated_idx (user_id, updated_at DESC)` | `auth.uid() = user_id` for SELECT, INSERT, UPDATE, DELETE |
| `profiles` | `id (UUID)` | `email`, `full_name`, `avatar_url`, `plan`, `updated_at` | Primary Key | `auth.uid() = id` for SELECT; UPDATE restricted to user fields (plan protected by trigger) |
| `usage` | `id (UUID)` | `user_id`, `pages_generated`, `generation_date` | `usage_user_date_unique (user_id, generation_date)` | `auth.uid() = user_id` for SELECT; direct INSERT/UPDATE/DELETE revoked for clients |

### 4.2 Database Triggers & Functions
- `projects_updated_at`: `BEFORE UPDATE ON public.projects` sets `NEW.updated_at = now()`.
- `protect_plan_column`: `BEFORE UPDATE ON public.profiles` prevents clients from escalating their `plan`.
- `record_usage(p_pages integer)`: `SECURITY DEFINER` function with atomic `ON CONFLICT (user_id, generation_date) DO UPDATE SET pages_generated = pages_generated + EXCLUDED.pages_generated`.

---

## 5. Potential Bottleneck Analysis

1. **PostgREST Connection Pool & Supabase Compute:**
   - Because clients connect directly to Supabase PostgREST, connection poolers (PgBouncer/Supavisor) and Postgres transaction limits will experience direct load spikes during high concurrent cloud saves or user dashboard loads.
2. **GoTrue Auth Rate Limiting:**
   - Supabase GoTrue enforces rate limits on token issuance and email verification (`email rate limit exceeded` / HTTP 429).
3. **Large JSONB / Content Payloads:**
   - A heavy project contains HTML markup, math formulas, graph specifications, and full `settings` JSONB. Transferring 50KB–500KB per project write across hundreds of concurrent sessions will stress network egress and Postgres buffer pools.
4. **Cloudflare Worker SSR:**
   - Initial page loads (`/_authenticated/editor/$projectId`) trigger SSR with `supabase.auth.getUser()` and project queries before hydrating client-side.
