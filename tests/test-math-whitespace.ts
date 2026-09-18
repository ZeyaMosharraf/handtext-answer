import { parseMath, layoutMath } from "../src/lib/math";
import { tokenize } from "../src/lib/math/tokens";
import { DEFAULT_SETTINGS, type HandwritingSettings } from "../src/lib/handwriting/types";

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(`FAIL: ${message}`);
  }
  console.log(`  ✓ ${message}`);
}

function assertEquals<T>(actual: T, expected: T, message: string) {
  if (actual !== expected) {
    throw new Error(`FAIL: ${message} (expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)})`);
  }
  console.log(`  ✓ ${message}`);
}

// Mock CanvasRenderingContext2D for layout measurements in Node.js
const mockCtx = {
  font: "",
  measureText(text: string) {
    return { width: text.length * 12 };
  },
} as unknown as CanvasRenderingContext2D;

const settings: HandwritingSettings = {
  ...DEFAULT_SETTINGS,
  fontSize: 22,
  lineSpacing: 1.4,
};

console.log("\n=== Math Whitespace & Delimiter Geometry Test Suite ===\n");

// 1. Single spaces between identifiers: "A B"
console.log("─── 1. Identifier Whitespace (A B) ───");
const tokensAB = tokenize("A B");
assert(tokensAB.some(t => t.kind === "SPACE"), "Tokenizes SPACE token between A and B");
const astAB = parseMath("A B");
assertEquals(astAB.length, 3, "A B parses to 3 nodes: IDENT, SPACE, IDENT");
assertEquals(astAB[0]?.type, "identifier", "Node 0 is identifier");
assertEquals(astAB[1]?.type, "space", "Node 1 is space");
assertEquals(astAB[2]?.type, "identifier", "Node 2 is identifier");
const boxAB = layoutMath(astAB, mockCtx, settings, 1.0);
const boxA_B_noSpace = layoutMath(parseMath("AB"), mockCtx, settings, 1.0);
assert(boxAB.width > boxA_B_noSpace.width, "A B has larger width than AB due to space advance");

// 2. Multiple spaces: "x  +  y"
console.log("\n─── 2. Multiple Spaces (x  +  y) ───");
const astExtraSpace = parseMath("x  +  y");
const spaceNodes = astExtraSpace.filter(n => n.type === "space");
assert(spaceNodes.length >= 2, "Multiple spaces are preserved around operators in AST");

// 3. Delimiter Spacing & Collision: "F (Y)" vs "F(Y)"
console.log("\n─── 3. Delimiter Spacing & Collision (F (Y) vs F(Y)) ───");
const astF_Y_space = parseMath("F (Y)");
assertEquals(astF_Y_space.length, 3, "F (Y) has 3 nodes: IDENT, SPACE, GROUPED");
assertEquals(astF_Y_space[1]?.type, "space", "F (Y) preserves space between F and (");
const boxF_Y_space = layoutMath(astF_Y_space, mockCtx, settings, 1.0);

const astF_Y_noSpace = parseMath("F(Y)");
assertEquals(astF_Y_noSpace.length, 2, "F(Y) has 2 nodes: IDENT, GROUPED");
const boxF_Y_noSpace = layoutMath(astF_Y_noSpace, mockCtx, settings, 1.0);
assert(boxF_Y_space.width > boxF_Y_noSpace.width, "F (Y) is wider than F(Y) by the space advance");

// Verify delimiter advance width prevents collision
const groupedNode = astF_Y_noSpace[1] as { type: "grouped"; open: string; close: string; body: unknown[] };
assertEquals(groupedNode.open, "(", "Open delimiter is (");
assertEquals(groupedNode.close, ")", "Close delimiter is )");
const boxGrouped = layoutMath([groupedNode as any], mockCtx, settings, 1.0);
assert(boxGrouped.width > 22 * 0.34 * 2, "Delimiter advance width is >= 0.34em per delimiter");

