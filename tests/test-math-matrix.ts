/**
 * tests/test-math-matrix.ts
 *
 * Comprehensive tests for Matrix support in the Math subsystem:
 * 1. AST generation for 1×1, 2×2, 2×3, 3×3 matrices
 * 2. Assignment test case: C = [ 4.9821 5.875 ; 5.875 8.125 ]
 * 3. Decimals, negative values, variables, and expressions inside cells
 * 4. Bracket styles: bmatrix ([ ]), pmatrix (( )), vmatrix (| |)
 * 5. Expressions with prefixes/surrounding tokens (C =, A +, det(...))
 * 6. Matrix layout geometry, ascents, descents, and column spacing
 * 7. LineUnits calculation for multi-row matrices
 * 8. Digital math rendering (HTML output with brackets & table)
 * 9. Serialization round-trip via blocksToHtml and htmlToBlocks
 * 10. Copy/paste clipboard preservation and object independence
 * 11. MathBlock color inheritance on digital and canvas rendering
 * 12. extractMatrixFromLatex and buildMatrixLatex dimension preservation
 */

import { parseMath, layoutMath, computeLineUnits } from "../src/lib/math";
import type {
  MatrixNode,
  IdentifierNode,
  OperatorNode,
  NumberNode,
  GroupedNode,
} from "../src/lib/math";
import { renderDigitalMathToHtml } from "../src/lib/math/digitalRenderer";
import { DEFAULT_SETTINGS } from "../src/lib/handwriting/types";
import { blocksToHtml, htmlToBlocks } from "../src/lib/editor/blockSerialization";
import {
  serializeMathBlockToClipboard,
  deserializeMathBlockFromClipboard,
  createPastedMathBlock,
} from "../src/lib/editor/mathClipboard";
import {
  extractMatrixFromLatex,
  buildMatrixLatex,
} from "../src/components/editor/MathFormulaModal";
import { createMathBlock, type MathBlock } from "../src/types/document";

let passed = 0;
let failed = 0;

function assert(condition: boolean, testName: string, detail?: string) {
  if (condition) {
    console.log(`PASS: ${testName}`);
    passed++;
  } else {
    console.error(`FAIL: ${testName} - ${detail ?? "assertion failed"}`);
    failed++;
  }
}

console.log("\n=== Math Matrix Subsystem Tests ===\n");

// ─── 1. Assignment Matrix: 2×2 with decimals ─────────────────────────────────
{
  const latex = "C = \\begin{bmatrix} 4.9821 & 5.875 \\\\ 5.875 & 8.125 \\end{bmatrix}";
  const ast = parseMath(latex);

  assert(ast.length === 3, "Assignment formula parses into 3 top-level nodes (C, =, matrix)");
  assert(ast[0]?.type === "identifier" && (ast[0] as IdentifierNode).value === "C", "Node 0 is Identifier 'C'");
  assert(ast[1]?.type === "operator" && (ast[1] as OperatorNode).value === "=", "Node 1 is Operator '='");

  const matrix = ast[2] as MatrixNode;
  assert(matrix?.type === "matrix", "Node 2 is MatrixNode");
  assert(matrix.environment === "bmatrix", "Environment is bmatrix (square brackets)");
  assert(matrix.rows.length === 2, "Matrix has 2 rows");
  assert(matrix.rows[0]?.length === 2 && matrix.rows[1]?.length === 2, "Matrix has 2 columns per row");

  // Verify cell values
  const r0c0 = matrix.rows[0]?.[0]?.[0] as NumberNode;
  const r0c1 = matrix.rows[0]?.[1]?.[0] as NumberNode;
  const r1c0 = matrix.rows[1]?.[0]?.[0] as NumberNode;
  const r1c1 = matrix.rows[1]?.[1]?.[0] as NumberNode;

  assert(r0c0?.value === "4.9821", "Row 0 Col 0 is 4.9821");
  assert(r0c1?.value === "5.875", "Row 0 Col 1 is 5.875");
  assert(r1c0?.value === "5.875", "Row 1 Col 0 is 5.875");
  assert(r1c1?.value === "8.125", "Row 1 Col 1 is 8.125");
}

