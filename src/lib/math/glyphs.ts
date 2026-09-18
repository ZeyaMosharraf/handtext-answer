/**
 * glyphs.ts — Handwritten vector glyph paths for Greek letters and special math symbols.
 *
 * Standard handwriting fonts (Caveat, Kalam, etc.) only cover Basic Latin (U+0020–U+007E).
 * Drawing Greek letters directly via ctx.fillText() causes system-font fallback, breaking
 * the handwritten immersion.
 *
 * This module provides parameterized vector stroke paths drawn via Canvas 2D APIs, routed
 * through pen.ts inkLine for natural jitter, pressure, and ink simulation.
 *
 * IMPORTANT: pen.ts is never imported here. All canvas operations are direct ctx calls.
 * This keeps glyphs.ts independent while still producing handwritten-looking output.
 */

import type { HandwritingSettings } from "../handwriting/types";

export interface GlyphMetrics {
  width: number;
  ascent: number;
  descent: number;
}

export type GlyphDrawFn = (
  ctx: CanvasRenderingContext2D,
  x: number,
  baselineY: number,
  size: number,
  settings: HandwritingSettings,
  random: () => number,
  ink: string,
) => GlyphMetrics;

// ─── Stroke helpers ───────────────────────────────────────────────────────────

function applyInkStyle(
  ctx: CanvasRenderingContext2D,
  ink: string,
  settings: HandwritingSettings,
  random: () => number,
  strokeWidth: number,
) {
  ctx.strokeStyle = ink;
  ctx.fillStyle = ink;
  ctx.lineWidth = strokeWidth + (random() - 0.5) * 0.3;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.globalAlpha = Math.min(1, settings.inkIntensity * 0.95 + (random() - 0.5) * 0.08);
}

/**
 * Draws a hand-jittered straight line segment between two points.
 * Adds natural variation matching pen.ts inkLine behaviour.
 */
function jLine(
  ctx: CanvasRenderingContext2D,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  random: () => number,
) {
  const j = () => (random() - 0.5) * 1.2;
  ctx.moveTo(x1 + j(), y1 + j());
  ctx.lineTo(x2 + j(), y2 + j());
}

/**
 * Draws a hand-jittered arc (quarter or partial ellipse).
 */
function jArc(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  startAngle: number,
  endAngle: number,
  random: () => number,
  ccw = false,
) {
  const j = (random() - 0.5) * 0.8;
  // Approximate arc with a bezier for handwritten feel
  ctx.save();
  ctx.translate(cx + j, cy + j);
  ctx.scale(rx, ry);
  ctx.arc(0, 0, 1, startAngle, endAngle, ccw);
  ctx.restore();
}

// ─── Greek Lowercase ──────────────────────────────────────────────────────────

/** α — alpha: like a loop with a tail */
export const glyphAlpha: GlyphDrawFn = (ctx, x, y, size, settings, random, ink) => {
  const w = size * 0.56;
  const r = size * 0.26;
  const sw = Math.max(0.8, settings.penWidth * 0.7);
  ctx.save();
  applyInkStyle(ctx, ink, settings, random, sw);
  ctx.beginPath();
  // Right loop circle
  jArc(ctx, x + w - r, y - r, r * 0.95, r, 0, Math.PI * 2, random);
  // Left loop & tail
  ctx.moveTo(x + w, y - r * 2);
  ctx.bezierCurveTo(x + w * 0.3, y - r * 2.2, x, y - r * 0.5, x + w * 0.35, y);
  ctx.stroke();
  ctx.restore();
  return { width: w + size * 0.08, ascent: size * 0.52, descent: 0 };
};

/** β — beta: vertical stroke with two loops */
export const glyphBeta: GlyphDrawFn = (ctx, x, y, size, settings, random, ink) => {
  const w = size * 0.5;
  const sw = Math.max(0.8, settings.penWidth * 0.7);
  ctx.save();
  applyInkStyle(ctx, ink, settings, random, sw);
  ctx.beginPath();
  // Vertical stem
  jLine(ctx, x + w * 0.22, y - size * 0.82, x + w * 0.22, y + size * 0.24, random);
  // Top loop
  ctx.moveTo(x + w * 0.22, y - size * 0.82);
  ctx.bezierCurveTo(x + w * 0.85, y - size * 0.85, x + w * 0.85, y - size * 0.42, x + w * 0.22, y - size * 0.42);
  // Middle bulge
  ctx.bezierCurveTo(x + w * 0.9, y - size * 0.44, x + w * 0.9, y + size * 0.08, x + w * 0.22, y);
  ctx.stroke();
  ctx.restore();
  return { width: w + size * 0.06, ascent: size * 0.82, descent: size * 0.24 };
};

