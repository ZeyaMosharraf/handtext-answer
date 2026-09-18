import { parseMath, layoutMath } from "../src/lib/math";
import { DEFAULT_SETTINGS, type HandwritingSettings } from "../src/lib/handwriting/types";
import { makeRng } from "../src/lib/handwriting/pen";

const drawEvents: Array<{ type: string; text?: string; delim?: string; x: number; y: number; width?: number }> = [];

const mockCtx = {
  font: "",
  measureText(text: string) {
    return { width: text.length * 11 };
  },
  save() {},
  restore() {},
  beginPath() {},
  stroke() {},
  moveTo() {},
  lineTo() {},
  bezierCurveTo() {},
  setLineDash() {},
  clearRect() {},
  scale() {},
  fillText() {},
} as unknown as CanvasRenderingContext2D;

const settings: HandwritingSettings = {
  ...DEFAULT_SETTINGS,
  fontSize: 22,
  lineSpacing: 1.4,
};

const rng = makeRng(42);

function inspectDraw(expr: string) {
  console.log(`\n======================================================`);
  console.log(`EXPR: "${expr}"`);
  console.log(`======================================================`);
  const ast = parseMath(expr);
  console.log("AST Summary:", ast.map(n => {
    if (n.type === "grouped") return `grouped[${n.open}...${n.close}](${n.body.length} items)`;
    if (n.type === "operator") return `op(${n.value})`;
    if (n.type === "identifier") return `id(${n.value})`;
    if (n.type === "number") return `num(${n.value})`;
    if (n.type === "space") return `space(${n.widthEm}em)`;
    if (n.type === "symbol") return `sym(${n.symbol})`;
    return n.type;
  }).join(" "));

  const box = layoutMath(ast, mockCtx, settings, 1.0);
  console.log(`Total Layout Box Width: ${box.width.toFixed(2)}px, Ascent: ${box.ascent.toFixed(2)}px, Descent: ${box.descent.toFixed(2)}px`);
}

inspectDraw("F (Y) = { 1, Y >= 0 ; 0, Y < 0 }");
inspectDraw("F(Y) = {1, Y >= 0; 0, Y < 0}");
inspectDraw("W11 = -1, W12 = 2, W21 = 1, W22 = -2");
inspectDraw("x = y + z");
inspectDraw("x  +  y");
inspectDraw("( x + y )");
inspectDraw("[ x + y ]");
inspectDraw("{ x + y }");
inspectDraw("H / T");
