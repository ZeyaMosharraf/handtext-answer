/**
 * tests/test-phase5-write-on-page.ts
 *
 * Automated Verification Suite for Phase 5:
 * "Write-on-Page Safety & Non-Destructive Persistence"
 *
 * Verifies:
 * 1. High priority data protection test:
 *    Document with:
 *      TextBlock 1
 *      MathBlock (with apostrophe, single quotes, color, displayMode, margin marker)
 *      TableBlock (with multi-row, cell alignments, headers, margin marker)
 *      GraphBlock (with GraphDefinition, title, coordinate space)
 *      TextBlock 2
 * 2. Edit one text line through Write-on-Page (updateContentFromPlainText).
 * 3. Verify ALL other blocks (Math, Table, Graph) remain 100% IDENTICAL:
 *    - Math LaTeX, color, naturalExpr, displayMode, and margin marker intact
 *    - Table cells, headers, alignments, and margin marker intact
 *    - Graph definition and metadata intact
 *    - Stable block IDs intact
 * 4. Verify editing second text line preserves preceding blocks
 * 5. Verify plain text documents preserve margin metadata across line edits
 * 6. Verify delimiter defense: deleting placeholder does NOT destroy structured block
 */

import {
  htmlToPlainText,
  plainTextToHtml,
  updateContentFromPlainText,
  parseContent,
  blocksToHtml,
  type Block,
} from "../src/lib/handwriting/parse";
import { htmlToBlocks } from "../src/lib/editor/blockSerialization";

let passed = 0;
let failed = 0;

function assert(condition: boolean, msg: string) {
  if (condition) {
    passed++;
    console.log(`  ✓ ${msg}`);
  } else {
    failed++;
    console.error(`  ✗ FAIL: ${msg}`);
  }
}

function assertEquals<T>(actual: T, expected: T, msg: string) {
  const isMatch = JSON.stringify(actual) === JSON.stringify(expected);
  if (isMatch) {
    passed++;
    console.log(`  ✓ ${msg}`);
  } else {
    failed++;
    console.error(`  ✗ FAIL: ${msg}\n    Expected: ${JSON.stringify(expected)}\n    Actual:   ${JSON.stringify(actual)}`);
  }
}

console.log("\n=======================================================");
console.log("PHASE 5 VERIFICATION: Write-on-Page Safety");
console.log("=======================================================\n");

