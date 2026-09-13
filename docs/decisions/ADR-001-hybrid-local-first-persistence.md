# ADR-001: Hybrid Local-First Persistence Architecture

- **Status**: Accepted `[CURRENT]`
- **Date**: September 2026
- **Context**: Students author long-form academic answers (often 2,000–5,000 words) in campus environments with intermittent network connectivity. Previously, systems attempting to synchronize state on every keystroke to Supabase encountered PostgREST connection throttling, rate limits, and catastrophic data loss if a network drop coincided with an autosave cycle.
- **Decision**: Decouple real-time draft saving from remote cloud persistence by establishing a **Local-First Hybrid Model**:
  1. All typing, formatting, and settings changes autosave locally to browser IndexedDB (`handtext-local`, store `drafts`) debounced by 1000ms.
  2. Cloud persistence to Supabase PostgreSQL is reserved exclusively for explicit checkpoints (<kbd>Ctrl</kbd>+<kbd>S</kbd>, clicking "Save", or generating pages).
  3. When loading an editor project, if an unsynced local draft exists with a newer timestamp than the cloud record, the local draft is automatically restored.
  4. If a cloud save fails, the local draft is preserved intact with `isSynced: false`.
- **Reason**:
  - Eliminates network latency from the typing loop (0ms write latency).
  - Eliminates Supabase API rate-limiting and connection pool exhaustion.
  - Guarantees zero data loss across tab closures, battery exhaustion, or offline library sessions.
- **Consequences**:
  - **Positive**: Exceptional typing responsiveness, offline authoring resilience, and drastic reduction in Supabase database load.
  - **Negative**: Unsaved changes on one device will not immediately appear on another device until the user explicitly hits Save.