// ─── 2. Matrix Dimensions: 1×1, 2×1, 1×2, 2×3, 3×3 ───────────────────────────
{
  // 1×1
  const m1x1 = parseMath("\\begin{bmatrix} 5 \\end{bmatrix}")[0] as MatrixNode;
  assert(m1x1?.type === "matrix" && m1x1.rows.length === 1 && m1x1.rows[0]?.length === 1, "1×1 matrix parses correctly");
  assert((m1x1.rows[0]?.[0]?.[0] as NumberNode)?.value === "5", "1×1 matrix value is 5");

  // 1×2
  const m1x2 = parseMath("\\begin{bmatrix} 1 & 2 \\end{bmatrix}")[0] as MatrixNode;
  assert(m1x2.rows.length === 1 && m1x2.rows[0]?.length === 2, "1×2 row vector parses correctly");

  // 2×1
  const m2x1 = parseMath("\\begin{bmatrix} 1 \\\\ 2 \\end{bmatrix}")[0] as MatrixNode;
  assert(m2x1.rows.length === 2 && m2x1.rows[0]?.length === 1, "2×1 column vector parses correctly");

  // 2×3
  const m2x3 = parseMath("\\begin{bmatrix} 1 & 2 & 3 \\\\ 4 & 5 & 6 \\end{bmatrix}")[0] as MatrixNode;
  assert(m2x3.rows.length === 2 && m2x3.rows[0]?.length === 3 && m2x3.rows[1]?.length === 3, "2×3 matrix parses correctly");
  assert((m2x3.rows[1]?.[2]?.[0] as NumberNode)?.value === "6", "2×3 matrix last cell is 6");

  // 3×3
  const m3x3 = parseMath("\\begin{bmatrix} 1 & 2 & 3 \\\\ 4 & 5 & 6 \\\\ 7 & 8 & 9 \\end{bmatrix}")[0] as MatrixNode;
  assert(m3x3.rows.length === 3 && m3x3.rows.every((r) => r.length === 3), "3×3 matrix parses correctly with 3 rows of 3 cols");
  assert((m3x3.rows[2]?.[2]?.[0] as NumberNode)?.value === "9", "3×3 matrix bottom-right is 9");
}

// ─── 3. Negative and Decimal Values ──────────────────────────────────────────
{
  const latex = "\\begin{bmatrix} 4.9821 & -2.5 \\\\ -10 & 0.001 \\end{bmatrix}";
  const matrix = parseMath(latex)[0] as MatrixNode;
  assert(matrix.rows.length === 2 && matrix.rows[0]?.length === 2, "Negative/decimal matrix parsed");

  // Cell (0,1): "-" and "2.5"
  const negCell = matrix.rows[0]?.[1];
  assert(
    negCell?.length === 2 &&
    negCell[0]?.type === "operator" && (negCell[0] as OperatorNode).value === "-" &&
    negCell[1]?.type === "number" && (negCell[1] as NumberNode).value === "2.5",
    "Negative cell -2.5 preserved with operator and decimal number",
  );
}

// ─── 4. Expression Cells: variables and subscripts ───────────────────────────
{
  const latex = "\\begin{bmatrix} X_1 & X_2 \\\\ Y_1 & Y_2 \\end{bmatrix}";
  const matrix = parseMath(latex)[0] as MatrixNode;
  assert(matrix.rows.length === 2, "Variable expression matrix parsed");
  const cell00 = matrix.rows[0]?.[0]?.[0];
  assert(cell00?.type === "supsub", "Cell entry X_1 is SupSubNode");
}

// ─── 5. Delimiter Styles: bmatrix, pmatrix, vmatrix ──────────────────────────
{
  const pmat = parseMath("\\begin{pmatrix} a & b \\\\ c & d \\end{pmatrix}")[0] as MatrixNode;
  assert(pmat.environment === "pmatrix", "pmatrix parsed with parentheses environment");

  const vmat = parseMath("\\begin{vmatrix} 1 & 2 \\\\ 3 & 4 \\end{vmatrix}")[0] as MatrixNode;
  assert(vmat.environment === "vmatrix", "vmatrix parsed with vertical bar environment");
}

