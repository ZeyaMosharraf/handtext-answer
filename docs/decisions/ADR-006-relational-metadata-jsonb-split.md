# ADR-006: Relational Metadata vs. Unified JSONB Document Storage Model

- **Status**: Proposed `[PROPOSED]`
- **Date**: September 2026
- **Context**: The active schema stores projects relationally: `id`, `user_id`, `name`, `question`, `content` (raw HTML string), `settings` (JSONB), `page_count`, and `status`. As the platform matures to support page-specific overrides, structural metadata, and versioning, storing content and settings in separated columns requires multi-field synchronization and complicates atomic document snapshots.
- **Decision**: Evaluate migrating toward a **Hybrid Relational-Document Model**:
  - **Relational Metadata Columns**: Kept as top-level indexed SQL columns for fast dashboard listings, sorting, and user-level querying:  
    `id`, `user_id`, `name`, `status`, `page_count`, `created_at`, `updated_at`.
  - **Unified Document Column (`doc JSONB`)**: Consolidates document internals into a single versioned object:
    ```json
    {
      "schemaVersion": 1,
      "metadata": {
        "assignmentMode": true,
        "question": "..."
      },
      "settings": { ... },
      "content": {
        "format": "html",
        "raw": "..."
      }
    }
    ```
- **Reason**:
  - Unifies local IndexedDB snapshots (`ProjectSnapshot`) with the remote database representation.
  - Enables effortless versioning and document-level import/export as a single JSON file.
- **Consequences**:
  - **Positive**: Clean encapsulation, simplified snapshotting, and atomic updates.
  - **Negative**: Requires writing and validating a database migration script to backfill existing project rows.
  - **Current Implementation State**: This proposal has been researched and accepted in architectural reviews, but has **NOT** been applied to the live database or codebase. The live system remains on the `[CURRENT]` relational table structure documented in `docs/DATABASE.md`.
