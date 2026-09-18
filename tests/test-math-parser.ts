import { parseMath } from "../src/lib/math";
import type {
  NumberNode,
  IdentifierNode,
  FractionNode,
  SupSubNode,
  RootNode,
  FunctionNode,
  SymbolNode,
  BigOpNode,
} from "../src/lib/math";

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

console.log("\n=== Math Parser Tests ===\n");

// 1. Plain number: "3" -> NumberNode
{
  const ast = parseMath("3");
  assert(
    ast.length === 1 && ast[0]?.type === "number" && (ast[0] as NumberNode).value === "3",
    'Parse plain number: "3" → NumberNode',
  );
}

// 2. Identifier: "x" -> IdentifierNode
{
  const ast = parseMath("x");
  assert(
    ast.length === 1 && ast[0]?.type === "identifier" && (ast[0] as IdentifierNode).value === "x",
    'Parse identifier: "x" → IdentifierNode',
  );
}

// 3. \frac{a}{b} -> FractionNode
{
  const ast = parseMath("\\frac{a}{b}");
  const isFrac = ast.length === 1 && ast[0]?.type === "fraction";
  const frac = ast[0] as FractionNode;
  assert(
    isFrac &&
    frac.numerator.length === 1 && (frac.numerator[0] as IdentifierNode).value === "a" &&
    frac.denominator.length === 1 && (frac.denominator[0] as IdentifierNode).value === "b",
    "Parse \\frac{a}{b} → FractionNode",
  );
}

// 4. Nested \frac{\frac{1}{2}}{3}
{
  const ast = parseMath("\\frac{\\frac{1}{2}}{3}");
  const frac = ast[0] as FractionNode;
  const numFrac = frac?.numerator[0] as FractionNode;
  assert(
    frac?.type === "fraction" &&
    numFrac?.type === "fraction" &&
    (frac.denominator[0] as NumberNode)?.value === "3",
    "Parse nested \\frac{\\frac{1}{2}}{3}",
  );
}

// 5. x^2 -> SupSubNode (sup)
{
  const ast = parseMath("x^2");
  const supsub = ast[0] as SupSubNode;
  assert(
    supsub?.type === "supsub" &&
    supsub.sup !== undefined &&
    supsub.sub === undefined &&
    (supsub.base[0] as IdentifierNode)?.value === "x" &&
    (supsub.sup[0] as NumberNode)?.value === "2",
    "Parse x^2 → SupSubNode (sup)",
  );
}

// 6. x_1 -> SupSubNode (sub)
{
  const ast = parseMath("x_1");
  const supsub = ast[0] as SupSubNode;
  assert(
    supsub?.type === "supsub" &&
    supsub.sub !== undefined &&
    supsub.sup === undefined &&
    (supsub.base[0] as IdentifierNode)?.value === "x" &&
    (supsub.sub[0] as NumberNode)?.value === "1",
    "Parse x_1 → SupSubNode (sub)",
  );
}

// 7. x_1^2 -> SupSubNode (both)
{
  const ast = parseMath("x_1^2");
  const supsub = ast[0] as SupSubNode;
  assert(
    supsub?.type === "supsub" &&
    supsub.sub !== undefined &&
    supsub.sup !== undefined &&
    (supsub.base[0] as IdentifierNode)?.value === "x" &&
    (supsub.sub[0] as NumberNode)?.value === "1" &&
    (supsub.sup[0] as NumberNode)?.value === "2",
    "Parse x_1^2 → SupSubNode (both)",
  );
}

// 8. \sqrt{x} -> RootNode
{
  const ast = parseMath("\\sqrt{x}");
  const root = ast[0] as RootNode;
  assert(
    root?.type === "root" &&
    root.index === undefined &&
    root.radicand.length === 1 &&
    (root.radicand[0] as IdentifierNode)?.value === "x",
    "Parse \\sqrt{x} → RootNode",
  );
}

// 9. \sqrt[3]{8} -> RootNode with index
{
  const ast = parseMath("\\sqrt[3]{8}");
  const root = ast[0] as RootNode;
  assert(
    root?.type === "root" &&
    root.index !== undefined &&
    (root.index[0] as NumberNode)?.value === "3" &&
    (root.radicand[0] as NumberNode)?.value === "8",
    "Parse \\sqrt[3]{8} → RootNode with index",
  );
}