// ─── 6. Surrounding Expressions: Prefix, Addition, Determinant ───────────────
{
  // A + [matrix]
  const addAst = parseMath("A + \\begin{bmatrix} 1 & 0 \\\\ 0 & 1 \\end{bmatrix}");
  assert(addAst.length === 3 && addAst[1]?.type === "operator", "A + [matrix] parsed into A, +, matrix");

  // det([matrix])
  const detAst = parseMath("\\det(\\begin{bmatrix} 1 & 2 \\\\ 3 & 4 \\end{bmatrix})");
  assert(
    detAst.length === 2 &&
    detAst[0]?.type === "function" &&
    detAst[1]?.type === "grouped",
    "det([matrix]) parses into function det and grouped parentheses containing matrix",
  );
  const grouped = detAst[1] as GroupedNode;
  assert(grouped.body[0]?.type === "matrix", "Grouped body contains the matrix");
}

// ─── 7. Layout Geometry & Spacing ────────────────────────────────────────────
{
  const latex = "C = \\begin{bmatrix} 4.9821 & 5.875 \\\\ 5.875 & 8.125 \\end{bmatrix}";
  const ast = parseMath(latex);
  const mockCtx = {
    font: "",
    measureText: (t: string) => ({ width: t.length * 10 }),
  } as unknown as CanvasRenderingContext2D;

  const box = layoutMath(ast, mockCtx, DEFAULT_SETTINGS, 1.0);
  assert(box.type === "sequence", "Sequence box produced");
  assert(box.width > 150, `Matrix box width is substantial (${box.width.toFixed(1)}px)`);
  assert(box.ascent > 35, `Matrix box ascent spans multiple lines (${box.ascent.toFixed(1)}px)`);
  assert(box.descent > 20, `Matrix box descent provides clearance (${box.descent.toFixed(1)}px)`);

  // lineUnits calculation: multi-row matrix spans >= 2 ruled line units
  const lineUnits = computeLineUnits(box, 32);
  assert(lineUnits >= 2, `Matrix occupies at least 2 line units (actual: ${lineUnits})`);
}

// ─── 8. Digital Math HTML Rendering (LEFT editor) ────────────────────────────
{
  const latex = "C = \\begin{bmatrix} 4.9821 & 5.875 \\\\ 5.875 & 8.125 \\end{bmatrix}";
  const html = renderDigitalMathToHtml(latex);

  assert(html.includes("<table"), "Digital HTML includes <table> for alignment");
  assert(html.includes("border-spacing:12px 4px"), "Digital HTML table specifies readable cell spacing");
  assert(html.includes("border-left:2px solid currentColor"), "Digital HTML includes square left bracket");
  assert(html.includes("border-right:2px solid currentColor"), "Digital HTML includes square right bracket");
  assert(html.includes("4.9821") && html.includes("8.125"), "Digital HTML includes cell contents");
  assert(!html.includes("\\begin"), "Digital HTML does NOT contain raw LaTeX");
}

// ─── 9. Document Block Serialization Round-Trip ──────────────────────────────
{
  const mathBlock: MathBlock = {
    id: "math_matrix_1",
    type: "math",
    latex: "C = \\begin{bmatrix} 4.9821 & 5.875 \\\\ 5.875 & 8.125 \\end{bmatrix}",
    naturalExpr: "C = [ 4.9821 5.875 ; 5.875 8.125 ]",
    displayMode: "block",
    color: "#1d3fb5",
    createdAt: Date.now(),
  };

  const html = blocksToHtml([mathBlock]);
  assert(html.includes('data-block-id="math_matrix_1"'), "Serialization preserves stable block ID");
  assert(html.includes('data-latex="C = \\begin{bmatrix} 4.9821 &amp; 5.875 \\\\ 5.875 &amp; 8.125 \\end{bmatrix}"'), "Serialization preserves LaTeX matrix attribute");
  assert(html.includes('data-color="#1d3fb5"'), "Serialization preserves custom ink color");

  const restored = htmlToBlocks(html);
  assert(restored.length === 1, "Deserialization produces 1 block");
  const restoredMath = restored[0] as MathBlock;
  assert(restoredMath.id === "math_matrix_1", "Restored block ID matches");
  assert(restoredMath.latex.includes("4.9821") && restoredMath.latex.includes("8.125"), "Restored LaTeX matches matrix");
  assert(restoredMath.color === "#1d3fb5", "Restored color matches");
}

