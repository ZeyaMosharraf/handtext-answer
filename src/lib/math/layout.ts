/**
 * layout.ts — 2D math layout engine.
 *
 * Converts a MathNode[] AST into a MathLayoutBox tree.
 * Each MathLayoutBox knows its width/ascent/descent and can draw itself to canvas.
 *
 * Scale inheritance follows the architecture spec:
 *   Root         → 1.0 × base
 *   Fractions    → 0.80 × parent
 *   Scripts      → 0.70 × parent
 *   n-th root    → 0.55 × parent
 *   Minimum      → 0.60 × base (clamped)
 */

import type { HandwritingSettings } from "../handwriting/types";
import type {
  MathNode,
  NumberNode,
  IdentifierNode,
  OperatorNode,
  SymbolNode,
  FractionNode,
  SupSubNode,
  RootNode,
  FunctionNode,
  GroupedNode,
  BigOpNode,
  SpaceNode,
  MathLayoutBox,
} from "./types";
import { drawGlyph, hasGlyph, GLYPH_MAP } from "./glyphs";
import { writeSegments, inkLine, type PenOptions } from "../handwriting/pen";

// ─── Minimum scale clamp ──────────────────────────────────────────────────────

const MIN_SCALE = 0.60;
const FRACTION_SCALE = 0.80;
const SCRIPT_SCALE = 0.70;
const INDEX_SCALE = 0.55;

function clampedScale(scale: number, base: number): number {
  return Math.max(MIN_SCALE, scale / base) * base;
}

// ─── Canvas font helpers ──────────────────────────────────────────────────────

function setFont(
  ctx: CanvasRenderingContext2D,
  settings: HandwritingSettings,
  size: number,
  italic = false,
) {
  ctx.font = `${italic ? "italic " : ""}${size}px "${settings.fontFamily}", cursive`;
}

function measureGlyphWidth(
  ctx: CanvasRenderingContext2D,
  settings: HandwritingSettings,
  char: string,
  size: number,
  italic = false,
): number {
  setFont(ctx, settings, size, italic);
  return (
    ctx.measureText(char).width * settings.compactness +
    char.length * settings.letterSpacing
  );
}

function measureTextWidth(
  ctx: CanvasRenderingContext2D,
  settings: HandwritingSettings,
  text: string,
  size: number,
): number {
  if (!text) return 0;
  setFont(ctx, settings, size, false);
  return (
    ctx.measureText(text).width * settings.compactness +
    text.length * settings.letterSpacing
  );
}

// ─── Operator spacing ─────────────────────────────────────────────────────────

const OP_SPACING_EM = 0.22; // em on each side of binary operators

// ─── Layout node helpers ──────────────────────────────────────────────────────

function makeBox(
  type: string,
  width: number,
  ascent: number,
  descent: number,
  drawFn: MathLayoutBox["draw"],
  children?: MathLayoutBox["children"],
): MathLayoutBox {
  const box: MathLayoutBox = { type, width, ascent, descent, draw: drawFn };
  if (children !== undefined) box.children = children;
  return box;
}

// ─── Top-level layoutMath ─────────────────────────────────────────────────────

/**
 * Layout a sequence of MathNodes into a single MathLayoutBox
 * representing a horizontal run of math content.
 */
export function layoutMath(
  ast: MathNode[],
  ctx: CanvasRenderingContext2D,
  settings: HandwritingSettings,
  scale = 1.0,
): MathLayoutBox {
  const baseSize = settings.fontSize;
  return layoutSequence(ast, ctx, settings, baseSize, scale);
}

/**
 * Layout a list of nodes side-by-side (horizontal concatenation).
 */
