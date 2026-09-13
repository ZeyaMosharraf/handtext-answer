# ADR-005: Sparse Inheritance Model for Page-Specific Header and Footer Overrides

- **Status**: Proposed `[PROPOSED]`
- **Date**: September 2026
- **Context**: Real-world academic submissions frequently require differing furniture across pages. For example, Page 1 requires a full student registration banner (Name, Roll Number, Teacher Name), subsequent pages require only a compact title and page number, Page 3 might introduce a secondary experiment title, and the final page requires a signature block. The current system only supports coarse global scopes (`ApplyTo: "all" | "first" | "last"`), which cannot satisfy custom page-level requirements.
- **Decision**: Adopt a **Sparse Inheritance Override Model**:
  1. Maintain existing `settings.header` and `settings.footer` as the global document default.
  2. Introduce a sparse override dictionary in document settings:  
     `settings.pageOverrides?: Record<number, PageBandOverride>`
  3. A page override record only specifies differences (e.g., custom element values or disabled flags for that specific page index).
  4. During layout and rendering, `effectiveBand(pageNumber)` merges the global default with any sparse override present for that page.
- **Reason**:
  - **100% Backwards Compatible**: Existing projects lacking `pageOverrides` continue functioning with zero schema migration or data transformation.
  - **Storage Efficient**: Avoids duplicating 95% of identical band configuration across 20 pages in the JSONB settings column.
  - **User-Friendly**: If a user updates their Roll Number globally, all pages without explicit overrides automatically inherit the update.
- **Consequences**:
  - **Positive**: Complete academic flexibility for complex assignments with minimal data overhead.
  - **Negative**: The layout engine's pagination convergence loop must dynamically evaluate geometry per-page rather than caching uniform band heights.