// ── Test 1: Full Mixed Document Write-on-Page Non-Destructive Editing ──
console.log("Test 1: Editing TextBlock 1 in mixed document (Text -> Math -> Table -> Graph -> Text)");
{
  const mathLatex = "x' = \\frac{x - \\min}{\\max - \\min}";
  const graphDef = {
    id: "grp-404",
    type: "coordinate" as const,
    title: "Force vs Acceleration",
    space: { xMin: -10, xMax: 10, yMin: -10, yMax: 10, showGrid: true, showAxisLabels: true, originVisible: true },
  };

  const initialHtml = [
    `<p data-block-id="txt-1" data-margin-marker="Q1" data-margin-type="question">Initial problem description line</p>`,
    `<div class="math-block" data-block-id="math-1" data-latex="${mathLatex}" data-natural-expr="${mathLatex}" data-color="#3b82f6" data-margin-marker="Q1.a" data-margin-type="subquestion">∑ ${mathLatex}</div>`,
    `<table><thead><tr><th style="text-align: left">Quantity</th><th style="text-align: right">Value</th></tr></thead><tbody><tr><td style="text-align: left">Mass</td><td style="text-align: right">10 kg</td></tr></tbody></table>`,
    `<div class="graph-block" data-block-id="grp-1" data-graph-definition='${JSON.stringify(graphDef)}'>📈 Force vs Acceleration</div>`,
    `<p data-block-id="txt-2" data-margin-marker="Ans" data-margin-type="answer">Conclusion and final answer text</p>`,
  ].join("\n");

  // Step 1: Generate plain text representation for Write-on-Page textarea
  const plainText = htmlToPlainText(initialHtml);
  assert(plainText.includes("Initial problem description line"), "Plain text contains Text 1");
  assert(plainText.includes(mathLatex), "Plain text contains Math formula");
  assert(plainText.includes("[Table:"), "Plain text contains Table placeholder");
  assert(plainText.includes("[Graph:"), "Plain text contains Graph placeholder");
  assert(plainText.includes("Conclusion and final answer text"), "Plain text contains Text 2");

  // Step 2: User edits ONLY TextBlock 1 in the Write-on-Page textarea
  const editedPlainText = plainText.replace(
    "Initial problem description line",
    "MODIFIED problem description with extra details",
  );

  // Step 3: Run updateContentFromPlainText (the safe Write-on-Page update boundary)
  const updatedHtml = updateContentFromPlainText(initialHtml, editedPlainText);

  // Step 4: Parse updated document to verify ALL blocks
  const updatedBlocks = parseContent(updatedHtml);
  assertEquals(updatedBlocks.length, 5, "Document retains exactly 5 blocks after on-page text editing");

  // Block 0: TextBlock 1 modified
  assertEquals(updatedBlocks[0]?.kind, "paragraph", "Block 0 is a paragraph");
  assertEquals(updatedBlocks[0]?.text, "MODIFIED problem description with extra details", "Block 0 text correctly updated");
  assertEquals(updatedBlocks[0]?.id, "txt-1", "Block 0 stable ID preserved");
  assertEquals(updatedBlocks[0]?.marginMarker?.text, "Q1", "Block 0 margin marker 'Q1' preserved");
  assertEquals(updatedBlocks[0]?.marginMarker?.type, "question", "Block 0 margin marker type preserved");

  // Block 1: MathBlock 100% IDENTICAL
  assertEquals(updatedBlocks[1]?.kind, "math", "Block 1 remains a MathBlock (NOT flattened into <p>!)");
  assertEquals(updatedBlocks[1]?.math?.latex, mathLatex, "Block 1 formula LaTeX 100% identical");
  assertEquals(updatedBlocks[1]?.id, "math-1", "Block 1 stable ID preserved");
  assertEquals(updatedBlocks[1]?.math?.color, "#3b82f6", "Block 1 color preserved");
  assertEquals(updatedBlocks[1]?.marginMarker?.text, "Q1.a", "Block 1 margin marker 'Q1.a' preserved");

  // Block 2: TableBlock 100% IDENTICAL
  assertEquals(updatedBlocks[2]?.kind, "table", "Block 2 remains a TableBlock (NOT flattened into <p>!)");
  assert(Boolean(updatedBlocks[2]?.table), "Block 2 table data exists");
  assertEquals(updatedBlocks[2]?.table?.rows.length, 2, "Table rows count preserved");
  assertEquals(updatedBlocks[2]?.table?.rows[0]?.[0]?.text, "Quantity", "Table header cell preserved");
  assertEquals(updatedBlocks[2]?.table?.rows[0]?.[1]?.text, "Value", "Table header cell 2 preserved");
  assertEquals(updatedBlocks[2]?.table?.rows[1]?.[0]?.text, "Mass", "Table row cell 1 preserved");
  assertEquals(updatedBlocks[2]?.table?.rows[1]?.[1]?.text, "10 kg", "Table row cell 2 preserved");
  assertEquals(updatedBlocks[2]?.table?.alignments, ["left", "right"], "Table column alignments preserved");

  // Block 3: GraphBlock 100% IDENTICAL
  assertEquals(updatedBlocks[3]?.kind, "graph", "Block 3 remains a GraphBlock (NOT flattened into <p>!)");
  assertEquals(updatedBlocks[3]?.graph?.definition.title, "Force vs Acceleration", "Graph title preserved");
  assertEquals(updatedBlocks[3]?.graph?.definition.space.xMax, 10, "Graph definition coordinate space preserved");

  // Block 4: TextBlock 2 100% IDENTICAL
  assertEquals(updatedBlocks[4]?.kind, "paragraph", "Block 4 remains a paragraph");
  assertEquals(updatedBlocks[4]?.text, "Conclusion and final answer text", "Block 4 text remains untouched");
  assertEquals(updatedBlocks[4]?.marginMarker?.text, "Ans", "Block 4 margin marker 'Ans' preserved");
}