function layoutSequence(
  nodes: MathNode[],
  ctx: CanvasRenderingContext2D,
  settings: HandwritingSettings,
  baseSize: number,
  scale: number,
): MathLayoutBox {
  const boxes = nodes.map((n) => layoutNode(n, ctx, settings, baseSize, scale));

  const totalWidth = boxes.reduce((w, b) => w + b.width, 0);
  const maxAscent = boxes.reduce((a, b) => Math.max(a, b.ascent), 0);
  const maxDescent = boxes.reduce((d, b) => Math.max(d, b.descent), 0);

  return makeBox(
    "sequence",
    totalWidth,
    maxAscent,
    maxDescent,
    (ctx, originX, baselineY, settings, random, ink) => {
      let x = originX;
      for (const box of boxes) {
        box.draw(ctx, x, baselineY, settings, random, ink);
        x += box.width;
      }
    },
    boxes.map((b, i) => {
      const dx = boxes.slice(0, i).reduce((w, b) => w + b.width, 0);
      return { box: b, dx, dy: 0 };
    }),
  );
}

// ─── Individual node layout functions ────────────────────────────────────────

function layoutNode(
  node: MathNode,
  ctx: CanvasRenderingContext2D,
  settings: HandwritingSettings,
  baseSize: number,
  scale: number,
): MathLayoutBox {
  switch (node.type) {
    case "number":    return layoutNumber(node, ctx, settings, baseSize, scale);
    case "identifier": return layoutIdentifier(node, ctx, settings, baseSize, scale);
    case "operator":  return layoutOperator(node, ctx, settings, baseSize, scale);
    case "symbol":    return layoutSymbol(node, ctx, settings, baseSize, scale);
    case "fraction":  return layoutFraction(node, ctx, settings, baseSize, scale);
    case "supsub":    return layoutSupSub(node, ctx, settings, baseSize, scale);
    case "root":      return layoutRoot(node, ctx, settings, baseSize, scale);
    case "function":  return layoutFunction(node, ctx, settings, baseSize, scale);
    case "grouped":   return layoutGrouped(node, ctx, settings, baseSize, scale);
    case "bigOp":     return layoutBigOp(node, ctx, settings, baseSize, scale);
    case "space":     return layoutSpace(node, baseSize, scale);
    default:
      return makeBox("unknown", 0, 0, 0, () => {});
  }
}

// ─── Number ───────────────────────────────────────────────────────────────────

function layoutNumber(
  node: NumberNode,
  ctx: CanvasRenderingContext2D,
  settings: HandwritingSettings,
  baseSize: number,
  scale: number,
): MathLayoutBox {
  const size = baseSize * scale;
  const w = measureTextWidth(ctx, settings, node.value, size);
  const ascent = size * 0.72;
  const descent = size * 0.18;

  return makeBox("number", w, ascent, descent, (ctx, x, y, settings, random, ink) => {
    const seg = { text: node.value, bold: false, underline: false, italic: false };
    const pen: PenOptions = { size, color: ink, scale: 1 };
    writeSegments(ctx, [seg], settings, x, y, random, pen);
  });
}

// ─── Identifier ───────────────────────────────────────────────────────────────

function layoutIdentifier(
  node: IdentifierNode,
  ctx: CanvasRenderingContext2D,
  settings: HandwritingSettings,
  baseSize: number,
  scale: number,
): MathLayoutBox {
  const size = baseSize * scale;
  // Math identifiers are italic by convention
  const italic = /^[a-zA-Z]$/.test(node.value);
  setFont(ctx, settings, size, italic);
  const w = measureGlyphWidth(ctx, settings, node.value, size, italic);
  const ascent = size * 0.72;
  const descent = italic ? size * 0.14 : size * 0.18;
  const text = node.value;

  return makeBox("identifier", w, ascent, descent, (ctx, x, y, settings, random, ink) => {
    const seg = { text, bold: false, underline: false, italic };
    const pen: PenOptions = { size, color: ink, scale: 1 };
    writeSegments(ctx, [seg], settings, x, y, random, pen);
  });
}

// ─── Operator ─────────────────────────────────────────────────────────────────

