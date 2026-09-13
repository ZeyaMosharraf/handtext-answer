# ADR-002: Master Ruling Lattice Coordinate Layout

- **Status**: Accepted `[CURRENT]`
- **Date**: September 2026
- **Context**: Standard digital document formatters (Word, HTML/CSS flow layout) render text inside fluid typographic bounding boxes. When overlaid onto physical notebook stationery (e.g., blue-ruled A4 paper), characters float erratically between lines, drift upward, or cut across horizontal ruling lines, instantly betraying the document as digitally generated.
- **Decision**: Architect a deterministic **Master Ruling Lattice** coordinate system in `src/lib/handwriting/layout.ts`:
  1. The ruling spacing is strictly derived from font size and line spacing:  
     $$\text{rulingSpacing} = \text{settings.fontSize} \times \text{settings.lineSpacing}$$
  2. All header and footer band heights are quantized to integer multiples of `rulingSpacing`.
  3. The first written baseline is strictly anchored below the header:  
     $$\text{firstBaselineY} = \text{headerHeight} + \text{rulingSpacing}$$
  4. Every written line $i$ sits precisely on $\text{firstBaselineY} + i \times \text{rulingSpacing}$.
- **Reason**:
  - Ensures text baselines are geometrically locked to printed paper lines regardless of font size, paper size, or margin dimensions.
  - Produces an authentic optical illusion of human handwriting resting upon ruled paper.
- **Consequences**:
  - **Positive**: Perfectly aligned physical stationery output matching real student notebook sheets.
  - **Negative**: Line heights cannot be arbitrarily varied mid-paragraph; font scaling must fit within the predetermined ruling interval.
