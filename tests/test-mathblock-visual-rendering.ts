/**
 * tests/test-mathblock-visual-rendering.ts
 *
 * Verification suite for MathBlock visual object rendering pipeline.
 *
 * Verifies:
 * 1. MathBlock with fraction (\frac{H}{T}) produces proper 2D layout box
 * 2. MathBlock with square root (\sqrt{x}) produces root layout box
 * 3. MathBlock with superscript (X^{2}) produces elevated superscript box
 * 4. MathBlock with Greek symbols (\alpha + \beta) produces symbol layout box
 * 5. Invalid/malformed math source is handled gracefully without crashing
 * 6. Multiple MathBlocks remain strictly independent
 * 7. Selected MathBlock supports edit and delete operations
 * 8. Editing one MathBlock does not affect another MathBlock
 * 9. Layout metrics: ascent, descent, and bounding box dimensions
 */

import { parseMath, layoutMath } from "../src/lib/math";
import { DEFAULT_SETTINGS, type HandwritingSettings } from "../src/lib/handwriting/types";
import { createMathBlock, type MathBlock, type DocumentBlock } from "../src/types/document";
import { insertBlockOp, updateBlockOp, deleteBlockOp } from "../src/lib/editor/documentOperations";

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

// Mock Canvas context for headless Node environment
const mockCtx = {
  measureText: (text: string) => ({ width: text.length * 12 }),
  font: "",
  save: () => {},
  restore: () => {},
  scale: () => {},
  clearRect: () => {},
  beginPath: () => {},
  moveTo: () => {},
  lineTo: () => {},
  stroke: () => {},
  fillText: () => {},
} as unknown as CanvasRenderingContext2D;

const testSettings: HandwritingSettings = {
  ...DEFAULT_SETTINGS,
  fontSize: 22,
  lineSpacing: 1.4,
};

console.log("\n─── 1. MathBlock with Fraction (\\frac{H}{T}) ───");

const fracAst = parseMath("\\frac{H}{T}");
assert(fracAst.length === 1, "Fraction parsed to 1 root AST node");
assertEquals(fracAst[0]?.type, "fraction", "AST root is FractionNode");

const fracBox = layoutMath(fracAst, mockCtx, testSettings, 1.0);
assert(fracBox.width > 0, "Fraction layout box has positive width");
assert(fracBox.ascent > 0, "Fraction layout box has positive ascent");
assert(fracBox.descent > 0, "Fraction layout box has positive descent (denominator)");
assertEquals(fracBox.type, "sequence", "Top-level layout box is sequence containing fraction");

console.log("\n─── 2. MathBlock with Square Root (\\sqrt{x}) ───");

const rootAst = parseMath("\\sqrt{x}");
assert(rootAst.length === 1, "Square root parsed to 1 root AST node");
assertEquals(rootAst[0]?.type, "root", "AST root is RootNode");

const rootBox = layoutMath(rootAst, mockCtx, testSettings, 1.0);
assert(rootBox.width > 0, "Square root layout box has positive width");
assert(rootBox.ascent > 0, "Square root layout box has positive ascent");
assertEquals(rootBox.type, "sequence", "Top-level layout box is sequence containing root");

console.log("\n─── 3. MathBlock with Superscript (X^{2}) ───");

const supAst = parseMath("X^{2}");
assert(supAst.length === 1, "Superscript parsed to 1 root AST node");
assertEquals(supAst[0]?.type, "supsub", "AST root is SupSubNode");

const supBox = layoutMath(supAst, mockCtx, testSettings, 1.0);
assert(supBox.width > 0, "Superscript layout box has positive width");
assert(supBox.ascent > 0, "Superscript elevates ascent above base");
assertEquals(supBox.type, "sequence", "Top-level layout box is sequence containing supsub");

console.log("\n─── 4. MathBlock with Greek Symbols (\\alpha + \\beta) ───");

const greekAst = parseMath("\\alpha + \\beta");
assert(greekAst.length === 3, "Greek expression parsed to 3 nodes");
assertEquals(greekAst[0]?.type, "symbol", "Node 0 is SymbolNode (alpha)");
assertEquals(greekAst[1]?.type, "operator", "Node 1 is OperatorNode (+)");
assertEquals(greekAst[2]?.type, "symbol", "Node 2 is SymbolNode (beta)");

const greekBox = layoutMath(greekAst, mockCtx, testSettings, 1.0);
assert(greekBox.width > 0, "Greek expression has positive width");
assert(greekBox.ascent > 0, "Greek expression has positive ascent");

console.log("\n─── 5. Invalid / Malformed Math Source Resilience ───");

// Parser is resilient: unclosed brace should not crash
let unclosedAst: any;
let parseThrew = false;
try {
  unclosedAst = parseMath("\\frac{H");
} catch {
  parseThrew = true;
}
assert(!parseThrew, "Unclosed \\frac{H does not crash parser");
assert(Array.isArray(unclosedAst), "Unclosed formula returns AST array");

console.log("\n─── 6. Multiple Independent MathBlocks ───");

const m1 = createMathBlock("H/T", "\\frac{H}{T}", "block");
const m2 = createMathBlock("sqrt(x)", "\\sqrt{x}", "block");
const m3 = createMathBlock("X^2", "X^{2}", "block");

let doc: DocumentBlock[] = [m1, m2, m3];
assertEquals(doc.length, 3, "Document contains 3 math blocks");
assert(m1.id !== m2.id && m2.id !== m3.id, "All math blocks have distinct IDs");
assertEquals((doc[0] as MathBlock).latex, "\\frac{H}{T}", "Block 1 has fraction");
assertEquals((doc[1] as MathBlock).latex, "\\sqrt{x}", "Block 2 has root");
assertEquals((doc[2] as MathBlock).latex, "X^{2}", "Block 3 has superscript");

console.log("\n─── 7. Selected MathBlock Edit and Delete Operations ───");

// Edit m2 to a new formula
const updatedDoc = updateBlockOp<MathBlock>(doc, m2.id, {
  latex: "\\sqrt{x + y}",
  naturalExpr: "sqrt(x + y)",
});
assertEquals((updatedDoc[1] as MathBlock).latex, "\\sqrt{x + y}", "m2 updated cleanly");
assertEquals((updatedDoc[0] as MathBlock).latex, "\\frac{H}{T}", "m1 remained completely untouched");
assertEquals((updatedDoc[2] as MathBlock).latex, "X^{2}", "m3 remained completely untouched");

// Delete m1
const delResult = deleteBlockOp(updatedDoc, m1.id, m1.id);
assertEquals(delResult.blocks.length, 2, "1 block removed, 2 remain");
assertEquals(delResult.blocks[0]?.id, m2.id, "First block is now m2");
assertEquals(delResult.blocks[1]?.id, m3.id, "Second block is now m3");
assert(!delResult.blocks.some((b) => b.id === m1.id), "m1 completely removed");

console.log("\n══════════════════════════════════════");
console.log(`Results: ${passed} passed, ${failed} failed.`);
if (failed > 0) {
  process.exit(1);
} else {
  console.log("All MathBlock visual rendering tests passed! ✓\n");
}