/** θ — theta: oval with horizontal crossbar */
export const glyphTheta: GlyphDrawFn = (ctx, x, y, size, settings, random, ink) => {
  const rx = size * 0.24;
  const ry = size * 0.36;
  const sw = Math.max(0.8, settings.penWidth * 0.7);
  ctx.save();
  applyInkStyle(ctx, ink, settings, random, sw);
  // Oval
  ctx.beginPath();
  jArc(ctx, x + rx, y - ry, rx, ry, 0, Math.PI * 2, random);
  ctx.stroke();
  // Crossbar
  ctx.beginPath();
  const barY = y - ry + (random() - 0.5) * 2;
  jLine(ctx, x + size * 0.06, barY, x + rx * 2 - size * 0.06, barY, random);
  ctx.stroke();
  ctx.restore();
  return { width: rx * 2 + size * 0.08, ascent: ry * 2, descent: 0 };
};

/** λ — lambda: like an inverted V with a sweeping base */
export const glyphLambda: GlyphDrawFn = (ctx, x, y, size, settings, random, ink) => {
  const w = size * 0.52;
  const sw = Math.max(0.8, settings.penWidth * 0.7);
  ctx.save();
  applyInkStyle(ctx, ink, settings, random, sw);
  ctx.beginPath();
  // Left stroke going up then right
  ctx.moveTo(x + size * 0.06, y);
  ctx.lineTo(x + w * 0.5 + (random() - 0.5), y - size * 0.72);
  // Right descending stroke
  ctx.lineTo(x + w + (random() - 0.5) * 0.8, y + size * 0.12);
  ctx.stroke();
  ctx.restore();
  return { width: w + size * 0.06, ascent: size * 0.72, descent: size * 0.12 };
};

/** π — pi: horizontal bar with two descending legs */
export const glyphPi: GlyphDrawFn = (ctx, x, y, size, settings, random, ink) => {
  const w = size * 0.54;
  const sw = Math.max(0.8, settings.penWidth * 0.7);
  ctx.save();
  applyInkStyle(ctx, ink, settings, random, sw);
  ctx.beginPath();
  // Top horizontal bar
  jLine(ctx, x, y - size * 0.44, x + w, y - size * 0.44, random);
  // Left leg
  jLine(ctx, x + w * 0.2, y - size * 0.44, x + w * 0.2, y, random);
  // Right leg (slightly curved)
  ctx.moveTo(x + w * 0.8, y - size * 0.44);
  ctx.bezierCurveTo(x + w * 0.8, y - size * 0.1, x + w * 0.85, y, x + w * 0.78, y);
  ctx.stroke();
  ctx.restore();
  return { width: w + size * 0.06, ascent: size * 0.46, descent: 0 };
};

/** μ — mu: like 'u' with a left descender */
export const glyphMu: GlyphDrawFn = (ctx, x, y, size, settings, random, ink) => {
  const w = size * 0.5;
  const sw = Math.max(0.8, settings.penWidth * 0.7);
  ctx.save();
  applyInkStyle(ctx, ink, settings, random, sw);
  ctx.beginPath();
  // Left descender
  jLine(ctx, x + size * 0.1, y - size * 0.44, x + size * 0.1, y + size * 0.22, random);
  // U bowl
  ctx.moveTo(x + size * 0.1, y);
  ctx.bezierCurveTo(x + size * 0.1, y + size * 0.18, x + w, y + size * 0.18, x + w, y);
  // Right leg
  jLine(ctx, x + w, y - size * 0.44, x + w, y, random);
  ctx.stroke();
  ctx.restore();
  return { width: w + size * 0.08, ascent: size * 0.44, descent: size * 0.22 };
};

/** σ — sigma: circle with rightward opening tail */
export const glyphSigmaLower: GlyphDrawFn = (ctx, x, y, size, settings, random, ink) => {
  const r = size * 0.24;
  const sw = Math.max(0.8, settings.penWidth * 0.7);
  ctx.save();
  applyInkStyle(ctx, ink, settings, random, sw);
  ctx.beginPath();
  // Horizontal top arm
  jLine(ctx, x, y - r * 2, x + r * 2 + size * 0.08, y - r * 2, random);
  // Circle opening to the right
  jArc(ctx, x + r * 0.85, y - r, r, r, Math.PI * 0.15, Math.PI * 1.9, random);
  ctx.stroke();
  ctx.restore();
  return { width: r * 2 + size * 0.12, ascent: r * 2, descent: 0 };
};

