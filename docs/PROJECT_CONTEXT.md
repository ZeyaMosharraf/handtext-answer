# HandText — Master Project Context

> **Authoritative Technical Anchor & System Context**  
> *Target Audience:* Human Core Engineers & AI Systems (including GSD Development Workflows)  
> *Last Updated:* September 2026  
> *Document Status:* Active & Canonical

---

## 1. What HandText Is

**HandText** is an intelligent web-based document workstation that transforms digital typed text and academic assignments into indistinguishable, authentic handwritten physical pages. Unlike naive handwriting fonts or generic vector renderers that simply substitute SVG glyphs on a flat plane, HandText simulates the physical physics of real student handwriting on ruled paper: ink absorption, micro-jitter, dynamic slant variation, human stroke imperfections, pen pressure dynamics, baseline alignment to paper rules, and page furniture (academic headers, roll numbers, assignment stamps, and footers).

The platform serves students, educators, and professionals who need to convert digital notes, assignment solutions, or formal written submissions into clean, physical-looking handwritten documents exported as multi-page PDF documents or high-resolution PNG image bundles.

---

## 2. The Business Problem

Educational institutions worldwide, particularly in STEM and university coursework across India and Southeast Asia, routinely mandate handwritten homework, laboratory journals, and assignment submissions. The stated intent is to deter copy-pasting, encourage manual retention, and verify student engagement.

However, this requirement produces massive real-world frictions:
- **Repetitive Strain & Time Loss**: Students spend 15–20 hours weekly hand-copying typed technical solutions, code printouts, or textbook theory onto ruled sheets simply to satisfy compliance formatting.
- **Inaccessibility of AI/Digital Tools**: While students draft solutions using modern IDEs, Markdown, LaTeX, and AI tutors, they are forced to manually transcribe digital drafts by hand with a ballpoint pen.
- **Failures of Existing Workarounds**:
  - *Standard "Handwriting" Fonts* (e.g., standard Google Fonts in Word): Produce identical glyph repetitions across lines. Every "e" and "t" is mathematically identical; letters float across lines without snapping to notebook rulings. Instructors instantly recognize this as fake.
  - *AI Diffusion Image Generators* (Midjourney, DALL-E): Cannot render long-form legible English text, hallucinate illegible glyphs, fail basic academic pagination, and cannot be edited per-word or exported as structured PDFs.

HandText solves this by providing a dedicated editor, a deterministic ruled-paper layout engine, and an authentic multi-pass canvas handwriting renderer that reproduces natural human variations.

---

## 3. Product Goals

1. **Photorealistic Human Handwriting**: Ensure generated pages pass visual inspection as authentic human work written with fountain pens, gel pens, or ballpoints on real student stationery.
2. **Deterministic Document Layout**: Ensure text baselines strictly respect notebook line rulings, margin rules, and academic header/footer bands across all supported page sizes (A4, A5, Letter, Legal).
3. **Frictionless Editing & Zero Data Loss**: Guarantee that students typing thousands of words never lose drafts due to network drops, accidental tab closures, or rate limits.
4. **Rich Academic Formatting**: Support bold emphasis, hand-drawn underlines, student ink color switching, highlighter washes, and custom academic tables without sacrificing the handwritten aesthetic.
5. **Instant Live Preview**: Provide sub-second visual feedback in a dedicated side-by-side workstation so users immediately see how their text flows onto ruled sheets.
6. **Production-Grade Export**: Output multi-page vector-accurate PDFs and 300-DPI PNG zip bundles formatted precisely for A4 printing or LMS digital submission.

---

## 4. Current Product Capabilities `[CURRENT]`

- **Physical Stationery Emulation**:
  - 10 Paper Styles: Plain white, Blue ruled, Double line ruled, Narrow ruled, Grid paper, Fine graph paper, Dotted journal, Exam answer sheet, Cornell notes, Bordered project page.
  - Paper textures (off, low, medium, high) and paper tones (White, Off-white, Cream, Light yellow, Notebook white, Aged paper).
  - Margin rules: Customizable red/deep-red/grey/blue margin rules with adjustable left offsets.
- **Handwriting Personalities**:
  - Preset handwriting styles: Neat Student, Fast Exam Writing, Casual Notes, Exam Style, Natural Notes, and Custom.
  - Granular physics parameters: Slant (-10° to +15°), Baseline variation (0–5px), Character variation (0–100%), Slant variation (0–8°), Imperfection (0–100%), Writing speed (0–100%), Pen pressure (0–100%), Pen width (0.5–4.0px), Compactness (0.85–1.1x).