function layoutOperator(
  node: OperatorNode,
  ctx: CanvasRenderingContext2D,
  settings: HandwritingSettings,
  baseSize: number,
  scale: number,
): MathLayoutBox {
  const size = baseSize * scale;
  const spacing = baseSize * scale * OP_SPACING_EM;
  const glyphW = measureTextWidth(ctx, settings, node.value, size);
  const w = glyphW + spacing * 2;
  const ascent = size * 0.72;
  const descent = size * 0.18;
  const text = node.value;

  return makeBox("operator", w, ascent, descent, (ctx, x, y, settings, random, ink) => {
    const seg = { text, bold: false, underline: false, italic: false };
    const pen: PenOptions = { size, color: ink, scale: 1 };
    writeSegments(ctx, [seg], settings, x + spacing, y, random, pen);
  });
}

// ─── Symbol ───────────────────────────────────────────────────────────────────

function layoutSymbol(
  node: SymbolNode,
  ctx: CanvasRenderingContext2D,
  settings: HandwritingSettings,
  baseSize: number,
  scale: number,
): MathLayoutBox {
  const size = baseSize * scale;

  // Try custom vector glyph path first
  if (hasGlyph(node.name) || hasGlyph(node.symbol)) {
    const key = hasGlyph(node.name) ? node.name : node.symbol;
    // Measure by running a dry-run on an offscreen canvas
    // For now use heuristic widths that match glyph geometry
    const glyphWidths: Record<string, number> = {
      alpha: 0.64, beta: 0.56, theta: 0.56, lambda: 0.58, pi: 0.60,
      mu: 0.58, sigma: 0.62, omega: 0.62, Sigma: 0.60, Delta: 0.62,
      sum: 0.60, infty: 0.66, int: 0.35, oint: 0.35,
      leq: 0.48, geq: 0.48, neq: 0.52, approx: 0.52,
      pm: 0.48, partial: 0.44,
    };
    const relW = glyphWidths[key] ?? 0.60;
    const w = size * relW;
    const glyphAscents: Record<string, number> = {
      Sigma: 0.72, Delta: 0.70, sum: 0.80, int: 0.95, oint: 0.95,
      infty: 0.40, beta: 0.82, partial: 0.70,
    };
    const glyphDescents: Record<string, number> = {
      beta: 0.24, mu: 0.22, int: 0.12, oint: 0.12,
    };
    const ascent = size * (glyphAscents[key] ?? 0.52);
    const descent = size * (glyphDescents[key] ?? 0);

    return makeBox("symbol", w, ascent, descent, (ctx, x, y, settings, random, ink) => {
      drawGlyph(key, ctx, x, y, size, settings, random, ink);
    });
  }

  // Fallback: try to render with font, add jitter to hide system-font digital look
  setFont(ctx, settings, size, false);
  const w = Math.max(
    size * 0.5,
    ctx.measureText(node.symbol).width * settings.compactness + settings.letterSpacing,
  );
  const ascent = size * 0.72;
  const descent = size * 0.18;
  const symbol = node.symbol;

  return makeBox("symbol-fallback", w, ascent, descent, (ctx, x, y, settings, random, ink) => {
    ctx.save();
    setFont(ctx, settings, size, false);
    ctx.fillStyle = ink;
    ctx.globalAlpha = Math.min(1, settings.inkIntensity * 0.9);
    ctx.textBaseline = "alphabetic";
    // Apply modest jitter to reduce the "digital" look
    const jitterX = (random() - 0.5) * 1.5;
    const jitterY = (random() - 0.5) * 1.5;
    const rotation = (random() - 0.5) * 0.015;
    ctx.save();
    ctx.translate(x + jitterX, y + jitterY);
    ctx.rotate(rotation);
    ctx.fillText(symbol, 0, 0);
    ctx.restore();
    ctx.restore();
  });
}

// ─── Fraction ─────────────────────────────────────────────────────────────────

