/**
 * src/lib/graph/handwriting.ts
 *
 * Low-level pen helpers specific to graph elements.
 * All strokes are drawn via pen.ts primitives (inkLine) to ensure genuine handwriting feel.
 */

import { inkLine, withAlpha } from "../handwriting/pen";

/**
 * Draw a generic handwritten graph line (e.g. function curve segment, point connection).
 */
export function drawGraphLine(
  ctx: CanvasRenderingContext2D,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  random: () => number,
  ink: string,
  width: number = 1.0,
): void {
  inkLine(ctx, x1, y1, x2, y2, random, ink, width);
}

/**
 * Draw a light handwritten grid line (alpha ~ 0.18, thin stroke).
 */
export function drawGridLine(
  ctx: CanvasRenderingContext2D,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  random: () => number,
  ink: string,
): void {
  const lightColor = withAlpha(ink, 0.18);
  inkLine(ctx, x1, y1, x2, y2, random, lightColor, 0.6);
}

/**
 * Draw an axis line with slight pen weight emphasis.
 */
export function drawAxis(
  ctx: CanvasRenderingContext2D,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  random: () => number,
  ink: string,
  penWidth: number,
): void {
  const width = Math.max(1.0, penWidth * 1.2);
  inkLine(ctx, x1, y1, x2, y2, random, ink, width);
}

/**
 * Draw a handwritten arrowhead at a given tip position and direction angle.
 *
 * @param tipX      X coordinate of arrow tip
 * @param tipY      Y coordinate of arrow tip
 * @param angleDeg  Pointing direction in degrees (0 = right, -90 = up, 90 = down, 180 = left)
 */
export function drawArrowhead(
  ctx: CanvasRenderingContext2D,
  tipX: number,
  tipY: number,
  angleDeg: number,
  random: () => number,
  ink: string,
  width: number = 1.2,
): void {
  const length = 12;
  const spreadRad = (20 * Math.PI) / 180;
  const baseRad = (angleDeg * Math.PI) / 180 + Math.PI;

  const b1X = tipX + length * Math.cos(baseRad - spreadRad);
  const b1Y = tipY + length * Math.sin(baseRad - spreadRad);

  const b2X = tipX + length * Math.cos(baseRad + spreadRad);
  const b2Y = tipY + length * Math.sin(baseRad + spreadRad);

  inkLine(ctx, tipX, tipY, b1X, b1Y, random, ink, width);
  inkLine(ctx, tipX, tipY, b2X, b2Y, random, ink, width);
}

/**
 * Draw a short perpendicular tick mark across an axis.
 */
export function drawTickMark(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  isXAxis: boolean,
  tickLength: number,
  random: () => number,
  ink: string,
  width: number = 1.0,
): void {
  const half = tickLength / 2;
  if (isXAxis) {
    inkLine(ctx, cx, cy - half, cx, cy + half, random, ink, width);
  } else {
    inkLine(ctx, cx - half, cy, cx + half, cy, random, ink, width);
  }
}

/**
 * Draw a data point marker ("cross" or "dot").
 */
export function drawPointMarker(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  style: "cross" | "dot",
  random: () => number,
  ink: string,
  size: number = 6,
): void {
  const half = size / 2;
  if (style === "cross") {
    inkLine(ctx, cx - half, cy - half, cx + half, cy + half, random, ink, 1.0);
    inkLine(ctx, cx - half, cy + half, cx + half, cy - half, random, ink, 1.0);
  } else {
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, Math.max(1.5, half), 0, Math.PI * 2);
    ctx.fillStyle = ink;
    ctx.fill();
    ctx.restore();
  }
}
