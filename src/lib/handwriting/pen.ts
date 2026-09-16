/**
 * Handwriting pen simulation primitives.
 *
 * Responsibility: how individual glyphs and strokes are rendered on a Canvas
 * with natural variation (jitter, slant, pressure, ink variation).
 *
 * No layout types. No React. Pure canvas operations.
 */

import { HIGHLIGHT_COLOR, type Seg } from "./parse";
import type { HandwritingSettings } from "./types";

// ─── RNG ────────────────────────────────────────────────────────────────────

export function makeRng(seed: number): () => number {
  let state = seed >>> 0 || 1;
  return () => {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    return ((state >>> 0) % 100000) / 100000;
  };
}

export function hashString(input: string): number {
  let hash = 2166136261;
  for (let index = 0; index < input.length; index++) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

// ─── Colour helpers ──────────────────────────────────────────────────────────

export function withAlpha(hex: string, alpha: number): string {
  const clean = hex.replace("#", "");
  const full = clean.length === 3 ? clean.split("").map((c) => c + c).join("") : clean;
  const red = parseInt(full.slice(0, 2), 16) || 0;
  const green = parseInt(full.slice(2, 4), 16) || 0;
  const blue = parseInt(full.slice(4, 6), 16) || 0;
  return `rgba(${red},${green},${blue},${alpha})`;
}

// ─── Stroke drawing helpers ──────────────────────────────────────────────────

export function handUnderline(
  ctx: CanvasRenderingContext2D,
  settings: HandwritingSettings,
  from: number,
  to: number,
  y: number,
  color: string,
  random: () => number,
) {
  if (to <= from) return;
  const width = to - from;
  const jitterStart = (random() - 0.5) * 3;
  const jitterEnd = (random() - 0.5) * 3;
  const midY = y + (random() - 0.5) * 2;

  ctx.save();
  ctx.beginPath();
  ctx.strokeStyle = color;
  ctx.lineWidth = Math.max(0.6, settings.penWidth * 0.7);
  ctx.globalAlpha = Math.min(1, settings.inkIntensity * 0.95);
  ctx.moveTo(from, y + jitterStart);
  ctx.bezierCurveTo(
    from + width * 0.35,
    midY,
    from + width * 0.7,
    midY + (random() - 0.5) * 2,
    to,
    y + jitterEnd,
  );
  ctx.stroke();
  ctx.restore();
}

export function drawHighlighterWash(
  ctx: CanvasRenderingContext2D,
  startX: number,
  endX: number,
  baselineY: number,
  fontSize: number,
  highlightColor: string,
  random: () => number,
) {
  if (endX <= startX) return;
  ctx.save();
  ctx.fillStyle = highlightColor;
  ctx.globalAlpha = 0.34;
  const padX = 3;
  const x = startX - padX;
  const w = endX - startX + padX * 2;
  const top = baselineY - fontSize * 0.82 + (random() - 0.5) * 1.5;
  const h = fontSize * 1.05 + (random() - 0.5) * 1.2;
  const radius = 3;

  ctx.beginPath();
  if (typeof ctx.roundRect === "function") {
    ctx.roundRect(x, top, w, h, radius);
  } else {
    ctx.rect(x, top, w, h);
  }
  ctx.fill();
  ctx.restore();
}

export function inkLine(
  ctx: CanvasRenderingContext2D,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  random: () => number,
  color: string,
  width: number,
) {
  const steps = Math.max(2, Math.round(Math.hypot(x2 - x1, y2 - y1) / 26));
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = width + (random() - 0.5) * 0.35;
  ctx.lineCap = "round";
  ctx.globalAlpha = 0.9;
  ctx.beginPath();
  ctx.moveTo(x1 + (random() - 0.5) * 1.2, y1 + (random() - 0.5) * 1.2);
  for (let step = 1; step <= steps; step++) {
    const progress = step / steps;
    ctx.lineTo(
      x1 + (x2 - x1) * progress + (random() - 0.5) * 1.6,
      y1 + (y2 - y1) * progress + (random() - 0.5) * 1.6,
    );
  }
  ctx.stroke();
  ctx.restore();
}

// ─── Segment measurement ─────────────────────────────────────────────────────

export function estimateSegmentWidth(
  ctx: CanvasRenderingContext2D,
  segment: Seg,
  settings: HandwritingSettings,
  scale: number,
  size: number,
): number {
  const segScale = scale * (segment.scale ?? 1);
  ctx.font = `${segment.italic ? "italic " : ""}${size}px "${settings.fontFamily}", cursive`;
  let w = 0;
  for (const ch of segment.text) {
    if (ch === " " || ch === "\u00a0") {
      w += settings.wordSpacing * (1 - settings.writingSpeed * 0.18) * segScale;
    } else {
      w +=
        ctx.measureText(ch).width * settings.compactness * (1 - settings.writingSpeed * 0.06) +
        settings.letterSpacing * segScale * (1 - settings.writingSpeed * 0.3);
    }
  }
  return w;
}

export function measureHandwritten(
  ctx: CanvasRenderingContext2D,
  text: string,
  settings: HandwritingSettings,
  size: number,
): number {
  if (!text) return 0;
  ctx.font = `${size}px "${settings.fontFamily}", cursive`;
  return ctx.measureText(text).width * settings.compactness + text.length * settings.letterSpacing;
}

export function measureSegments(
  ctx: CanvasRenderingContext2D,
  segs: Seg[],
  settings: HandwritingSettings,
  baseSize: number,
): number {
  const speed = settings.writingSpeed ?? 0;
  const scale = baseSize / settings.fontSize;
  return segs.reduce((sum, seg) => {
    const segScale = scale * (seg.scale ?? 1);
    const size = settings.fontSize * segScale;
    ctx.font = `${seg.italic ? "italic " : ""}${size}px "${settings.fontFamily}", cursive`;
    const spaceWidth = settings.wordSpacing * (1 - speed * 0.18) * segScale;
    const normalized = seg.text.replace(/\u00a0/g, " ").replace(/\t/g, "    ");
    let segTotal = 0;
    for (const part of normalized.split(/( +)/)) {
      if (!part) continue;
      if (part.startsWith(" ")) {
        segTotal += part.length * spaceWidth;
      } else {
        segTotal +=
          ctx.measureText(part).width * settings.compactness * (1 - speed * 0.06) +
          part.length * settings.letterSpacing * segScale * (1 - speed * 0.3);
      }
    }
    return sum + segTotal;
  }, 0);
}

// ─── Text writing ────────────────────────────────────────────────────────────

export interface PenOptions {
  size: number;
  color: string;
  scale?: number;
  underline?: boolean;
}

export function plainSegments(text: string): Seg[] {
  return text ? [{ text, bold: false, underline: false, italic: false }] : [];
}

export function writeSegments(
  ctx: CanvasRenderingContext2D,
  segments: Seg[],
  settings: HandwritingSettings,
  baseX: number,
  baselineY: number,
  random: () => number,
  pen: PenOptions,
): number {
  if (!segments.some((segment) => segment.text.trim().length > 0)) return baseX;
  let x = baseX;
  const scale = pen.scale ?? 1;
  const speed = settings.writingSpeed;
  const pressure = settings.pressure;
  ctx.save();
  ctx.textBaseline = "alphabetic";

  for (const segment of segments) {
    if (!segment.text) continue;
    const segmentStart = x;
    const segScale = scale * (segment.scale ?? 1);
    const color = segment.color ?? pen.color;
    const isBlackInk = Boolean(
      segment.color &&
        (segment.color === HIGHLIGHT_COLOR ||
          segment.color.toLowerCase() === "#141821" ||
          segment.color.includes("141821") ||
          segment.color.includes("20, 24, 33") ||
          segment.color.includes("20,24,33")),
    );

    // Draw soft fluorescent highlighter wash behind the segment if active
    if (segment.highlight) {
      const estimatedWidth = estimateSegmentWidth(
        ctx,
        segment,
        settings,
        scale,
        pen.size * (segment.scale ?? 1),
      );
      drawHighlighterWash(
        ctx,
        segmentStart,
        segmentStart + estimatedWidth,
        baselineY,
        pen.size * (segment.scale ?? 1),
        segment.highlight,
        random,
      );
    }

    for (const character of segment.text) {
      if (character === " " || character === "\u00a0") {
        x +=
          (settings.wordSpacing + (random() - 0.5) * settings.wordSpacing * 0.35 * settings.imperfection) *
          (1 - speed * 0.18) *
          segScale;
        continue;
      }
      const sizeJitter = 1 + (random() - 0.5) * 0.07 * settings.charVariation;
      const widthJitter = 1 + (random() - 0.5) * 0.05 * settings.charVariation;
      const size = pen.size * (segment.scale ?? 1) * sizeJitter;
      const italicSlant = segment.italic ? 12 : 0;
      const slant = (settings.slant + italicSlant + (random() - 0.5) * settings.slantVariation + speed * 1.2) * (Math.PI / 180);
      const rotation = (random() - 0.5) * 0.012 * settings.imperfection * 6;
      const characterBaselineJitter = (random() - 0.5) * settings.baselineVariation;
      const horizontal = settings.compactness * widthJitter * (1 - speed * 0.06);

      ctx.save();
      ctx.font = `${segment.italic ? "italic " : ""}${size}px "${settings.fontFamily}", cursive`;
      ctx.fillStyle = color;
      ctx.globalAlpha = Math.min(1, (segment.bold || isBlackInk ? 1 : settings.inkIntensity) + (random() - 0.5) * 0.22 * settings.inkVariation);
      ctx.translate(x, baselineY + characterBaselineJitter);
      ctx.rotate(rotation);
      ctx.transform(horizontal, 0, -Math.tan(slant), 1, 0, 0);
      const stroke =
        (settings.penWidth - 1) * 0.7 +
        pressure * 0.9 +
        (segment.bold ? 1.1 : 0) +
        (isBlackInk ? 0.35 : 0) +
        (random() - 0.5) * 0.3 * settings.inkVariation;
      if (stroke > 0.12) {
        ctx.lineWidth = stroke;
        ctx.lineJoin = "round";
        ctx.strokeStyle = color;
        ctx.strokeText(character, 0, 0);
      }
      ctx.fillText(character, 0, 0);
      ctx.restore();

      ctx.font = `${segment.italic ? "italic " : ""}${size}px "${settings.fontFamily}", cursive`;
      x += ctx.measureText(character).width * horizontal + settings.letterSpacing * segScale * (1 - speed * 0.3);
    }
    if (segment.underline) handUnderline(ctx, settings, segmentStart, x, baselineY + 7, color, random);
  }
  if (pen.underline) handUnderline(ctx, settings, baseX, x, baselineY + 8, pen.color, random);
  ctx.restore();
  return x;
}

export function writeText(
  ctx: CanvasRenderingContext2D,
  text: string,
  settings: HandwritingSettings,
  x: number,
  baselineY: number,
  random: () => number,
  pen: PenOptions,
): number {
  if (!text.trim()) return x;
  return writeSegments(ctx, plainSegments(text), settings, x, baselineY, random, pen);
}
