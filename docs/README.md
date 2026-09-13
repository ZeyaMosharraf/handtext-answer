# HandText System Documentation

Welcome to the central technical documentation repository for **HandText**.

This documentation serves as the canonical source of truth for software architecture, domain concepts, persistence models, rendering pipelines, database schemas, and engineering decisions. It is designed to provide full context for human engineers and AI development sessions (including GSD workflows).

---

## Documentation Map

| Document | Purpose & Core Content |
| :--- | :--- |
| [`PROJECT_CONTEXT.md`](./PROJECT_CONTEXT.md) | **Primary Context Anchor**. Comprehensive 26-point briefing on the entire project state, architecture, constraints, known issues, and rules for developers/AI agents. |
| [`PROJECT_OVERVIEW.md`](./PROJECT_OVERVIEW.md) | High-level product summary, user personas, core customer journeys, brand identity, and design aesthetics. |
| [`BUSINESS_PROBLEM.md`](./BUSINESS_PROBLEM.md) | The real-world problem HandText solves, comparison against generic fonts and AI image generators, and product differentiation. |
| [`ARCHITECTURE.md`](./ARCHITECTURE.md) | End-to-end technical architecture, component relationships, state flow, and system-level Mermaid diagrams. |
| [`DATA_AND_PERSISTENCE.md`](./DATA_AND_PERSISTENCE.md) | Local-first persistence via IndexedDB, explicit cloud sync via Supabase, dirty-checking, and the CURRENT vs. FUTURE document storage model. |
| [`EDITOR_WORKSPACE.md`](./EDITOR_WORKSPACE.md) | The 3-column workstation UX (Content, Preview, Design), viewport scrolling mechanics, FloatingFormatBubble, and toolbar architecture. |
| [`DATABASE.md`](./DATABASE.md) | Supabase PostgreSQL schema, migrations, RLS policies, ownership models, triggers, functions, and permission grants. |
| [`AUTHENTICATION.md`](./AUTHENTICATION.md) | Supabase Auth integration, route guards, email/password, Google OAuth, password reset/recovery, and localhost dev bypass guardrails. |
| [`HANDWRITING_RENDERING.md`](./HANDWRITING_RENDERING.md) | The complete text-to-canvas rendering engine: stack-based HTML parser, ruling lattice layout, multi-pass pagination, human variation algorithms, and PDF/PNG export. |
| [`CHANGELOG.md`](./CHANGELOG.md) | Chronological development record based on actual Git commits and implementation milestones. |
| [`decisions/`](./decisions/) | Architecture Decision Records (ADRs) documenting critical choices, alternatives considered, and consequences. |

---

## Architectural Taxonomy: Understanding States

When reading or updating any document in this folder, technical statements are categorized into three explicit states:

1. **`[CURRENT]`**: Code, schemas, and behaviors currently active in the codebase and verified in production/development.
2. **`[PROPOSED]`**: Architectures and designs that have been researched, discussed, and accepted in phase discussions, but not yet implemented in code.
3. **`[FUTURE]`**: Long-term backlog, exploratory ideas, or post-MVP milestones.

> [!IMPORTANT]
> Never mix `[CURRENT]` and `[PROPOSED]` architectures without clear demarcation. Do not claim an architecture has been implemented until the code and migrations are committed and verified.

---

## Guidelines for Developers and AI Agents

1. **Read `PROJECT_CONTEXT.md` First**: Before implementing features, diagnosing bugs, or drafting plans, read `PROJECT_CONTEXT.md` to internalize existing architectural constraints.
2. **Preserve Persistence Guardrails**:
   - Keystrokes & formatting **must always** autosave to IndexedDB (`handtext-local`).
   - Network requests to Supabase **must never** occur during typing or formatting.
   - Cloud saves **must always** be explicit (<kbd>Ctrl</kbd>+<kbd>S</kbd> or Save button).
   - Failed cloud saves **must never** discard or overwrite local drafts.
3. **Preserve the Ruling Lattice**: Handwriting text baselines are geometrically locked to paper rule intervals. Do not introduce arbitrary pixel offsets that break notebook alignment.
4. **Update Docs on Architecture Changes**: If an implementation alters database schemas, UI structures, or rendering math, update the corresponding markdown file and append an entry to `CHANGELOG.md` or a new ADR in `decisions/`.
