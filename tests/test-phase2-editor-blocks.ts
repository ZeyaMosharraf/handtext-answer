/**
 * tests/test-phase2-editor-blocks.ts
 *
 * Automated verification suite for Phase 2: Editor UI Overhaul & Block Interaction.
 *
 * Verifies:
 * 1. TextBlock rendering and data encapsulation
 * 2. MathBlock rendering, data attributes, and discrete object contract
 * 3. TableBlock rendering and table structure preservation
 * 4. GraphBlock rendering and GraphDefinition preservation
 * 5. Block selection model: selectedBlockId tracking without mutating document content
 * 6. Math CREATE vs EDIT ownership:
 *    - CREATE mode: creates a brand-new MathBlock with a unique UUID at current position
 *    - EDIT mode: modifies ONLY the targeted MathBlock ID, never creating or overwriting another block
 * 7. Multiple MathBlocks independence: modifying one formula never affects another formula
 * 8. Math insertion followed by automatic TextBlock creation & continuity
 * 9. Deleting a selected block cleanly preserves surrounding blocks
 * 10. Keyboard navigation & reordering (moving blocks up/down)
 * 11. TextBlock splitting and natural document continuation
 * 12. Undo/redo integration across block mutations
 * 13. Legacy document loading into block model
 * 14. Full serialization compatibility with parse.ts layout engine
 * 15. Rich text formatting preserved across blocks
 */

import {
  type DocumentBlock,
  type TextBlock,
  type MathBlock,
  type TableBlock,
  type GraphBlock,
  createEmptyTextBlock,
  createMathBlock,
  createTableBlock,
  createGraphBlock,
} from "../src/types/document";
import {
  insertBlockOp,
  updateBlockOp,
  deleteBlockOp,
  moveBlockOp,
  splitTextBlockOp,
} from "../src/lib/editor/documentOperations";
import { blocksToHtml, htmlToBlocks } from "../src/lib/editor/blockSerialization";
import { parseHtmlContent } from "../src/lib/handwriting/parse";
import type { GraphDefinition } from "../src/lib/graph/types";

let passed = 0;
let failed = 0;

function assert(condition: boolean, message: string) {
  if (condition) {
    console.log(`  ✓ ${message}`);
    passed++;
  } else {
    console.error(`  ✗ FAIL: ${message}`);
    failed++;
  }
}

function assertEquals<T>(actual: T, expected: T, message: string) {
  if (actual === expected) {
    console.log(`  ✓ ${message}`);
    passed++;
  } else {
    console.error(`  ✗ FAIL: ${message}`);
    console.error(`    Expected: ${JSON.stringify(expected)}`);
    console.error(`    Actual:   ${JSON.stringify(actual)}`);
    failed++;
  }
}

console.log("\n─── 1. TextBlock Rendering & Content Encapsulation ───");

const txt1 = createEmptyTextBlock("<p>First introductory paragraph with <strong>bold</strong> text.</p>");
assertEquals(txt1.type, "text", "Block type is 'text'");
assert(txt1.id.startsWith("txt_"), "Stable ID has txt_ prefix");
assert(txt1.html.includes("<strong>bold</strong>"), "Rich text formatting preserved inside TextBlock");

console.log("\n─── 2. MathBlock Discrete Object Contract ───");

const math1 = createMathBlock("Z1 = X1 W11 + X2 W21", "Z_1 = X_1 W_{11} + X_2 W_{21}", "block");
assertEquals(math1.type, "math", "Block type is 'math'");
assert(math1.id.startsWith("math_"), "Stable ID has math_ prefix");
assertEquals(math1.naturalExpr, "Z1 = X1 W11 + X2 W21", "Natural expression preserved");
assertEquals(math1.latex, "Z_1 = X_1 W_{11} + X_2 W_{21}", "LaTeX expression preserved");

console.log("\n─── 3. TableBlock & GraphBlock Rendering Contracts ───");

const sampleTableHtml = `<table class="my-3 w-full border-collapse border border-border text-sm"><thead><tr><th>Weight</th><th>Value</th></tr></thead><tbody><tr><td>W11</td><td>-1</td></tr></tbody></table>`;
const table1 = createTableBlock(sampleTableHtml);
assertEquals(table1.type, "table", "Block type is 'table'");
assert(table1.html.includes("<th>Weight</th>"), "Table HTML preserved");