/** ω — omega: two loops at bottom, like "w" with rounded feet */
export const glyphOmega: GlyphDrawFn = (ctx, x, y, size, settings, random, ink) => {
  const w = size * 0.58;
  const r = size * 0.18;
  const sw = Math.max(0.8, settings.penWidth * 0.7);
  ctx.save();
  applyInkStyle(ctx, ink, settings, random, sw);
  ctx.beginPath();
  ctx.moveTo(x + size * 0.04, y - r * 0.5);
  ctx.bezierCurveTo(x, y - r * 2.4, x + w * 0.45, y - r * 2.8, x + w * 0.5, y - r * 1.4);
  ctx.bezierCurveTo(x + w * 0.55, y - r * 2.8, x + w, y - r * 2.4, x + w - size * 0.04, y - r * 0.5);
  // Horizontal serifs at baseline
  jLine(ctx, x, y - r * 0.5, x + size * 0.14, y, random);
  ctx.moveTo(x + w - size * 0.14, y);
  jLine(ctx, x + w - size * 0.14, y, x + w, y - r * 0.5, random);
  ctx.stroke();
  ctx.restore();
  return { width: w + size * 0.04, ascent: r * 2.8, descent: 0 };
};

// ─── Greek Uppercase ──────────────────────────────────────────────────────────

/** Σ — Sigma: uppercase, three strokes */
export const glyphSigmaUpper: GlyphDrawFn = (ctx, x, y, size, settings, random, ink) => {
  const w = size * 0.54;
  const h = size * 0.72;
  const sw = Math.max(0.8, settings.penWidth * 0.8);
  ctx.save();
  applyInkStyle(ctx, ink, settings, random, sw);
  ctx.beginPath();
  // Top stroke →
  jLine(ctx, x + w, y - h, x, y - h, random);
  // Top diagonal to center
  ctx.lineTo(x + w * 0.46 + (random() - 0.5), y - h * 0.5 + (random() - 0.5));
  // Bottom diagonal from center
  ctx.lineTo(x + (random() - 0.5), y + (random() - 0.5));
  // Bottom stroke →
  jLine(ctx, x, y, x + w, y, random);
  ctx.stroke();
  ctx.restore();
  return { width: w + size * 0.06, ascent: h, descent: 0 };
};

/** Δ — Delta: triangle */
export const glyphDelta: GlyphDrawFn = (ctx, x, y, size, settings, random, ink) => {
  const w = size * 0.56;
  const h = size * 0.7;
  const sw = Math.max(0.8, settings.penWidth * 0.8);
  ctx.save();
  applyInkStyle(ctx, ink, settings, random, sw);
  ctx.beginPath();
  ctx.moveTo(x + w * 0.5 + (random() - 0.5), y - h + (random() - 0.5));
  ctx.lineTo(x + (random() - 0.5), y + (random() - 0.5));
  ctx.lineTo(x + w + (random() - 0.5), y + (random() - 0.5));
  ctx.closePath();
  ctx.stroke();
  ctx.restore();
  return { width: w + size * 0.06, ascent: h, descent: 0 };
};

// ─── Special Math Symbols ─────────────────────────────────────────────────────

/** ∞ — infinity: figure-eight lying on its side */
export const glyphInfinity: GlyphDrawFn = (ctx, x, y, size, settings, random, ink) => {
  const w = size * 0.62;
  const r = size * 0.2;
  const cy = y - r;
  const sw = Math.max(0.8, settings.penWidth * 0.7);
  ctx.save();
  applyInkStyle(ctx, ink, settings, random, sw);
  ctx.beginPath();
  // Left lobe
  jArc(ctx, x + r, cy, r, r, 0, Math.PI * 2, random);
  // Right lobe
  jArc(ctx, x + w - r, cy, r, r, Math.PI, Math.PI * 3, random, true);
  ctx.stroke();
  ctx.restore();
  return { width: w + size * 0.04, ascent: r * 2, descent: 0 };
};

/** ∫ — integral: tall S-curve */
export const glyphIntegral: GlyphDrawFn = (ctx, x, y, size, settings, random, ink) => {
  const h = size * 0.95;
  const w = size * 0.3;
  const sw = Math.max(0.8, settings.penWidth * 0.7);
  ctx.save();
  applyInkStyle(ctx, ink, settings, random, sw);
  ctx.beginPath();
  ctx.moveTo(x + w * 0.7, y - h + size * 0.1);
  ctx.bezierCurveTo(
    x + w * 1.1, y - h,
    x + w * 1.2, y - h * 0.55,
    x + w * 0.5 + (random() - 0.5) * 1.5, y - h * 0.5,
  );
  ctx.bezierCurveTo(
    x - w * 0.1, y - h * 0.45,
    x - w * 0.2, y,
    x + w * 0.3, y + size * 0.1,
  );
  ctx.stroke();
  ctx.restore();
  return { width: w * 1.2, ascent: h, descent: size * 0.12 };
};