// 10. \sqrt{a^2 + b^2}
{
  const ast = parseMath("\\sqrt{a^2 + b^2}");
  const root = ast[0] as RootNode;
  assert(
    root?.type === "root" && root.radicand.length > 1,
    "Parse \\sqrt{a^2 + b^2}",
  );
}

// 11. \log_2(x) -> SupSubNode wrapping FunctionNode with sub
{
  const ast = parseMath("\\log_2(x)");
  const supsub = ast[0] as SupSubNode;
  const fn = supsub?.base?.[0] as FunctionNode;
  assert(
    supsub?.type === "supsub" &&
    fn?.type === "function" &&
    fn.name === "log" &&
    supsub.sub !== undefined &&
    (supsub.sub[0] as NumberNode)?.value === "2",
    "Parse \\log_2(x) → FunctionNode with subscript",
  );
}

// 12. \alpha, \beta, \theta, \Sigma -> SymbolNode
{
  const ast = parseMath("\\alpha \\beta \\theta \\Sigma");
  const greekSymbols = ast.filter((n) => n.type === "symbol") as SymbolNode[];
  assert(
    greekSymbols.length === 4 &&
    greekSymbols[0]?.symbol === "α" &&
    greekSymbols[1]?.symbol === "β" &&
    greekSymbols[2]?.symbol === "θ" &&
    greekSymbols[3]?.symbol === "Σ",
    "Parse \\alpha, \\beta, \\theta, \\Sigma → SymbolNode",
  );
}

// 13. \leq, \geq, \neq, \approx, \infty -> SymbolNode
{
  const ast = parseMath("\\leq \\geq \\neq \\approx \\infty");
  const symbols = ast.filter((n) => n.type === "symbol") as SymbolNode[];
  assert(
    symbols.length === 5 &&
    symbols[0]?.symbol === "≤" &&
    symbols[1]?.symbol === "≥" &&
    symbols[2]?.symbol === "≠" &&
    symbols[3]?.symbol === "≈" &&
    symbols[4]?.symbol === "∞",
    "Parse \\leq, \\geq, \\neq, \\approx, \\infty → SymbolNode",
  );
}

// 14. \sum_{i=0}^{n} -> BigOpNode
{
  const ast = parseMath("\\sum_{i=0}^{n}");
  const op = ast[0] as BigOpNode;
  assert(
    op?.type === "bigOp" &&
    op.operator === "sum" &&
    op.lower !== undefined &&
    op.upper !== undefined,
    "Parse \\sum_{i=0}^{n} → BigOpNode",
  );
}

// 15. \int_a^b -> BigOpNode
{
  const ast = parseMath("\\int_a^b");
  const op = ast[0] as BigOpNode;
  assert(
    op?.type === "bigOp" &&
    op.operator === "integral" &&
    op.lower !== undefined &&
    op.upper !== undefined,
    "Parse \\int_a^b → BigOpNode",
  );
}

// 16. Full entropy formula: Entropy(S) = - \frac{3}{8} \log_2(\frac{3}{8}) - \frac{5}{8} \log_2(\frac{5}{8})
{
  const formula = "Entropy(S) = - \\frac{3}{8} \\log_2(\\frac{3}{8}) - \\frac{5}{8} \\log_2(\\frac{5}{8})";
  const ast = parseMath(formula);
  const fracs = ast.flatMap((n) => {
    const list = [n];
    if (n.type === "grouped") list.push(...n.body);
    return list;
  }).filter((n) => n.type === "fraction");
  assert(
    ast.length > 0 && fracs.length >= 2,
    "Parse full entropy formula",
  );
}

// 17. Resilient parse of unknown \unknown{x}
{
  const ast = parseMath("\\unknown{x}");
  assert(
    ast.length > 0 && ast[0]?.type === "identifier",
    "Resilient parse of unknown \\unknown{x}",
  );
}

// 18. Resilient parse of unclosed \frac{a
{
  const ast = parseMath("\\frac{a");
  assert(
    ast.length > 0 && ast[0]?.type === "fraction",
    "Resilient parse of unclosed \\frac{a",
  );
}

console.log(`\nResults: ${passed} passed, ${failed} failed.\n`);
if (failed > 0) process.exit(1);