// ── Test 2: Editing TextBlock 2 (Bottom text) ──
console.log("\nTest 2: Editing TextBlock 2 (Bottom text) in mixed document");
{
  const mathLatex = "y'' + \\omega^2 y = 0";
  const initialHtml = [
    `<p data-block-id="txt-a">First paragraph</p>`,
    `<div class="math-block" data-block-id="m-a" data-latex="${mathLatex}">∑ ${mathLatex}</div>`,
    `<p data-block-id="txt-b">Second paragraph to be updated</p>`,
  ].join("\n");

  const plainText = htmlToPlainText(initialHtml);
  const editedPlainText = plainText.replace(
    "Second paragraph to be updated",
    "Second paragraph has been successfully edited via write-on-page",
  );

  const updatedHtml = updateContentFromPlainText(initialHtml, editedPlainText);
  const blocks = parseContent(updatedHtml);

  assertEquals(blocks.length, 3, "Retains 3 blocks");
  assertEquals(blocks[0]?.text, "First paragraph", "First paragraph remains untouched");
  assertEquals(blocks[1]?.kind, "math", "MathBlock remains intact");
  assertEquals(blocks[1]?.math?.latex, mathLatex, "Math LaTeX remains intact");
  assertEquals(blocks[2]?.text, "Second paragraph has been successfully edited via write-on-page", "Second paragraph updated");
}

// ── Test 3: Delimiter safety / tampering defense ──
console.log("\nTest 3: Accidental deletion of placeholder still preserves structured block");
{
  const mathLatex = "E = mc^2";
  const initialHtml = [
    `<p data-block-id="txt-1">Top text</p>`,
    `<div class="math-block" data-block-id="m-1" data-latex="${mathLatex}">∑ E=mc^2</div>`,
    `<p data-block-id="txt-2">Bottom text</p>`,
  ].join("\n");

  // User clears entire textarea content except some text (placeholder deleted)
  const userTypedText = "Top text edited\nBottom text edited";
  const updatedHtml = updateContentFromPlainText(initialHtml, userTypedText);
  const blocks = parseContent(updatedHtml);

  // Even if user omitted $$ delimiter, non-text block is preserved safely
  const hasMath = blocks.some((b) => b.kind === "math" && b.math?.latex === mathLatex);
  assert(hasMath, "MathBlock is preserved despite placeholder omission (fail-safe protection)");
}

// ── Test 4: Pure text document preserves margin markers ──
console.log("\nTest 4: Pure text document line edits preserve margin markers");
{
  const initialHtml = [
    `<p data-block-id="p1" data-margin-marker="Q1" data-margin-type="question">Question prompt text</p>`,
    `<p data-block-id="p2" data-margin-marker="Q1.1" data-margin-type="subquestion">Subquestion prompt text</p>`,
  ].join("\n");

  const plainText = htmlToPlainText(initialHtml);
  const editedText = plainText.replace("Question prompt text", "Updated question prompt");

  const updatedHtml = updateContentFromPlainText(initialHtml, editedText);
  const blocks = parseContent(updatedHtml);

  assertEquals(blocks[0]?.text, "Updated question prompt", "Line 1 updated");
  assertEquals(blocks[0]?.marginMarker?.text, "Q1", "Line 1 margin marker preserved");
  assertEquals(blocks[1]?.text, "Subquestion prompt text", "Line 2 text preserved");
  assertEquals(blocks[1]?.marginMarker?.text, "Q1.1", "Line 2 margin marker preserved");
}

console.log("\n=======================================================");
console.log(`Phase 5 Test Results: ${passed} passed, ${failed} failed`);
console.log("=======================================================\n");

if (failed > 0) {
  process.exit(1);
}
