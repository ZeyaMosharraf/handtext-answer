# HandText — Project Changelog

> **Chronological Development History & Milestone Log**  
> *Target Audience:* Core Engineers, Product Managers, AI Development Workflows  
> *Last Updated:* September 2026  
> *Document Status:* Active & Canonical

All notable changes to the HandText project are documented here, ordered chronologically and verified against the Git commit history and implementation records.

---

## [Unreleased / Current Session] — September 2026

### Added
- **Central System Documentation Repository (`docs/`)**:
  - Authored canonical documentation system including `PROJECT_CONTEXT.md` (26-point master anchor), `PROJECT_OVERVIEW.md`, `BUSINESS_PROBLEM.md`, `ARCHITECTURE.md`, `DATA_AND_PERSISTENCE.md`, `EDITOR_WORKSPACE.md`, `DATABASE.md`, `AUTHENTICATION.md`, `HANDWRITING_RENDERING.md`, and Architecture Decision Records (ADRs).
- **Authentication Password Recovery Flow**:
  - Added "Forgot password?" modal state to `/auth`.
  - Implemented password reset email dispatch via `supabase.auth.resetPasswordForEmail()`.
  - Intercepted recovery tokens (`type=recovery`) to present password update UI with confirmation validation.
- **Supabase Cloud Save Hardening**:
  - Granted `UPDATE` privilege on `public.projects` to `authenticated` role.
  - Added `Users can update own projects` RLS policy (`USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id)`).
  - Migrated `src/lib/projects.ts` update query from `.single()` to `.maybeSingle()` with explicit null checking to eliminate HTTP 406 Not Acceptable crashes.

---

## Commit `7452411` — Major Editor & Workspace Overhaul

### Added
- **Rich Text Selection Formatting**:
  - Implemented per-word Bold, Italic, Underline, and Font Scaling (0.85x, 1.0x, 1.2x, 1.4x).
  - Added Student Ink palette (Classic Blue, Dark Blue, Royal, Black, Dark Black, Red, Green).
  - Added soft fluorescent highlighter washes (5 colors) rendered behind text glyphs.
- **Content Model & Parser**:
  - Implemented stack-based `parseInlineHtml()` in `src/lib/handwriting/parse.ts` supporting nested DOM styling.
  - Added recursive container `div` parsing and `Seg.scale` normalization.
  - Added explicit `<br>` newline handling.
- **Three-Column Fixed-Viewport Workstation**:
  - Structured desktop layout into Content Editor (`flex-1`), Live Page Preview (`520px`), and Design Inspector (`380px`).
  - Added independent vertical scrolling across all three columns with zero outer window expansion (`h-screen overflow-hidden`).
- **Editor Controls**:
  - Added sticky pinned `EditorToolbar.tsx`.
  - Created ultra-compact `FloatingFormatBubble.tsx` dynamically positioned over active selections.
  - Added inline table insertion popover.
- **Viewer & Result Screen**:
  - Added keyboard navigation (<kbd>ArrowLeft</kbd>, <kbd>ArrowRight</kbd>, <kbd>Home</kbd>, <kbd>End</kbd>).
  - Added thumbnail carousel auto-scrolling and download notification toasts.
  - Added monthly page usage allowance display.
- **Persistence & Reliability**:
  - Upgraded IndexedDB schema version to `DB_VERSION = 2` to resolve schema version collisions.
  - Hardened draft restoration lifecycle against older cloud timestamps.

---

## Commit `5acc853` — Database Permission & RLS Fix

### Fixed
- Applied SQL migration granting `UPDATE` on `public.projects` to authenticated users with row-level ownership validation.

---

## Commit `534339a` — Local-First IndexedDB Autosave

### Added
- Created `src/lib/local-drafts.ts` encapsulating browser IndexedDB store `drafts` in database `handtext-local`.
- Persisted full `ProjectSnapshot` objects with user and project keying.
- Decoupled real-time typing from remote database network calls.

---

## Commit `c98b67d` — Persistence Performance & Dirty Checking

### Performance
- Introduced deep snapshot comparison (`isProjectSnapshotEqual`) to bypass redundant cloud PATCH requests when document content is identical to last confirmed cloud state.

---

## Commit `308621c` — Brand Identity Refresh

### Chore
- Renamed application brand to **HandText**.
- Updated application icons, favicons, and metadata.

---

## Commit `2339a0c` — Handwriting Personality Expansion

### Added
- Added **Natural Notes** preset to `HANDWRITING_STYLES` (`Indie Flower`, relaxed spacing, casual student aesthetic).

---

## Commit `5c32e1f` — Ink Propagation & Alignment

### Fixed
- Resolved black ink preview propagation issue where emphasis colors leaked across adjacent lines.
- Fixed writing-on-page pointer tracking alignment.

---

## Commit `5202bff` — Rich-Text Semantics

### Added
- Upgraded editor from raw markdown symbols (`**`, `__`) to clean WYSIWYG rich-text DOM semantics.

---

## Commit `14d447c` — Physical Page Template System

### Added
- Centralized stationery template definitions in `src/lib/handwriting/templates.ts` supporting academic registers, Cornell notes, and exam answer sheets.

---

## Commit `8423840` — Physical Ruled Layout Engine

### Added
- Established the Master Ruling Lattice in `src/lib/handwriting/layout.ts`, locking text baselines to printed paper lines.

---

## Commit `af58b0e` — Band Boundary Isolation

### Fixed
- Enforced hard clipping and height quantization on header and footer bands to prevent content overlap.

---

## Commit `a3b2692` — Dashboard Query Lifecycle

### Fixed
- Deferred project list query execution until user session authentication state is confirmed.

---

## Commit `1850b74` — OAuth Callback Routing

### Fixed
- Routed Google OAuth redirect callbacks cleanly through `/auth` to finalize session hydration before navigating to dashboard.

---

## Commit `2fa59f3` — Supabase Client Consolidation

### Refactor
- Consolidated duplicate Supabase client configurations and environment variable lookups into `@/integrations/supabase/client`.
