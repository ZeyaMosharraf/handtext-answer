/**
 * tests/test-mathblock-color.ts
 *
 * Comprehensive test suite for discrete MathBlock color control:
 * 1. MathBlock default color (undefined / no custom color)
 * 2. Changing MathBlock color
 * 3. Two MathBlocks with different colors
 * 4. Changing one does not affect another
 * 5. Color serialization (blocksToHtml outputs data-color)
 * 6. Color restoration (htmlToBlocks restores color)
 * 7. Color copy/paste (clipboard payload preserves color)
 * 8. Copied block gets independent color state (changing copy does not change original)
 * 9. Legacy MathBlock without color (renders using default document ink color)
 * 10. RIGHT handwritten renderer receives the selected color (layout & draw receives block color)
 */

import {
  createMathBlock,
  createEmptyTextBlock,
  type MathBlock,
  type DocumentBlock,
} from "../src/types/document";
import {
  blocksToHtml,
  htmlToBlocks,
} from "../src/lib/editor/blockSerialization";
import {
  serializeMathBlockToClipboard,
  deserializeMathBlockFromClipboard,
  createPastedMathBlock,
  MATH_BLOCK_MIME_TYPE,
  type MathClipboardPayload,
} from "../src/lib/editor/mathClipboard";
import {
  updateBlockOp,
  insertBlockOp,
} from "../src/lib/editor/documentOperations";
import { parseHtmlContent } from "../src/lib/handwriting/parse";
import { layoutDocument, type LayoutPage } from "../src/lib/handwriting/layout";
import { DEFAULT_SETTINGS } from "../src/lib/handwriting/types";

// Mock canvas 2D context for headless layout & draw verification
function createMockCanvasCtx() {
  const drawCalls: { op: string; text?: string; color?: string; x?: number; y?: number }[] = [];
  let currentColor = "#000000";

  const ctx = {
    drawCalls,
    get fillStyle() {
      return currentColor;
    },
    set fillStyle(val: string) {
      currentColor = val;
    },
    get strokeStyle() {
      return currentColor;
    },
    set strokeStyle(val: string) {
      currentColor = val;
    },
    lineWidth: 1,
    font: "16px sans-serif",
    measureText: (text: string) => ({
      width: text.length * 9,
      actualBoundingBoxAscent: 10,
      actualBoundingBoxDescent: 3,
    }),
    save: () => {},
    restore: () => {},
    beginPath: () => {},
    closePath: () => {},
    moveTo: (x: number, y: number) => drawCalls.push({ op: "moveTo", x, y, color: currentColor }),
    lineTo: (x: number, y: number) => drawCalls.push({ op: "lineTo", x, y, color: currentColor }),
    stroke: () => drawCalls.push({ op: "stroke", color: currentColor }),
    fill: () => drawCalls.push({ op: "fill", color: currentColor }),
    fillText: (text: string, x: number, y: number) =>
      drawCalls.push({ op: "fillText", text, x, y, color: currentColor }),
    strokeText: (text: string, x: number, y: number) =>
      drawCalls.push({ op: "strokeText", text, x, y, color: currentColor }),
    fillRect: () => {},
    strokeRect: () => {},
    clearRect: () => {},
    setLineDash: () => {},
  } as unknown as CanvasRenderingContext2D;

  return { ctx, drawCalls };
}

let passed = 0;
let failed = 0;

function assert(condition: boolean, msg: string) {
  if (condition) {
    console.log(`  ✓ ${msg}`);
    passed++;
  } else {
    console.error(`  ✗ FAIL: ${msg}`);
    failed++;
  }
}

console.log("\n=== 1. MathBlock Default Color ===");
{
  const mb = createMathBlock("Y_1 = Z_1 V_{11} + Z_2 V_{12}", "Y_1 = Z_1 V_{11} + Z_2 V_{12}");
  assert(mb.color === undefined, "Default MathBlock has undefined custom color (falls back to default ink)");
}

console.log("\n=== 2. Changing MathBlock Color ===");
{
  const mb = createMathBlock("Y_1 = 2Z_1 - Z_2", "Y_1 = 2Z_1 - Z_2");
  const blocks: DocumentBlock[] = [mb];
  const updated = updateBlockOp<MathBlock>(blocks, mb.id, { color: "#b3231f" });
  const updatedMb = updated[0] as MathBlock;
  assert(updatedMb.color === "#b3231f", "MathBlock color successfully updated to Red (#b3231f)");
}

console.log("\n=== 3. Two MathBlocks with Different Colors ===");
{
  const mb1 = createMathBlock("Y_1 = Z_1 V_{11} + Z_2 V_{12}", "Y_1 = Z_1 V_{11} + Z_2 V_{12}", "block", "#1d3fb5");
  const mb2 = createMathBlock("Y_1 = 2Z_1 - Z_2", "Y_1 = 2Z_1 - Z_2", "block", "#b3231f");
  assert(mb1.color === "#1d3fb5", "Block 1 has Blue color (#1d3fb5)");
  assert(mb2.color === "#b3231f", "Block 2 has Red color (#b3231f)");
  assert(mb1.color !== mb2.color, "Block 1 and Block 2 have distinct independent colors");
}