function layoutFraction(
  node: FractionNode,
  ctx: CanvasRenderingContext2D,
  settings: HandwritingSettings,
  baseSize: number,
  scale: number,
): MathLayoutBox {
  const childScale = Math.max(MIN_SCALE, scale * FRACTION_SCALE);
  const numBox = layoutSequence(node.numerator, ctx, settings, baseSize, childScale);
  const denBox = layoutSequence(node.denominator, ctx, settings, baseSize, childScale);

  const padX = baseSize * scale * 0.1;
  const barW = Math.max(numBox.width, denBox.width) + padX * 2;
  const gapY = baseSize * scale * 0.12;
  // Math axis: ~0.28 × size above baseline
  const axisY = -(baseSize * scale * 0.28);
  // Fraction bar y coordinate
  const barY = axisY;

  const numBaselineY = barY - gapY - numBox.descent;
  const denBaselineY = barY + gapY + denBox.ascent;

  const ascent = -(numBaselineY - numBox.ascent);
  const descent = denBaselineY + denBox.descent;
  const numOffsetX = (barW - numBox.width) / 2;
  const denOffsetX = (barW - denBox.width) / 2;

  return makeBox(
    "fraction",
    barW,
    ascent,
    descent,
    (ctx, x, y, settings, random, ink) => {
      // Numerator
      numBox.draw(ctx, x + numOffsetX, y + numBaselineY, settings, random, ink);
      // Fraction bar
      const barWidth = Math.max(0.7, settings.penWidth * 0.65);
      inkLine(ctx, x, y + barY, x + barW, y + barY, random, ink, barWidth);
      // Denominator
      denBox.draw(ctx, x + denOffsetX, y + denBaselineY, settings, random, ink);
    },
    [
      { box: numBox, dx: numOffsetX, dy: numBaselineY },
      { box: denBox, dx: denOffsetX, dy: denBaselineY },
    ],
  );
}

// ─── Superscript & Subscript ──────────────────────────────────────────────────

function layoutSupSub(
  node: SupSubNode,
  ctx: CanvasRenderingContext2D,
  settings: HandwritingSettings,
  baseSize: number,
  scale: number,
): MathLayoutBox {
  const scriptScale = Math.max(MIN_SCALE, scale * SCRIPT_SCALE);
  const baseBox = layoutSequence(node.base, ctx, settings, baseSize, scale);
  const supBox = node.sup ? layoutSequence(node.sup, ctx, settings, baseSize, scriptScale) : null;
  const subBox = node.sub ? layoutSequence(node.sub, ctx, settings, baseSize, scriptScale) : null;

  const kern = baseSize * scale * 0.06;
  const supOffsetY = -(baseBox.ascent * 0.65);
  const subOffsetY = baseBox.descent + baseSize * scriptScale * 0.2;

  const scriptWidth = Math.max(supBox?.width ?? 0, subBox?.width ?? 0);
  const totalWidth = baseBox.width + kern + scriptWidth;

  const ascent = supBox
    ? Math.max(baseBox.ascent, -supOffsetY + supBox.ascent)
    : baseBox.ascent;
  const descent = subBox
    ? Math.max(baseBox.descent, subOffsetY + subBox.descent)
    : baseBox.descent;

  return makeBox(
    "supsub",
    totalWidth,
    ascent,
    descent,
    (ctx, x, y, settings, random, ink) => {
      baseBox.draw(ctx, x, y, settings, random, ink);
      const scriptX = x + baseBox.width + kern;
      if (supBox) supBox.draw(ctx, scriptX, y + supOffsetY, settings, random, ink);
      if (subBox) subBox.draw(ctx, scriptX, y + subOffsetY, settings, random, ink);
    },
  );
}

// ─── Root / Square Root ───────────────────────────────────────────────────────