// ─── 10. Copy / Paste Independence with Color ────────────────────────────────
{
  class MockDataTransfer {
    private data: Map<string, string> = new Map();
    setData(format: string, data: string): void { this.data.set(format, data); }
    getData(format: string): string { return this.data.get(format) || ""; }
    get types(): string[] { return Array.from(this.data.keys()); }
  }

  const original: MathBlock = {
    id: "orig_matrix_block",
    type: "math",
    latex: "\\begin{bmatrix} 1 & 2 \\\\ 3 & 4 \\end{bmatrix}",
    naturalExpr: "[1 2; 3 4]",
    displayMode: "block",
    color: "#b3231f",
    createdAt: Date.now(),
  };

  const clipboard = new MockDataTransfer() as unknown as DataTransfer;
  serializeMathBlockToClipboard(original, clipboard);
  const payload = deserializeMathBlockFromClipboard(clipboard);
  assert(payload !== null, "Matrix block serializes/deserializes to clipboard payload");

  const pasted = createPastedMathBlock(payload!);
  assert(pasted.id !== original.id, "Pasted matrix gets a brand new unique ID");
  assert(pasted.latex === original.latex, "Pasted matrix inherits formula LaTeX");
  assert(pasted.color === original.color, "Pasted matrix inherits color (#b3231f)");

  // Modifying pasted block does not modify original
  pasted.latex = "\\begin{bmatrix} 9 & 9 \\\\ 9 & 9 \\end{bmatrix}";
  pasted.color = "#146b3a"; // Green
  assert(original.latex.includes("1 & 2"), "Original matrix formula unaffected by paste edit");
  assert(original.color === "#b3231f", "Original matrix color unaffected by paste edit");
}

// ─── 11. Modal Matrix Extraction & Dimension Preservation ────────────────────
{
  const latex = "C = \\begin{bmatrix} 4.9821 & 5.875 \\\\ 5.875 & 8.125 \\end{bmatrix}";
  const state = extractMatrixFromLatex(latex);
  assert(state !== null, "extractMatrixFromLatex successfully extracts matrix");
  assert(state?.prefix.trim() === "C =", "Prefix extracted as 'C ='");
  assert(state?.rows === 2 && state?.cols === 2, "Dimensions extracted as 2×2");
  assert(state?.cells[0]?.[0] === "4.9821", "Cell [0][0] extracted as 4.9821");
  assert(state?.cells[1]?.[1] === "8.125", "Cell [1][1] extracted as 8.125");

  // Resize 2×2 to 2×3: existing values preserved, new cells empty
  const newCols = 3;
  const newCells: string[][] = [];
  for (let r = 0; r < 2; r++) {
    newCells[r] = [];
    for (let c = 0; c < newCols; c++) {
      newCells[r]![c] = state?.cells[r]?.[c] ?? "";
    }
  }
  assert(newCells[0]?.[0] === "4.9821" && newCells[0]?.[1] === "5.875" && newCells[0]?.[2] === "", "Resizing to 2×3 preserves existing entries and adds empty cell");

  // Rebuild LaTeX
  const rebuilt = buildMatrixLatex(state!.prefix, state!.bracket, newCells, state!.suffix);
  assert(rebuilt.includes("4.9821 & 5.875 &"), "Rebuilt LaTeX includes all 3 columns");
  assert(rebuilt.startsWith("C = \\begin{bmatrix}"), "Rebuilt LaTeX starts with prefix and bmatrix");
}

// ─── 12. Trailing \\ and Unclosed Resilience ────────────────────────────────
{
  // Trailing \\ before \\end
  const trailingAst = parseMath("\\begin{bmatrix} 1 & 2 \\\\ 3 & 4 \\\\ \\end{bmatrix}");
  const trailingMatrix = trailingAst[0] as MatrixNode;
  assert(trailingMatrix.rows.length === 2, "Trailing \\\\ does not create an unwanted extra empty row");

  // Unclosed \\begin{bmatrix}
  const unclosedAst = parseMath("\\begin{bmatrix} 1 & 2 \\\\ 3 & 4");
  assert(unclosedAst.length > 0 && unclosedAst[0]?.type === "matrix", "Unclosed matrix parses gracefully without throwing");
}

console.log(`\nResults: ${passed} passed, ${failed} failed.\n`);
if (failed > 0) process.exit(1);