console.log("\n=== 4. Changing One MathBlock Does Not Affect Another ===");
{
  const mb1 = createMathBlock("Formula 1", "F_1", "block", "#1d3fb5");
  const mb2 = createMathBlock("Formula 2", "F_2", "block", "#b3231f");
  const mb3 = createMathBlock("Formula 3", "F_3", "block", "#146b3a");

  let blocks: DocumentBlock[] = [mb1, mb2, mb3];
  // Change mb1 color from blue to purple
  blocks = updateBlockOp<MathBlock>(blocks, mb1.id, { color: "#7e22ce" });

  const b1 = blocks.find((b) => b.id === mb1.id) as MathBlock;
  const b2 = blocks.find((b) => b.id === mb2.id) as MathBlock;
  const b3 = blocks.find((b) => b.id === mb3.id) as MathBlock;

  assert(b1.color === "#7e22ce", "Block 1 changed to Purple (#7e22ce)");
  assert(b2.color === "#b3231f", "Block 2 remains Red (#b3231f) completely unchanged");
  assert(b3.color === "#146b3a", "Block 3 remains Green (#146b3a) completely unchanged");
}

console.log("\n=== 5. Color Serialization (blocksToHtml) ===");
{
  const mbBlue = createMathBlock("Y_1", "Y_1", "block", "#1d3fb5");
  const mbDefault = createMathBlock("Y_2", "Y_2", "block"); // legacy / no color
  const html = blocksToHtml([mbBlue, mbDefault]);

  assert(html.includes('data-color="#1d3fb5"'), "Serialized HTML includes data-color for colored block");
  assert(html.includes(`data-block-id="${mbBlue.id}"`), "Serialized HTML includes mbBlue ID");
  assert(html.includes(`data-block-id="${mbDefault.id}"`), "Serialized HTML includes mbDefault ID");
  // Check that mbDefault does not emit data-color
  const defaultDivMatch = html.match(new RegExp(`<div[^>]*data-block-id=["']${mbDefault.id}["'][^>]*>`));
  assert(defaultDivMatch !== null && !defaultDivMatch[0].includes("data-color"), "Block without custom color does not emit data-color");
}

console.log("\n=== 6. Color Restoration (htmlToBlocks) ===");
{
  const mb1 = createMathBlock("Y_1", "Y_1", "block", "#b3231f");
  const mb2 = createMathBlock("Y_2", "Y_2", "block", "#146b3a");
  const mbLegacy = createMathBlock("Y_3", "Y_3", "block"); // no color

  const html = blocksToHtml([mb1, mb2, mbLegacy]);
  const restored = htmlToBlocks(html);

  assert(restored.length === 3, "Restored 3 blocks from HTML");
  const r1 = restored[0] as MathBlock;
  const r2 = restored[1] as MathBlock;
  const r3 = restored[2] as MathBlock;

  assert(r1.color === "#b3231f", "Restored block 1 preserved Red color (#b3231f)");
  assert(r2.color === "#146b3a", "Restored block 2 preserved Green color (#146b3a)");
  assert(r3.color === undefined, "Restored legacy block has undefined color (default ink)");
}

console.log("\n=== 7. Color Copy / Paste ===");
{
  const mockClipboard: Record<string, string> = {};
  const mockDataTransfer = {
    setData: (mime: string, val: string) => {
      mockClipboard[mime] = val;
    },
    getData: (mime: string) => mockClipboard[mime] || "",
  } as unknown as DataTransfer;

  const originalMb = createMathBlock(
    "Y_1 = 2Z_1 - Z_2",
    "Y_1 = 2Z_1 - Z_2",
    "block",
    "#b3231f"
  );

  const payload = serializeMathBlockToClipboard(originalMb, mockDataTransfer);
  assert(payload.color === "#b3231f", "Serialized payload contains color");

  const deserialized = deserializeMathBlockFromClipboard(mockDataTransfer);
  assert(deserialized !== null, "Deserialized payload is not null");
  assert(deserialized?.color === "#b3231f", "Deserialized clipboard payload contains color");

  const pastedMb = createPastedMathBlock(deserialized!);
  assert(pastedMb.color === "#b3231f", "Pasted MathBlock gets the copied color");
  assert(pastedMb.id !== originalMb.id, "Pasted MathBlock gets a fresh new unique block ID");
}