function layoutRoot(
  node: RootNode,
  ctx: CanvasRenderingContext2D,
  settings: HandwritingSettings,
  baseSize: number,
  scale: number,
): MathLayoutBox {
  const radicandBox = layoutSequence(node.radicand, ctx, settings, baseSize, scale);
  const indexBox = node.index
    ? layoutSequence(node.index, ctx, settings, baseSize, Math.max(MIN_SCALE, scale * INDEX_SCALE))
    : null;

  const size = baseSize * scale;
  const padTop = size * 0.16;
  const padRight = size * 0.12;
  const tickW = size * 0.18;   // width of the short ascending tick
  const checkW = size * 0.24;  // width of the descending check stroke + ascent stroke

  const totalInnerH = radicandBox.ascent + radicandBox.descent + padTop;
  const vinculumH = -(radicandBox.ascent + padTop); // above baseline

  // Index sits in the top-left crook
  const indexOffsetX = 0;
  const indexOffsetY = vinculumH + (indexBox ? indexBox.descent : 0) - size * 0.1;
  const indexWidth = indexBox ? indexBox.width + size * 0.04 : 0;

  const radicalX = indexWidth; // where the radical symbol starts
  const radicandX = radicalX + tickW + checkW;
  const totalW = radicandX + radicandBox.width + padRight;

  const boxAscent = Math.max(
    radicandBox.ascent + padTop + size * 0.06,
    indexBox ? -indexOffsetY + indexBox.ascent : 0,
  );
  const boxDescent = radicandBox.descent;

  return makeBox(
    "root",
    totalW,
    boxAscent,
    boxDescent,
    (ctx, x, y, settings, random, ink) => {
      const sw = Math.max(0.8, settings.penWidth * 0.7);

      // Draw index (n-th root)
      if (indexBox) {
        indexBox.draw(ctx, x + indexOffsetX, y + indexOffsetY, settings, random, ink);
      }

      // Draw radical symbol: tick → plunge → ascent → vinculum
      ctx.save();
      ctx.strokeStyle = ink;
      ctx.lineWidth = sw + (Math.random() - 0.5) * 0.3;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.globalAlpha = Math.min(1, settings.inkIntensity * 0.95);
      ctx.beginPath();

      const rx = x + radicalX;
      const j = () => (Math.random() - 0.5) * 1.2;

      // Short tick at bottom of check mark
      ctx.moveTo(rx + j(), y - size * 0.1 + j());
      ctx.lineTo(rx + tickW * 0.7 + j(), y + radicandBox.descent * 0.3 + j());

      // Plunge into and up the radical check
      ctx.lineTo(rx + tickW + j(), y + radicandBox.descent * 0.5 + j());
      ctx.lineTo(rx + tickW + checkW * 0.3 + j(), y + vinculumH - padTop * 0.5 + j());

      // Vinculum (horizontal overline)
      ctx.lineTo(x + totalW - padRight + j(), y + vinculumH + j());

      ctx.stroke();
      ctx.restore();

      // Draw radicand
      radicandBox.draw(ctx, x + radicandX, y, settings, random, ink);
    },
  );
}

// ─── Function ─────────────────────────────────────────────────────────────────

function layoutFunction(
  node: FunctionNode,
  ctx: CanvasRenderingContext2D,
  settings: HandwritingSettings,
  baseSize: number,
  scale: number,
): MathLayoutBox {
  const size = baseSize * scale;

  // \text{...} renders its argument as upright plain text
  if (node.name === "text" && node.arg) {
    return layoutSequence(node.arg, ctx, settings, baseSize, scale);
  }

  // Function name is upright (non-italic) by convention
  const nameW = measureTextWidth(ctx, settings, node.name, size);
  const ascent = size * 0.72;
  const descent = size * 0.18;
  const name = node.name;

  return makeBox(
    "function",
    nameW + baseSize * scale * 0.06, // small trailing kern
    ascent,
    descent,
    (ctx, x, y, settings, random, ink) => {
      const seg = { text: name, bold: false, underline: false, italic: false };
      const pen: PenOptions = { size, color: ink, scale: 1 };
      writeSegments(ctx, [seg], settings, x, y, random, pen);
    },
  );
}

// ─── Grouped (delimited expression) ──────────────────────────────────────────