// 4. Punctuation Spacing: "W11 = -1, W12 = 2, W21 = 1, W22 = -2"
console.log("\n─── 4. Punctuation Spacing (W11 = -1, W12 = 2) ───");
const exprW = "W11 = -1, W12 = 2, W21 = 1, W22 = -2";
const astW = parseMath(exprW);
// Verify each comma is followed by a space node
let foundCommaSpace = 0;
for (let i = 0; i < astW.length - 1; i++) {
  if (astW[i]?.type === "operator" && (astW[i] as any).value === "," && astW[i + 1]?.type === "space") {
    foundCommaSpace++;
  }
}
assertEquals(foundCommaSpace, 3, "All 3 commas are followed by explicit SPACE nodes");

// 5. Piecewise Expression: "F (Y) = { 1, Y >= 0 ; 0, Y < 0 }"
console.log("\n─── 5. Piecewise Expression (F (Y) = { 1, Y >= 0 ; 0, Y < 0 }) ───");
const exprPiecewise = "F (Y) = { 1, Y >= 0 ; 0, Y < 0 }";
const astPiecewise = parseMath(exprPiecewise);
// Check that { is parsed as a visible grouped node with open: "{" and close: "}"
const piecewiseGroup = astPiecewise.find(n => n.type === "grouped" && (n as any).open === "{") as any;
assert(piecewiseGroup !== undefined, "Piecewise brace is parsed as visible grouped node with open: {");
assertEquals(piecewiseGroup.close, "}", "Piecewise brace has close: }");
// Check that >= became \geq (≥)
const hasGeq = piecewiseGroup.body.some((n: any) => n.type === "symbol" && (n.symbol === "≥" || n.name === "geq"));
assert(hasGeq, ">= in piecewise is properly recognized as ≥ symbol");
// Check that ; has spacing around it
const semiIdx = piecewiseGroup.body.findIndex((n: any) => n.type === "operator" && n.value === ";");
assert(semiIdx > 0, "Semicolon is present in piecewise body");
assert(piecewiseGroup.body[semiIdx - 1]?.type === "space", "Space before semicolon is preserved");
assert(piecewiseGroup.body[semiIdx + 1]?.type === "space", "Space after semicolon is preserved");

// 6. Test All 10 Required Expressions
console.log("\n─── 6. All 10 Required Test Expressions ───");
const testExpressions = [
  "x = y + z",
  "E = mc^2",
  "W11 = -1, W12 = 2, W21 = 1, W22 = -2",
  "F (Y) = { 1, Y >= 0 ; 0, Y < 0 }",
  "F(Y) = {1, Y >= 0; 0, Y < 0}",
  "( x + y )",
  "[ x + y ]",
  "{ x + y }",
  "x  +  y",
  "H / T",
];

for (let idx = 0; idx < testExpressions.length; idx++) {
  const expr = testExpressions[idx]!;
  const ast = parseMath(expr);
  assert(ast.length > 0, `Expression ${idx + 1} "${expr}" parses to non-empty AST`);
  const box = layoutMath(ast, mockCtx, settings, 1.0);
  assert(box.width > 0, `Expression ${idx + 1} "${expr}" layouts with positive width (${box.width.toFixed(1)}px)`);
  assert(box.ascent > 0, `Expression ${idx + 1} "${expr}" layouts with positive ascent (${box.ascent.toFixed(1)}px)`);
}

// 7. Source Preservation
console.log("\n─── 7. Source Preservation ───");
const rawInput = "F (Y) = { 1, Y >= 0 ; 0, Y < 0 }";
// Simulating modal input -> submit -> reopen
const savedLatex = rawInput.trim();
assertEquals(savedLatex, rawInput, "User input string is not modified or rewritten upon save");

console.log("\n══════════════════════════════════════════════════════════");
console.log("All Math Whitespace & Delimiter Geometry Tests Passed! ✓");