/** ≤ — leq: less-than sign with underscore */
export const glyphLeq: GlyphDrawFn = (ctx, x, y, size, settings, random, ink) => {
  const w = size * 0.42;
  const h = size * 0.4;
  const sw = Math.max(0.8, settings.penWidth * 0.7);
  ctx.save();
  applyInkStyle(ctx, ink, settings, random, sw);
  ctx.beginPath();
  // < shape
  jLine(ctx, x + w, y - h, x, y - h * 0.5, random);
  jLine(ctx, x, y - h * 0.5, x + w, y, random);
  // underline
  jLine(ctx, x, y + size * 0.12, x + w, y + size * 0.12, random);
  ctx.stroke();
  ctx.restore();
  return { width: w + size * 0.06, ascent: h, descent: size * 0.14 };
};

/** ≥ — geq: greater-than sign with underscore */
export const glyphGeq: GlyphDrawFn = (ctx, x, y, size, settings, random, ink) => {
  const w = size * 0.42;
  const h = size * 0.4;
  const sw = Math.max(0.8, settings.penWidth * 0.7);
  ctx.save();
  applyInkStyle(ctx, ink, settings, random, sw);
  ctx.beginPath();
  jLine(ctx, x, y - h, x + w, y - h * 0.5, random);
  jLine(ctx, x + w, y - h * 0.5, x, y, random);
  jLine(ctx, x, y + size * 0.12, x + w, y + size * 0.12, random);
  ctx.stroke();
  ctx.restore();
  return { width: w + size * 0.06, ascent: h, descent: size * 0.14 };
};

/** ≠ — neq: equals with a diagonal slash */
export const glyphNeq: GlyphDrawFn = (ctx, x, y, size, settings, random, ink) => {
  const w = size * 0.46;
  const sw = Math.max(0.8, settings.penWidth * 0.7);
  ctx.save();
  applyInkStyle(ctx, ink, settings, random, sw);
  ctx.beginPath();
  jLine(ctx, x, y - size * 0.22, x + w, y - size * 0.22, random);
  jLine(ctx, x, y + size * 0.04, x + w, y + size * 0.04, random);
  // Slash
  jLine(ctx, x + w * 0.7, y - size * 0.36, x + w * 0.3, y + size * 0.18, random);
  ctx.stroke();
  ctx.restore();
  return { width: w + size * 0.06, ascent: size * 0.24, descent: size * 0.06 };
};

/** ≈ — approx: two wavy equals lines */
export const glyphApprox: GlyphDrawFn = (ctx, x, y, size, settings, random, ink) => {
  const w = size * 0.46;
  const sw = Math.max(0.8, settings.penWidth * 0.7);
  ctx.save();
  applyInkStyle(ctx, ink, settings, random, sw);
  // Two wavy lines
  for (const offsetY of [-size * 0.18, size * 0.06]) {
    ctx.beginPath();
    ctx.moveTo(x + (random() - 0.5), y + offsetY);
    ctx.bezierCurveTo(
      x + w * 0.25, y + offsetY - size * 0.08 + (random() - 0.5) * 2,
      x + w * 0.75, y + offsetY + size * 0.08 + (random() - 0.5) * 2,
      x + w + (random() - 0.5), y + offsetY,
    );
    ctx.stroke();
  }
  ctx.restore();
  return { width: w + size * 0.06, ascent: size * 0.24, descent: size * 0.1 };
};

/** ± — plus-minus */
export const glyphPlusMinus: GlyphDrawFn = (ctx, x, y, size, settings, random, ink) => {
  const w = size * 0.42;
  const sw = Math.max(0.8, settings.penWidth * 0.7);
  ctx.save();
  applyInkStyle(ctx, ink, settings, random, sw);
  ctx.beginPath();
  // Vertical
  jLine(ctx, x + w * 0.5, y - size * 0.44, x + w * 0.5, y - size * 0.04, random);
  // Horizontal (cross)
  jLine(ctx, x, y - size * 0.24, x + w, y - size * 0.24, random);
  // Minus (bottom)
  jLine(ctx, x, y + size * 0.04, x + w, y + size * 0.04, random);
  ctx.stroke();
  ctx.restore();
  return { width: w + size * 0.06, ascent: size * 0.46, descent: size * 0.06 };
};