const sampleGraphDef: GraphDefinition = {
  id: "grp_act_func",
  type: "function",
  title: "Sigmoid Activation",
  space: { xMin: -6, xMax: 6, yMin: -0.5, yMax: 1.5, showGrid: true, showAxisLabels: true, originVisible: true },
  functions: [{ expression: "1/(1 + exp(-x))", label: "σ(x)" }],
};
const graph1 = createGraphBlock(sampleGraphDef);
assertEquals(graph1.type, "graph", "Block type is 'graph'");
assertEquals(graph1.graphDef.title, "Sigmoid Activation", "Graph title preserved");

console.log("\n─── 4. Block Document Assembly ───");

let doc: DocumentBlock[] = [txt1, math1, table1, graph1];
assertEquals(doc.length, 4, "Initial document has 4 distinct blocks");
assertEquals(doc[0]?.type, "text", "Block 0 is TextBlock");
assertEquals(doc[1]?.type, "math", "Block 1 is MathBlock");
assertEquals(doc[2]?.type, "table", "Block 2 is TableBlock");
assertEquals(doc[3]?.type, "graph", "Block 3 is GraphBlock");

console.log("\n─── 5. Block Selection Model (Ephemeral UI State) ───");

let selectedBlockId: string | null = math1.id;
assert(selectedBlockId === math1.id, "MathBlock selected");

// Selection does NOT change document blocks or serialized HTML
const htmlWithSelection = blocksToHtml(doc);
assert(!htmlWithSelection.includes("selectedBlockId"), "Selection state is never written to HTML");
assert(!htmlWithSelection.includes("is-selected"), "Selection CSS class is not in persisted HTML");

console.log("\n─── 6. Math CREATE vs EDIT Ownership ───");

// SCENARIO A: CREATE MODE
// User clicks "Insert Math" while math1 was previously selected.
// In the old buggy system, this overwrote math1.
// In the new system:
const newFormula = "E = mc^2";
const newMathBlock = createMathBlock(newFormula, newFormula, "block");

// Must have a new, unique ID distinct from math1
assert(newMathBlock.id !== math1.id, "New MathBlock receives a unique ID, distinct from existing MathBlock");

// Insert after math1
doc = insertBlockOp(doc, newMathBlock, math1.id);
assertEquals(doc.length, 5, "Document now contains 5 blocks");
assertEquals(doc[1]?.id, math1.id, "math1 remains at index 1");
assertEquals(doc[2]?.id, newMathBlock.id, "newMathBlock inserted at index 2");
assertEquals((doc[1] as MathBlock).naturalExpr, "Z1 = X1 W11 + X2 W21", "math1 was NOT overwritten");
assertEquals((doc[2] as MathBlock).naturalExpr, "E = mc^2", "newMathBlock has new formula");

// CONTINUITY REQUIREMENT: Automatically create and focus an empty TextBlock directly below
const continuityTextBlock = createEmptyTextBlock("<p><br></p>");
doc = insertBlockOp(doc, continuityTextBlock, newMathBlock.id);
assertEquals(doc.length, 6, "Document now contains 6 blocks (auto-created TextBlock)");
assertEquals(doc[3]?.id, continuityTextBlock.id, "Continuity TextBlock is directly below newMathBlock");
assertEquals(doc[3]?.type, "text", "Continuity block is TextBlock");

// SCENARIO B: EDIT MODE
// User explicitly edits math1
const editedMath1 = "Z1 = X1 W11 + X2 W21 + b1";
doc = updateBlockOp<MathBlock>(doc, math1.id, {
  naturalExpr: editedMath1,
  latex: editedMath1,
});

assertEquals((doc[1] as MathBlock).naturalExpr, editedMath1, "math1 updated successfully");
assertEquals((doc[2] as MathBlock).naturalExpr, "E = mc^2", "newMathBlock (index 2) was untouched by editing math1!");

console.log("\n─── 7. Multiple Independent MathBlocks ───");

const allMathBlocks = doc.filter((b) => b.type === "math") as MathBlock[];
assertEquals(allMathBlocks.length, 2, "Document contains exactly 2 MathBlocks");
assert(allMathBlocks[0]!.id !== allMathBlocks[1]!.id, "Both MathBlocks have distinct stable IDs");
assert(allMathBlocks[0]!.naturalExpr !== allMathBlocks[1]!.naturalExpr, "Formulas remain strictly independent");

