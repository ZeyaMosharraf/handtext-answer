# ADR-004: Three-Column Fixed-Viewport Workstation UX

- **Status**: Accepted `[CURRENT]`
- **Date**: September 2026
- **Context**: As documents grow in length (e.g., 10-page laboratory reports), traditional single-page scrollable layouts cause toolbars, design inspector panels, and live previews to scroll off-screen. Users were forced to continually scroll up and down between the text input and the bottom preview to verify rendering output.
- **Decision**: Redesign the desktop workstation interface around a **Fixed-Viewport, Three-Column Layout**:
  1. Lock the outer browser container to the exact viewport height (`h-screen overflow-hidden`).
  2. Structure the desktop layout into three independent vertically scrolling columns:
     - **Column 1: Content Editor** (`flex-1 min-h-0`): Houses assignment prompt, sticky toolbar, rich content editor, and AI assistant.
     - **Column 2: Live Page Preview** (`520px fixed / shrink-0`): Houses page navigation, interactive write-on-page canvas, and red line guide.
     - **Column 3: Design Inspector** (`380px fixed / shrink-0`): Houses template pickers, paper styling, font physics, and header/footer configurations.
  3. On viewports $< 1024\text{px}$, gracefully collapse the grid into a tabbed switcher (`Content` | `Preview` | `Design`).
- **Reason**:
  - Pinned controls and sticky headers remain permanently accessible regardless of document length.
  - Enables true side-by-side editing where users type in Column 1 and observe live canvas rendering in Column 2 without scrolling the viewport.
- **Consequences**:
  - **Positive**: Exceptional professional workstation feel, zero runaway page scrolling, and high productivity.
  - **Negative**: Requires careful CSS flexbox/grid budgeting (`min-h-0`, `overflow-y-auto`) to prevent inner containers from blowing out heights.