/** ∂ — partial derivative */
export const glyphPartial: GlyphDrawFn = (ctx, x, y, size, settings, random, ink) => {
  const w = size * 0.38;
  const r = size * 0.2;
  const sw = Math.max(0.8, settings.penWidth * 0.7);
  ctx.save();
  applyInkStyle(ctx, ink, settings, random, sw);
  ctx.beginPath();
  // Circular part
  jArc(ctx, x + r, y - r, r, r, 0, Math.PI * 2, random);
  // Upward curving stem
  ctx.moveTo(x + r * 1.1, y - r * 2);
  ctx.bezierCurveTo(x + w * 1.2, y - size * 0.7, x + w * 0.5, y - size * 0.65, x + r, y - r * 2);
  ctx.stroke();
  ctx.restore();
  return { width: w + size * 0.06, ascent: size * 0.7, descent: 0 };
};

// ─── Radical symbol (standalone √) ───────────────────────────────────────────

/** √ — standalone radical check */
export const glyphSqrtCheck: GlyphDrawFn = (ctx, x, y, size, settings, random, ink) => {
  const w = size * 0.32;
  const sw = Math.max(0.8, settings.penWidth * 0.7);
  ctx.save();
  applyInkStyle(ctx, ink, settings, random, sw);
  ctx.beginPath();
  ctx.moveTo(x, y - size * 0.18);
  ctx.lineTo(x + w * 0.28, y + (random() - 0.5) * 1.2);
  ctx.lineTo(x + w * 0.55, y - size * 0.52);
  ctx.lineTo(x + w, y - size * 0.52);
  ctx.stroke();
  ctx.restore();
  return { width: w, ascent: size * 0.52, descent: 0 };
};

// ─── Glyph registry ───────────────────────────────────────────────────────────

/**
 * Map from Unicode character or symbol name to GlyphDrawFn.
 * Used by math/layout.ts when rendering SymbolNode.
 */
export const GLYPH_MAP: Map<string, GlyphDrawFn> = new Map([
  // By symbol name (LaTeX command without \)
  ["alpha", glyphAlpha],
  ["beta", glyphBeta],
  ["theta", glyphTheta],
  ["lambda", glyphLambda],
  ["pi", glyphPi],
  ["mu", glyphMu],
  ["sigma", glyphSigmaLower],
  ["omega", glyphOmega],
  ["Sigma", glyphSigmaUpper],
  ["Delta", glyphDelta],
  ["sum", glyphSigmaUpper],
  ["infty", glyphInfinity],
  ["int", glyphIntegral],
  ["oint", glyphIntegral],
  ["leq", glyphLeq],
  ["geq", glyphGeq],
  ["neq", glyphNeq],
  ["approx", glyphApprox],
  ["pm", glyphPlusMinus],
  ["partial", glyphPartial],
  ["sqrt", glyphSqrtCheck], // standalone radical
  // By Unicode character (fallback lookup)
  ["α", glyphAlpha],
  ["β", glyphBeta],
  ["θ", glyphTheta],
  ["λ", glyphLambda],
  ["π", glyphPi],
  ["μ", glyphMu],
  ["σ", glyphSigmaLower],
  ["ω", glyphOmega],
  ["Σ", glyphSigmaUpper],
  ["Δ", glyphDelta],
  ["∞", glyphInfinity],
  ["∫", glyphIntegral],
  ["≤", glyphLeq],
  ["≥", glyphGeq],
  ["≠", glyphNeq],
  ["≈", glyphApprox],
  ["±", glyphPlusMinus],
  ["∂", glyphPartial],
  ["√", glyphSqrtCheck],
]);

/**
 * Check if a glyph has a custom handwritten vector path.
 */
export function hasGlyph(nameOrChar: string): boolean {
  return GLYPH_MAP.has(nameOrChar);
}

/**
 * Draw a glyph at the given position.
 * Returns the glyph metrics, or null if no custom path exists.
 */
export function drawGlyph(
  nameOrChar: string,
  ctx: CanvasRenderingContext2D,
  x: number,
  baselineY: number,
  size: number,
  settings: HandwritingSettings,
  random: () => number,
  ink: string,
): GlyphMetrics | null {
  const fn = GLYPH_MAP.get(nameOrChar);
  if (!fn) return null;
  return fn(ctx, x, baselineY, size, settings, random, ink);
}