function layoutGrouped(
  node: GroupedNode,
  ctx: CanvasRenderingContext2D,
  settings: HandwritingSettings,
  baseSize: number,
  scale: number,
): MathLayoutBox {
  const bodyBox = layoutSequence(node.body, ctx, settings, baseSize, scale);
  const size = baseSize * scale;
  const delimW = node.open ? size * 0.22 : 0;
  const totalW = bodyBox.width + delimW * 2;
  const totalAscent = bodyBox.ascent;
  const totalDescent = bodyBox.descent;
  const open = node.open;
  const close = node.close;

  return makeBox(
    "grouped",
    totalW,
    totalAscent,
    totalDescent,
    (ctx, x, y, settings, random, ink) => {
      const sw = Math.max(0.8, settings.penWidth * 0.65);

      if (open) {
        drawDelimiter(ctx, x, y, totalAscent, totalDescent, open, size, settings, random, ink, sw);
      }
      bodyBox.draw(ctx, x + delimW, y, settings, random, ink);
      if (close && close !== open) {
        drawDelimiter(
          ctx, x + delimW + bodyBox.width, y, totalAscent, totalDescent,
          close, size, settings, random, ink, sw,
        );
      } else if (close === open && open === "|") {
        // Second pipe
        drawDelimiter(
          ctx, x + delimW + bodyBox.width, y, totalAscent, totalDescent,
          close!, size, settings, random, ink, sw,
        );
      }
    },
  );
}

function drawDelimiter(
  ctx: CanvasRenderingContext2D,
  x: number,
  baselineY: number,
  ascent: number,
  descent: number,
  delim: string,
  size: number,
  settings: HandwritingSettings,
  random: () => number,
  ink: string,
  sw: number,
) {
  const top = baselineY - ascent;
  const bottom = baselineY + descent;
  const cx = x + size * 0.1;

  ctx.save();
  ctx.strokeStyle = ink;
  ctx.lineWidth = sw;
  ctx.lineCap = "round";
  ctx.globalAlpha = Math.min(1, settings.inkIntensity * 0.92);
  ctx.beginPath();

  const j = () => (random() - 0.5) * 1.0;

  if (delim === "(" || delim === "[" || delim === "{") {
    // Left-facing bracket: straight for [, curved for (, angular for {
    if (delim === "(") {
      ctx.moveTo(cx + size * 0.1 + j(), top + j());
      ctx.bezierCurveTo(cx - size * 0.05, (top + bottom) * 0.35, cx - size * 0.05, (top + bottom) * 0.65, cx + size * 0.1 + j(), bottom + j());
    } else if (delim === "[") {
      ctx.moveTo(cx + j(), top + j());
      ctx.lineTo(cx - size * 0.08 + j(), top + j());
      ctx.moveTo(cx - size * 0.08 + j(), top + j());
      ctx.lineTo(cx - size * 0.08 + j(), bottom + j());
      ctx.moveTo(cx - size * 0.08 + j(), bottom + j());
      ctx.lineTo(cx + j(), bottom + j());
    } else {
      // Curly { — top half
      const mid = (top + bottom) / 2;
      ctx.moveTo(cx + size * 0.08, top + j());
      ctx.bezierCurveTo(cx - size * 0.04, top + j(), cx - size * 0.12, mid - size * 0.06, cx - size * 0.14, mid + j());
      ctx.bezierCurveTo(cx - size * 0.12, mid + size * 0.06, cx - size * 0.04, bottom + j(), cx + size * 0.08, bottom + j());
    }
  } else if (delim === ")" || delim === "]" || delim === "}") {
    if (delim === ")") {
      ctx.moveTo(cx - size * 0.1 + j(), top + j());
      ctx.bezierCurveTo(cx + size * 0.05, (top + bottom) * 0.35, cx + size * 0.05, (top + bottom) * 0.65, cx - size * 0.1 + j(), bottom + j());
    } else if (delim === "]") {
      ctx.moveTo(cx + size * 0.08 + j(), top + j());
      ctx.lineTo(cx + size * 0.16 + j(), top + j());
      ctx.moveTo(cx + size * 0.16 + j(), top + j());
      ctx.lineTo(cx + size * 0.16 + j(), bottom + j());
      ctx.moveTo(cx + size * 0.16 + j(), bottom + j());
      ctx.lineTo(cx + size * 0.08 + j(), bottom + j());
    } else {
      const mid = (top + bottom) / 2;
      ctx.moveTo(cx - size * 0.08, top + j());
      ctx.bezierCurveTo(cx + size * 0.04, top + j(), cx + size * 0.12, mid - size * 0.06, cx + size * 0.14, mid + j());
      ctx.bezierCurveTo(cx + size * 0.12, mid + size * 0.06, cx + size * 0.04, bottom + j(), cx - size * 0.08, bottom + j());
    }
  } else if (delim === "|") {
    ctx.moveTo(cx + j(), top + j());
    ctx.lineTo(cx + j(), bottom + j());
  }

  ctx.stroke();
  ctx.restore();
}