console.log("\n=== 8. Copied Block Gets Independent Color State ===");
{
  const originalMb = createMathBlock("Formula", "F(x)", "block", "#b3231f");
  const payload = serializeMathBlockToClipboard(originalMb, null);
  const pastedMb = createPastedMathBlock(payload);

  let doc: DocumentBlock[] = [originalMb, pastedMb];
  assert(doc[0].id !== doc[1].id, "Original and pasted have different IDs");
  assert((doc[0] as MathBlock).color === "#b3231f", "Original starts Red");
  assert((doc[1] as MathBlock).color === "#b3231f", "Pasted starts Red");

  // Change pasted block color to Blue (#1d3fb5)
  doc = updateBlockOp<MathBlock>(doc, pastedMb.id, { color: "#1d3fb5" });

  const finalOrig = doc.find((b) => b.id === originalMb.id) as MathBlock;
  const finalPasted = doc.find((b) => b.id === pastedMb.id) as MathBlock;

  assert(finalOrig.color === "#b3231f", "Original block REMAINS Red (#b3231f)");
  assert(finalPasted.color === "#1d3fb5", "Pasted block successfully changed to Blue (#1d3fb5)");
}

console.log("\n=== 9. Legacy MathBlock Without Color (Backward Compatibility) ===");
{
  const legacyHtml = '<div class="math-block" data-latex="Y_1 = 2Z_1 - Z_2">Y_1 = 2Z_1 - Z_2</div>';
  const parsed = htmlToBlocks(legacyHtml);
  assert(parsed.length === 1, "Parsed legacy HTML into 1 block");
  assert(parsed[0].type === "math", "Parsed block type is math");
  const mb = parsed[0] as MathBlock;
  assert(mb.color === undefined, "Legacy math block has color = undefined");
  assert(mb.latex === "Y_1 = 2Z_1 - Z_2", "Legacy latex correctly extracted");

  // Verify handwriting parse handles legacy HTML
  const parsedHandwriting = parseHtmlContent(legacyHtml);
  assert(parsedHandwriting.length === 1, "Handwriting parsed legacy HTML into 1 block");
  assert(parsedHandwriting[0].kind === "math", "Handwriting block kind is math");
  assert(parsedHandwriting[0].math?.color === undefined, "Handwriting mathData color is undefined (will use default ink)");
}

console.log("\n=== 10. RIGHT Handwritten Pipeline Receives Selected Color ===");
{
  const { ctx } = createMockCanvasCtx();
  const htmlWithColors = `
<div data-block-id="m1" data-block-type="math" data-latex="Y_1 = Z_1 V_{11} + Z_2 V_{12}" data-color="#1d3fb5" class="math-block">Y_1 = Z_1 V_{11} + Z_2 V_{12}</div>
<div data-block-id="m2" data-block-type="math" data-latex="Y_1 = 2Z_1 - Z_2" data-color="#b3231f" class="math-block">Y_1 = 2Z_1 - Z_2</div>
<div data-block-id="m3" data-block-type="math" data-latex="Y_2 = -2Z_1 + 2Z_2" data-color="#146b3a" class="math-block">Y_2 = -2Z_1 + 2Z_2</div>
<div data-block-id="m4" data-block-type="math" data-latex="Y_4 = Z_4" class="math-block">Y_4 = Z_4</div>
`;

  // 1. parseHtmlContent
  const blocks = parseHtmlContent(htmlWithColors);
  assert(blocks.length === 4, "Parsed 4 math blocks for handwriting");
  assert(blocks[0].math?.color === "#1d3fb5", "Block 1 parsed with Blue color (#1d3fb5)");
  assert(blocks[1].math?.color === "#b3231f", "Block 2 parsed with Red color (#b3231f)");
  assert(blocks[2].math?.color === "#146b3a", "Block 3 parsed with Green color (#146b3a)");
  assert(blocks[3].math?.color === undefined, "Block 4 parsed with undefined color (default legacy)");

  // 2. layoutDocument
  const layoutDoc = layoutDocument(ctx, { content: htmlWithColors, settings: DEFAULT_SETTINGS });
  assert(layoutDoc.pages.length >= 1, "Layout document has at least 1 page");

  const placements = layoutDoc.pages[0].placements.filter(
    (p): p is Extract<LayoutPage["placements"][number], { type: "mathBlock" }> => p.type === "mathBlock"
  );

  assert(placements.length === 4, "Page 1 contains all 4 math block placements");
  assert(placements[0].color === "#1d3fb5", "Placement 1 carries Blue color (#1d3fb5)");
  assert(placements[1].color === "#b3231f", "Placement 2 carries Red color (#b3231f)");
  assert(placements[2].color === "#146b3a", "Placement 3 carries Green color (#146b3a)");
  assert(placements[3].color === undefined, "Placement 4 has undefined color (tracks default ink)");
}

console.log("\n══════════════════════════════════════════════════");
console.log(`Results: ${passed} passed, ${failed} failed.`);
if (failed > 0) {
  console.error("Some tests failed!");
  process.exit(1);
} else {
  console.log("All 10 MathBlock Color Test Suites Passed! ✓\n");
}