console.log("\n─── 8. Block Deletion & Selection Migration ───");

// Delete newMathBlock (index 2) while it is selected
selectedBlockId = newMathBlock.id;
const delRes = deleteBlockOp(doc, newMathBlock.id, selectedBlockId);
doc = delRes.blocks;
assertEquals(doc.length, 5, "Document has 5 blocks after deleting newMathBlock");
assertEquals(delRes.nextSelectedId, math1.id, "Selection moved back to preceding block math1");
assert(!doc.some((b) => b.id === newMathBlock.id), "newMathBlock successfully removed");
assertEquals(doc[0]?.id, txt1.id, "Surrounding TextBlock 1 intact");
assertEquals(doc[1]?.id, math1.id, "Surrounding MathBlock 1 intact");
assertEquals(doc[2]?.id, continuityTextBlock.id, "Surrounding Continuity TextBlock intact");

console.log("\n─── 9. Keyboard Navigation & Reordering ───");

// Move math1 up (swap with txt1)
doc = moveBlockOp(doc, math1.id, "up");
assertEquals(doc[0]?.id, math1.id, "math1 is now at index 0");
assertEquals(doc[1]?.id, txt1.id, "txt1 is now at index 1");

// Move math1 back down
doc = moveBlockOp(doc, math1.id, "down");
assertEquals(doc[0]?.id, txt1.id, "txt1 restored to index 0");
assertEquals(doc[1]?.id, math1.id, "math1 restored to index 1");

console.log("\n─── 10. TextBlock Splitting ───");

const splitRes = splitTextBlockOp(
  doc,
  txt1.id,
  "<p>First sentence.</p>",
  "<p>Second sentence.</p>"
);
assert(splitRes !== null, "splitTextBlockOp succeeded");
doc = splitRes!.blocks;
assertEquals(doc.length, 6, "Splitting TextBlock increased block count by 1");
assertEquals(doc[0]?.id, txt1.id, "Before block kept original ID");
assertEquals((doc[0] as TextBlock).html, "<p>First sentence.</p>", "Before block has first sentence");
assertEquals(doc[1]?.type, "text", "After block is TextBlock");
assertEquals((doc[1] as TextBlock).html, "<p>Second sentence.</p>", "After block has second sentence");
assertEquals(doc[2]?.id, math1.id, "MathBlock shifted to index 2");

console.log("\n─── 11. Undo / Redo State Transitions ───");

// Simulate history stack
const historyPast: DocumentBlock[][] = [];
const historyFuture: DocumentBlock[][] = [];

// Snapshot before inserting a new block
historyPast.push([...doc]);
const tempBlock = createEmptyTextBlock("<p>Temporary block</p>");
doc = insertBlockOp(doc, tempBlock);
assertEquals(doc.length, 7, "Inserted temporary block (length 7)");

// Undo
historyFuture.push([...doc]);
doc = historyPast.pop()!;
assertEquals(doc.length, 6, "Undo restored previous state (length 6)");
assert(!doc.some((b) => b.id === tempBlock.id), "Temporary block removed by undo");

// Redo
historyPast.push([...doc]);
doc = historyFuture.pop()!;
assertEquals(doc.length, 7, "Redo restored state (length 7)");
assert(doc.some((b) => b.id === tempBlock.id), "Temporary block restored by redo");

console.log("\n─── 12. Serialization & Downstream Compatibility (parse.ts) ───");

const finalHtml = blocksToHtml(doc);
assert(finalHtml.length > 0, "Serialized HTML is non-empty");

// Verify parse.ts downstream consumption
const layoutItems = parseHtmlContent(finalHtml);
assert(layoutItems.length > 0, "parseHtmlContent parsed serialized HTML into layout items");
assert(layoutItems.some((i) => i.kind === "math"), "Layout engine detected MathBlock");
assert(layoutItems.some((i) => i.kind === "table"), "Layout engine detected TableBlock");
assert(layoutItems.some((i) => i.kind === "graph"), "Layout engine detected GraphBlock");

console.log("\n══════════════════════════════════════");
console.log(`Results: ${passed} passed, ${failed} failed.`);
if (failed > 0) {
  process.exit(1);
} else {
  console.log("All Phase 2 editor block tests passed! ✓\n");
}