// ─── Big Operators ────────────────────────────────────────────────────────────

function layoutBigOp(
  node: BigOpNode,
  ctx: CanvasRenderingContext2D,
  settings: HandwritingSettings,
  baseSize: number,
  scale: number,
): MathLayoutBox {
  const scriptScale = Math.max(MIN_SCALE, scale * SCRIPT_SCALE);
  const opSize = baseSize * scale * 1.35; // big operators are larger than body text

  // Lay out the operator symbol
  const opSymbol = node.operator === "sum" ? "Sigma" :
    node.operator === "prod" ? "Pi" :
    node.operator === "integral" || node.operator === "oint" ? "int" : "Sigma";

  // Layout the symbol via a synthetic SymbolNode
  const symNode = { type: "symbol" as const, symbol: node.operator === "sum" ? "Σ" : node.operator === "prod" ? "Π" : "∫", name: opSymbol };
  const symBox = layoutSymbol(symNode, ctx, settings, baseSize, scale * 1.35);

  const limLower = node.lower
    ? layoutSequence(node.lower, ctx, settings, baseSize, scriptScale)
    : null;
  const limUpper = node.upper
    ? layoutSequence(node.upper, ctx, settings, baseSize, scriptScale)
    : null;

  const limW = Math.max(symBox.width, limLower?.width ?? 0, limUpper?.width ?? 0);
  const totalW = limW + baseSize * scale * 0.08;

  const upperH = limUpper ? limUpper.ascent + limUpper.descent + baseSize * scale * 0.06 : 0;
  const lowerH = limLower ? limLower.ascent + limLower.descent + baseSize * scale * 0.06 : 0;

  const ascent = symBox.ascent + upperH;
  const descent = symBox.descent + lowerH;

  const symOffsetX = (limW - symBox.width) / 2;
  const upperOffsetX = limUpper ? (limW - limUpper.width) / 2 : 0;
  const lowerOffsetX = limLower ? (limW - limLower.width) / 2 : 0;

  return makeBox(
    "bigOp",
    totalW,
    ascent,
    descent,
    (ctx, x, y, settings, random, ink) => {
      // Upper limit
      if (limUpper) {
        const upperBaselineY = y - symBox.ascent - baseSize * scale * 0.04 - limUpper.descent;
        limUpper.draw(ctx, x + upperOffsetX, upperBaselineY, settings, random, ink);
      }
      // Operator
      symBox.draw(ctx, x + symOffsetX, y, settings, random, ink);
      // Lower limit
      if (limLower) {
        const lowerBaselineY = y + symBox.descent + baseSize * scale * 0.04 + limLower.ascent;
        limLower.draw(ctx, x + lowerOffsetX, lowerBaselineY, settings, random, ink);
      }
    },
  );
}

// ─── Space ────────────────────────────────────────────────────────────────────

function layoutSpace(
  node: SpaceNode,
  baseSize: number,
  scale: number,
): MathLayoutBox {
  const w = Math.max(0, baseSize * scale * node.widthEm);
  return makeBox("space", w, 0, 0, () => {});
}

// ─── lineUnits calculation ────────────────────────────────────────────────────

/**
 * Compute the integer number of ruled-line units that a math layout box
 * occupies. Math blocks are always atomic — lineUnits ≥ 1.
 *
 * @param box        The math layout box to measure
 * @param rulingSpacing The spacing between ruled lines (in canvas px)
 * @param padding    Extra padding above/below the box
 */
export function computeLineUnits(
  box: MathLayoutBox,
  rulingSpacing: number,
  padding = 0,
): number {
  const totalH = box.ascent + box.descent + 2 * padding;
  return Math.max(1, Math.ceil(totalH / rulingSpacing));
}
