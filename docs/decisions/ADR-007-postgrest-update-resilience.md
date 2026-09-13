# ADR-007: PostgREST Update Resilience and RLS Grant Hardening

- **Status**: Accepted `[CURRENT]`
- **Date**: September 2026
- **Context**: During explicit cloud saves (<kbd>Ctrl</kbd>+<kbd>S</kbd>), updates to `public.projects` intermittently failed with an unhandled HTTP 406 Not Acceptable error. PostgREST's `.single()` modifier specifies an `Accept: application/vnd.pgrst.object+json` header, which demands that the database return exactly one object. When an update returned 0 rows—either due to a missing `FOR UPDATE` RLS policy or an ownership mismatch—PostgREST aborted the response with HTTP 406.
- **Decision**:
  1. Grant table-level `UPDATE` privilege on `public.projects` to the `authenticated` role and add an explicit `FOR UPDATE` RLS policy checking `auth.uid() = user_id` (applied in migration `20260911100500_grant_update_on_projects.sql`).
  2. Refactor all single-record mutations in `src/lib/projects.ts` from `.single()` to `.maybeSingle()`, pairing it with an explicit TypeScript null-check:
     ```typescript
     const { data, error } = await supabase
       .from("projects")
       .update(patch as unknown as never)
       .eq("id", id)
       .select("*")
       .maybeSingle();

     if (error) throw error;
     if (!data) {
       throw new Error("Project not found or update permission denied");
     }
     return normalise(data);
     ```
- **Reason**:
  - Eliminates brittle HTTP 406 crashes when database conditions return zero modified rows.
  - Ensures clear, catchable runtime exceptions that preserve the local IndexedDB draft rather than leaving the client in an indeterminate state.
- **Consequences**:
  - **Positive**: Resilient database synchronization and deterministic error recovery.
  - **Negative**: Requires one additional line of code (`if (!data)`) per single-row query.