- **Ink Palette**:
  - 7 Presets: Classic Blue (#1d3fb5), Dark Blue (#12235e), Royal Blue (#174ea6), Black (#141821), Dark Black (#000000), Red (#b3231f), Green (#146b3a), plus Custom Hex color picker.
- **Rich Text Formatting Engine**:
  - Per-word / selection formatting: Bold, Italic, Underline, Scale (0.85x, 1.0x, 1.2x, 1.4x), Student Ink (6 colors), and Fluorescent Highlighter Washes (5 colors).
  - Pinned top EditorToolbar, ultra-compact FloatingFormatBubble over highlighted text selections, and inline table insertion popover.
- **Academic Header & Footer Furniture**:
  - Dedicated band regions with border rules.
  - Multi-slot layout (left, center, right across rows) for student metadata: Student Name, Enrollment No, Roll No, Subject, Course Code, College, Teacher Name, Assignment Title, Date, Signature, and Dynamic Page Numbers (`Page n`, `n / total`, etc.).
  - Global scope rules: `all`, `first`, `last`.
- **Three-Column Workstation UX**:
  - Fixed-viewport 100vh workstation (`lg:grid-cols-[minmax(0,1fr)_520px_380px]`).
  - Independent scroll containers for Content Editor, Live Preview Canvas, and Design Inspector.
  - "Write directly on page" mode with interactive red ruled-line tracking guide.
- **Local-First Persistence**:
  - Keystrokes debounced to browser IndexedDB (`handtext-local`). Zero network traffic during editing.
  - Explicit Save (<kbd>Ctrl</kbd>+<kbd>S</kbd>) to Supabase PostgreSQL with dirty-checking snapshot comparison.
- **Generation & Export**:
  - Live multi-page rendering engine with progress bar.
  - Result screen with thumbnail carousel, keyboard navigation (<kbd>←</kbd>/<kbd>→</kbd>), and single-click downloads (PDF via jsPDF, individual PNGs, or ZIP bundle via JSZip).

---

## 5. Current Technical Architecture `[CURRENT]`

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           CLIENT BROWSER (Vite SPA)                         │
│                                                                             │
│  ┌──────────────────────┐  ┌──────────────────────┐  ┌──────────────────┐  │
│  │     Route Layer      │  │   EditorWorkspace    │  │  State & Hooks   │  │
│  │  TanStack Router     │  │  (3-Column Layout)   │  │  TanStack Query  │  │
│  └──────────┬───────────┘  └──────────┬───────────┘  └────────┬─────────┘  │
│             │                         │                       │            │
│             ▼                         ▼                       │            │
│  ┌──────────────────────┐  ┌──────────────────────┐           │            │
│  │  RichContentEditor   │  │  PagePreviewCanvas   │           │            │
│  │ (ContentEditable/DOM)│  │ (HTML5 2D Canvas)    │           │            │
│  └──────────┬───────────┘  └──────────▲───────────┘           │            │
│             │ HTML                    │ Placements            │            │
│             ▼                         │                       │            │
│  ┌────────────────────────────────────┴───────────────────┐   │            │
│  │               Handwriting Pipeline Engine              │   │            │
│  │   1. parseHtmlContent() → Block[] + Seg[]              │   │            │
│  │   2. layoutDocument()   → Multi-pass Ruling Lattice    │   │            │
│  │   3. renderPages()      → Canvas 2D Stroke Synthesis   │   │            │
│  └────────────────────────────────────────────────────────┘   │            │
│             │                                                 │            │
│             ▼                                                 ▼            │
│  ┌──────────────────────┐                       ┌───────────────────────┐  │
│  │ IndexedDB Persistence│                       │ Supabase JS Client    │  │
│  │   (handtext-local)   │                       │ (Explicit Save Only)  │  │
│  └──────────────────────┘                       └───────────┬───────────┘  │
└─────────────────────────────────────────────────────────────┼───────────────┘
                                                              │ HTTPS / WSS
                                                              ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                      SUPABASE CLOUD INFRASTRUCTURE                          │
│                                                                             │
│  ┌──────────────────────┐  ┌──────────────────────┐  ┌──────────────────┐  │
│  │    Supabase Auth     │  │  PostgreSQL Database │  │  Security / RLS  │  │
│  │ Email, Google OAuth, │  │   profiles, projects,│  │ auth.uid() = id, │  │
│  │ Password Recovery    │  │   usage              │  │ server RPCs      │  │
│  └──────────────────────┘  └──────────────────────┘  └──────────────────┘  │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 6. Frontend Architecture

- **Bundler & Build Tool**: Vite 5 with React plugin.
- **Language**: TypeScript with strict typing.
- **Routing**: `@tanstack/react-router` using file-based route definitions in `src/routes/`.
  - Root route `__root.tsx`: Top-level query client, theme provider, and toast system.
  - Public routes: `/` (Landing page), `/auth` (Sign in, Sign up, Forgot password, Reset callback).
  - Authenticated layout `_authenticated/route.tsx`: Route guard enforcing active user session.
  - Authenticated children: `dashboard.tsx` (Project list, stats, new project modal), `editor.$projectId.tsx` (Project editor loader), `settings.tsx` (Profile & preferences).
- **Server State & Data Fetching**: `@tanstack/react-query` for cached queries (`projects`, `usage`, `profile`) and mutations.
- **Styling**: Tailwind CSS with CSS variables for dynamic theme tokens. Radix UI primitives for accessible popovers, dropdowns, dialogs, and tooltips. Lucide React for iconography.

---

## 7. Editor Architecture

The editor layer manages raw user input, formatting commands, selection state, and DOM-to-model transformations:

1. **`RichContentEditor.tsx`**:
   - Built on a semantic `contenteditable` container.
   - Rejects raw HTML pasting; sanitizes and normalizes incoming clipboard data.
   - Exposes imperative methods via `RichContentEditorHandle`: `formatSelection(command, value)`, `insertTable(rows, cols)`, `getHtml()`, `setHtml()`, `focus()`.
   - Tracks cursor and selection changes via `selectionchange` listeners to emit active `FormatState` (bold, italic, underline, color, scale, highlight).
2. **`EditorToolbar.tsx`**:
   - Pinned sticky bar directly above the editor container.
   - Contains high-frequency controls: Heading toggles (H1, H2), Lists (bullet, numbered), Blockquote, Table insertion popover, Clear formatting.
3. **`FloatingFormatBubble.tsx`**:
   - Contextual floating menu that appears directly above selected text ranges.
   - Ultra-compact, low-profile design (32px icon buttons) preventing visual intrusion.
   - Houses character-level formatting: Bold, Italic, Underline, Scale dropdown (85%, 100%, 120%, 140%), Student Ink popover, and Highlighter popover.
4. **`DesignPanel.tsx`**:
   - Right-hand inspector allowing instant tweaking of paper style, paper background, margin line, ink color, handwriting personality, and header/footer configurations.

---

## 8. Document / Content Model `[CURRENT]`

Content in HandText exists in three distinct representations across the pipeline:

### A. Raw Content Storage Representation
In local IndexedDB and the remote Supabase `projects.content` column, the document is stored as clean semantic HTML:
```html
<h1>Experiment 4: Kirchoff's Voltage Law</h1>
<p>In this lab, we verified that the algebraic sum of voltages in a closed loop equals zero.</p>
<p>We used a <span data-color="#141821" style="color: #141821;"><strong>standard multimeter</strong></span> and <mark style="background-color: #fef08a;">1kΩ resistors</mark>.</p>
```

### B. Intermediate Parsed Block Model
`parseHtmlContent()` breaks the HTML string down into structural blocks:
```typescript
interface Block {
  kind: "heading" | "subheading" | "bullet" | "numbered" | "paragraph" | "quote" | "divider" | "table" | "blank";
  text: string;
  segs?: Seg[];
  marker?: string;       // e.g., "1.", "•"
  table?: TableData;     // { rows: string[][], headerRow: boolean }
}
```

### C. Inline Segment Model (`Seg`)
Within each block, text is partitioned into runs of identical styling:
```typescript
interface Seg {
  text: string;
  bold: boolean;
  underline: boolean;
  italic?: boolean;
  color?: string;        // Hex ink color
  scale?: number;        // Normalized: 0.85, 1.0, 1.2, or 1.4
  highlight?: string;    // Hex color for highlighter wash (e.g., #fef08a)
}
```

---

## 9. Rich-Text Formatting Pipeline `[CURRENT]`

```
User selects text in RichContentEditor
  │
  ▼
FloatingFormatBubble / Toolbar triggers document.execCommand() or DOM Range wrapping
  │ (wraps selection in <strong>, <em>, <u>, or <span data-scale="..." data-color="..." data-highlight="...">)
  │
  ▼
onChange fires with updated HTML string
  │
  ▼
parseHtmlContent() executes:
  ├─ Top-level regex extracts block-level tags (<p>, <h1>, <h2>, <ul>, <ol>, <blockquote>, <table>, <hr>)
  ├─ innerHtml passed to parseInlineHtml()
  ├─ Stack-based tag tokenizer tracks nested styling frames
  ├─ Normalizes scale via normalizeFontScale() (<=0.92 → 0.85, <=1.1 → 1.0, <=1.3 → 1.2, >1.3 → 1.4)
  ├─ Resolves RGB strings to Hex values
  └─ Contiguous segments with identical styling are merged
  │
  ▼
Structured Block[] with normalized Seg[] arrays ready for layout
```

---

## 10. Layout and Pagination Pipeline `[CURRENT]`

The layout engine in `src/lib/handwriting/layout.ts` translates abstract `Block[]` into exact, physical page coordinates:

1. **Master Ruling Lattice Calculation**:
   - The ruling spacing is strictly derived from font size and line spacing:  
     $$\text{rulingSpacing} = \text{settings.fontSize} \times \text{settings.lineSpacing}$$
   - When a header band is active, its physical height is quantized to integer multiples of `rulingSpacing`. Writing starts strictly on the first ruled line below the header boundary:  
     $$\text{firstBaselineY} = \text{headerHeight} + \text{rulingSpacing}$$
   - Baseline for line index $i$:  
     $$\text{baseline} = \text{firstBaselineY} + i \times \text{rulingSpacing}$$
   - This ensures handwriting baselines are geometrically locked to the paper's printed rules.
2. **Per-Segment Tokenization & Word Wrapping**:
   - Segments are tokenized by whitespace.
   - Text width is measured via `CanvasRenderingContext2D.measureText()` combined with `compactness`, `letterSpacing`, and individual `Seg.scale`.
   - Lines that exceed `maxWidth` (page width minus margins) wrap to new lines.
3. **Table Formatting**:
   - Table rows are measured and assigned line units.
   - If a table row crosses the page bottom boundary, it is cleanly broken to the next page.
   - If `settings.table.repeatHeader` is true, table headers automatically repeat on subsequent pages.
4. **Multi-Pass Convergence Loop**:
   - Headers and footers often contain dynamic total page counts (e.g., "Page 1 of 5") or conditional rules (`ApplyTo: "last"`).
   - `layoutDocument()` executes up to 3 iterative passes until total page count stabilizes.

---

## 11. Handwriting Rendering Pipeline `[CURRENT]`

The rendering engine in `src/lib/handwriting/renderer.ts` takes the layout output and draws it onto an HTML5 Canvas:

1. **Stationery & Paper Layer**:
   - Renders paper background color and procedural paper grain texture.
   - Draws vertical margin rule at `settings.page.margin.position`.
   - Draws horizontal rulings (ruled, double, narrow, grid, graph, dotted) perfectly synchronized with the coordinate system.
2. **Header & Footer Bands**:
   - Renders metadata elements into designated slots (left, center, right) across rows.
   - Formats dynamic page numbers (`Page n`, `n / total`, etc.).
   - Renders optional border dividers.
3. **Highlighter Wash Layer**:
   - Renders **behind** text characters.
   - Uses semi-translucent fill (`globalAlpha = 0.34`) with soft rounded corners (`ctx.roundRect`) and slight natural edge jitter.
4. **Natural Human Stroke Synthesis**:
   - For every individual character in a segment:
     - **Pseudorandom Number Generator (PRNG)**: Seeded by character position and content to ensure deterministic re-renders.
     - **Baseline Jitter**: Sub-pixel vertical jitter ($(\text{rnd} - 0.5) \times \text{baselineVariation}$).
     - **Slant & Rotation**: Applies skew transform incorporating user slant, italic slant (+12°), slant variation jitter, and subtle character rotation ($(\text{rnd} - 0.5) \times 0.012 \times \text{imperfection} \times 6$).
     - **Stroke Pressure & Weight**: Modulates stroke width via `penWidth`, `pressure`, segment boldness, and speed compression.
     - **Double-Pass Ink Simulation**: Executes both `ctx.strokeText()` (with round line joins) and `ctx.fillText()` to simulate fountain and gel pen ink dispersion into paper fibers.
     - **Horizontal Advance**: Tracks character width modulated by compactness and writing speed.
5. **Hand-Drawn Underlines**:
   - Generates authentic Bezier curves under underlined segments with randomized start, middle, and end control point offsets.
6. **Export Output**:
   - Export canvases are generated at full print resolution (1240 × 1754 for A4 @ 150 DPI / 2480 × 3508 for high-res print).
   - Generates vector-accurate PDFs using `jsPDF` or packaged PNG zip files via `JSZip`.

---

## 12. Local IndexedDB Persistence `[CURRENT]`

To guarantee zero data loss and eliminate server strain, editing state is governed by a **Local-First Autosave Architecture**:

- **Database Name**: `handtext-local`
- **Object Store**: `drafts` (key: `handtext:draft:${userId}:${projectId}`)
- **DB Version**: `2` (handles schema upgrades cleanly)
- **Lifecycle Rules**:
  1. **Typing & Formatting**: Debounced by 1000ms to browser IndexedDB via `saveLocalDraft()`.
  2. **Zero Keystroke Network Requests**: Keystrokes **never** invoke Supabase API calls.
  3. **Local Draft Restoration**: When opening an editor project, `EditorWorkspace` queries IndexedDB. If an unsynced local draft exists with `savedAt > cloudUpdatedAt`, it is restored automatically with a toast notification: *"Restored your local draft"*.
  4. **Fault Resilience**: If a network failure occurs during cloud saving, the local draft remains intact with `isSynced: false`.

---

## 13. Supabase Cloud Persistence `[CURRENT]`

Cloud synchronization represents an **explicit checkpoint**:

- **Trigger Mechanisms**:
  - User clicks the **Save** button in the header.
  - User presses <kbd>Ctrl</kbd>+<kbd>S</kbd> or <kbd>Cmd</kbd>+<kbd>S</kbd>.
  - Project generation completes.
- **Dirty-Checking Guard**:
  - Before making an HTTP request, `currentDraftRef` is deep-compared against `lastCloudSavedSnapshotRef`. If identical, the network request is bypassed.
- **Concurrency Guard**:
  - `isCloudSavingRef` prevents duplicate simultaneous PATCH requests. If a save is requested while a save is in-flight, `pendingCloudSaveRef` flags a subsequent run.
- **PostgREST Query Resilience**:
  - Uses `.maybeSingle()` instead of `.single()` to avoid HTTP 406 Not Acceptable status code crashes when row updates return empty or altered record sets.

---

## 14. Authentication Architecture `[CURRENT]`

- **Provider**: Supabase Auth (GoTrue).
- **Supported Methods**:
  1. **Email & Password**: Direct signup and signin.
  2. **Google OAuth**: Redirects through Supabase callback to `/auth`.
  3. **Password Reset / Recovery**: Full recovery flow via `supabase.auth.resetPasswordForEmail()` with `redirectTo: /auth?type=recovery`. Supports password change screen when active session has `recovery` type.
- **Route Guards**:
  - TanStack Router `_authenticated/route.tsx` validates session via `supabase.auth.getUser()`. Unauthenticated requests redirect to `/auth`.

---

## 15. Database Architecture `[CURRENT]`

The backend database is managed via Supabase PostgreSQL:

- **Tables**:
  - `public.profiles`: Stores user metadata and default preferences.
  - `public.projects`: Stores project metadata, document content, and handwriting settings.
  - `public.usage`: Tracks page generation allowances per user per calendar date.
- **Functions & Triggers**:
  - `handle_new_user()`: Triggered on `auth.users` insert to populate `public.profiles`.
  - `set_updated_at()`: Triggered before update on `profiles` and `projects`.
  - `protect_plan_column()`: Security definer trigger preventing clients from updating `profiles.plan`.
  - `record_usage(p_pages integer)`: Security definer RPC that safely increments `public.usage.pages_generated`.

---

## 16. RLS and Security Model `[CURRENT]`

- **Row Level Security (RLS)** is enabled on all tables:
  - `profiles`: `auth.uid() = id` (SELECT). Column-level UPDATE grant excludes `plan`.
  - `projects`: `auth.uid() = user_id` (SELECT, INSERT, UPDATE, DELETE).
  - `usage`: `auth.uid() = user_id` (SELECT only). Client INSERT/UPDATE/DELETE revoked. All usage mutations occur through `record_usage()` RPC.
- **Database Grants**:
  - `authenticated` role has explicit SELECT, INSERT, UPDATE, DELETE permissions on `projects`.
  - `anon` role has zero database table access.

---

## 17. Current Editor Workspace Architecture `[CURRENT]`

The workspace layout is engineered as a zero-scroll outer viewport with three independent internal scrolling columns:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ Header: [Back] [Project Title Input] [Save State Pill] [Undo/Redo] [Save]   │
├──────────────────────────┬────────────────────────────┬─────────────────────┤
│ Column 1: CONTENT        │ Column 2: PAGE PREVIEW     │ Column 3: DESIGN    │
│ (flex-1 min-h-0)         │ (520px fixed / shrink-0)   │ (380px fixed)       │
│                          │                            │                     │
│ - Assignment Mode Toggle │ - Preview toolbar          │ - Template presets  │
│ - Question Textarea      │   (Write on page, Prev/Next│ - Paper style & ton │
│ - Pinned EditorToolbar   │ - Scrollable Card viewport │ - Ruling & margins  │
│ - RichContentEditor      │ - Live HTML5 Canvas        │ - Handwriting style │
│   (Scrollable inner DOM) │ - Pointer guide overlay    │ - Slant, variation  │
│ - FloatingFormatBubble   │                            │ - Header/Footer ban │
│ - AiAssistant Box        │                            │                     │
└──────────────────────────┴────────────────────────────┴─────────────────────┘
```

---

## 18. Important Architectural Constraints

1. **Ruling Lattice Lock**: Text baselines must strictly adhere to the ruling lattice. Arbitrary pixel offsets or line-height drifts destroy the handwritten optical illusion.
2. **Zero-Keystroke Cloud Requests**: Never send Supabase PATCH requests on typing or formatting events. All unsaved state belongs in IndexedDB.
3. **No Hidden Local Draft Discard**: A cloud save failure must never wipe or revert the local draft.
4. **Client-Side Rendering Independence**: Canvas rendering runs deterministically on the client using HTML5 Canvas 2D API. No server-side Puppeteer or headless browser clusters are required for rendering.
5. **No Markup Characters in Editor**: The user-facing editor is a WYSIWYG rich text environment. Do not leak raw markdown syntax (such as `**bold**`) into the visible editor DOM.

---

## 19. Important Design Decisions and WHY They Were Made

- **IndexedDB for Autosave vs. Cloud Autosave**: Students often work in spotty campus Wi-Fi environments. Autosaving 5,000-word documents on every keystroke to Supabase would cause rate limiting, PostgREST concurrency lockups, and data loss. IndexedDB provides instant 0ms persistence.
- **Stack-Based HTML Parser vs. Markdown**: Markdown does not natively support per-word font scale, highlighter washes, or custom student ink colors without custom syntax that confuses users. A stack-based inline HTML parser (`parseInlineHtml`) allows clean DOM manipulation while producing normalized `Seg[]` arrays.
- **Quantized Header/Footer Heights**: Header and footer band heights are rounded to integer multiples of `rulingSpacing`. This ensures that content text directly below a header starts perfectly on a notebook ruled line.
- **Security Definer RPC for Usage**: To prevent users from resetting their monthly page generation allowances via client console scripts, `usage` table mutations are locked behind `record_usage()`.

---

## 20. Known Limitations `[CURRENT]`

- **Complex Mathematical Formulas**: LaTeX math equations (fractions, integrals, matrices) are not yet rendered in natural handwriting. They must currently be written out in text notation.
- **Freehand Pen Drawing / Stylus Input**: The canvas renderer generates strokes algorithmically from typed text; direct Apple Pencil / stylus drawing is not supported.
- **Multi-Column Text Layout**: Text flows in a single primary column across ruled pages; magazine-style newspaper columns are not supported.

---

## 21. Current Known Issues `[CURRENT]`

- **Supabase Auth Email Rate Limit**: Repeated account creation attempts in rapid succession during automated testing trigger Supabase Auth email rate limits (`email rate limit exceeded`). The application handles this gracefully by displaying user-friendly error banners and falling back to sign-in.
- **Supabase Cloud UPDATE Policy (Resolved)**: Previously, remote Supabase instances lacked an explicit `FOR UPDATE` RLS policy on `public.projects`, resulting in HTTP 406 Not Acceptable errors during cloud saves. This was resolved by applying migration `20260911100500_grant_update_on_projects.sql` and switching client calls to `.maybeSingle()`.

---

## 22. Completed Major Work

- **Phase 1: Rich Text Selection Formatting & Content Model**: Stack-based inline HTML parser, normalized font scale, highlighter washes, and student ink palettes.
- **Phase 2: 3-Column Workstation UX**: Implemented fixed 100vh viewport, independent column scrolling, floating format bubble, and sticky toolbar.
- **Phase 3: Local-First Persistence**: IndexedDB autosave engine, dirty-checking snapshot comparison, and cloud sync isolation.
- **Phase 4: Database RLS & Cloud Save Resilience**: Added UPDATE grant and policy on `projects`, switched to `.maybeSingle()`, and protected `profiles.plan`.
- **Phase 5: Authentication Recovery**: Added "Forgot password?" modal, recovery token interception, and password change flow.

---

## 23. Current Work in Progress `[PROPOSED]`

- **Page-Specific Header/Footer Architecture**:
  - Expanding from global-only bands (`all`, `first`, `last`) to a sparse inheritance override model:  
    `settings.pageOverrides: Record<number, PageBandOverride>`
  - Allows different headers or footers on specific pages (e.g., custom experiment title on page 3) while falling back to global defaults.
- **Relational Metadata vs. JSONB Document Storage Investigation**:
  - Investigating whether to maintain project content as a raw HTML text column or formalize document structure into a unified JSONB document model.

---

## 24. Future Planned Work `[FUTURE]`

- **Handwritten Mathematical Notation Engine**: Native parsing of LaTeX math blocks into handwritten strokes.
- **Custom Font Upload & Training**: Allowing users to upload their own handwriting samples to generate personalized handwriting models.
- **LMS Direct Submission Integration**: Export directly to Google Classroom, Canvas, and Blackboard.
- **Collaborative Group Assignments**: Real-time multi-user editing with synchronized handwriting rendering.

---

## 25. Development and Testing Workflow

### Local Development Setup
1. **Prerequisites**: Node.js 20+, npm.
2. **Install Dependencies**:
   ```bash
   npm install
   ```
3. **Start Development Server**:
   ```bash
   npm run dev
   ```
   Runs Vite dev server on `http://localhost:8080/`.
4. **Typecheck & Lint**:
   ```bash
   npx tsc --noEmit
   npm run lint
   ```
5. **Production Build Validation**:
   ```bash
   npm run build
   ```

### Supabase CLI & Migrations
- Migration files are located in `supabase/migrations/`.
- Target project reference: `aojpzcmwretmknftvzde` (`https://aojpzcmwretmknftvzde.supabase.co`).
- To test migrations locally or push to remote:
  ```bash
  npx supabase db push
  ```

---

## 26. Important Rules for Future AI Agents and Developers

1. **DO NOT Touch Persistence Without Authorization**:
   - Keystrokes **must always** go to IndexedDB (`handtext-local`).
   - Never initiate Supabase API requests on keystroke or formatting changes.
   - Cloud save must remain an explicit user action (<kbd>Ctrl</kbd>+<kbd>S</kbd> or Save button).
   - Failed cloud saves must **never** overwrite or wipe local drafts.
2. **DO NOT Break the Ruling Lattice**:
   - Text baselines must always be locked to the paper's ruling spacing:  
     $$\text{baseline} = \text{firstBaselineY} + i \times \text{rulingSpacing}$$
   - Never inject arbitrary margins or line heights that cause text to drift off the ruled lines.
3. **DO NOT Leak Visible Markup in the Editor**:
   - The editor is a WYSIWYG rich text environment. Never inject raw markdown tags (like `**text**`) into the visible editor DOM.
4. **Maintain Strict Architectural Taxonomy**:
   - When writing code, planning changes, or creating documentation, clearly distinguish:
     - `[CURRENT]`: Code currently in the repository.
     - `[PROPOSED]`: Researched and accepted designs awaiting implementation.
     - `[FUTURE]`: Long-term roadmap items.
5. **Protect PostgREST Queries**:
   - Always use `.maybeSingle()` with explicit null checks for Supabase single-row operations to prevent HTTP 406 crashes.
