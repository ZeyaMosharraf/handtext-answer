/**
 * src/lib/graph/geometry.ts
 *
 * Graph coordinate system utilities:
 *   - Linear coordinate transform (graph-space ↔ canvas-pixel-space)
 *   - Auto tick step generation ("nice" intervals)
 *   - TickSpec computation
 *   - Function sampling with discontinuity detection
 *   - Polyline segmentation (splitting at NaN/discontinuity)
 *
 * All geometry is deterministic. No randomness here.
 * Randomness for visual jitter is applied exclusively in renderer.ts / handwriting.ts.
 */

import type {
  CoordTransform,
  GraphCoordinateSpace,
  PolylineSegment,
  SamplePoint,
  TickSpec,
} from "./types";
import type { CompiledExpression } from "./parser";

// ─── Coordinate transform ─────────────────────────────────────────────────────

/**
 * Build a linear coordinate transform mapping graph-space to canvas-pixel-space.
 *
 * Y-axis is inverted: graph Y increases upward, canvas Y increases downward.
 *
 * Edge cases:
 *   - If xMax === xMin (zero-width range), scaleX = 1 to avoid division by zero.
 *   - If yMax === yMin (zero-height range), scaleY = 1.
 */
export function makeCoordTransform(
  space: GraphCoordinateSpace,
  canvasLeft: number,
  canvasTop: number,
  canvasWidth: number,
  canvasHeight: number,
): CoordTransform {
  const xMin = typeof space?.xMin === "number" ? space.xMin : -5;
  const xMax = typeof space?.xMax === "number" ? space.xMax : 5;
  const yMin = typeof space?.yMin === "number" ? space.yMin : -5;
  const yMax = typeof space?.yMax === "number" ? space.yMax : 5;
  const rangeX = xMax - xMin || 1;
  const rangeY = yMax - yMin || 1;
  const scaleX = canvasWidth  / rangeX;
  const scaleY = canvasHeight / rangeY;

  return {
    canvasLeft,
    canvasTop,
    canvasWidth,
    canvasHeight,

    toCanvasX(gx: number): number {
      return canvasLeft + (gx - xMin) * scaleX;
    },

    toCanvasY(gy: number): number {
      return canvasTop + (yMax - gy) * scaleY;   // Y-inverted
    },

    toGraphX(px: number): number {
      return xMin + (px - canvasLeft) / scaleX;
    },

    toGraphY(py: number): number {
      return yMax - (py - canvasTop) / scaleY;
    },
  };
}

// ─── Auto-step and tick generation ───────────────────────────────────────────

/**
 * Compute a "nice" tick interval for a given numeric range.
 *
 * Produces human-friendly steps: 0.1, 0.2, 0.5, 1, 2, 5, 10, 20, 50, 100...
 *
 * @param range       The span (max - min) to cover
 * @param targetTicks Approximate desired number of ticks (default 5)
 */
export function autoStep(range: number, targetTicks = 5): number {
  if (range <= 0) return 1;
  const rawStep = range / targetTicks;
  const magnitude = Math.pow(10, Math.floor(Math.log10(rawStep)));
  const normalized = rawStep / magnitude;
  let niceFactor: number;
  if (normalized < 1.5) {
    niceFactor = 1;
  } else if (normalized < 3.5) {
    niceFactor = 2;
  } else if (normalized < 7.5) {
    niceFactor = 5;
  } else {
    niceFactor = 10;
  }
  return niceFactor * magnitude;
}

/**
 * Compute tick positions for an axis.
 *
 * @param min      Axis minimum value
 * @param max      Axis maximum value
 * @param stepHint Explicit step, or undefined to auto-compute
 * @returns        TickSpec with step and all tick values in [min, max]
 */
export function computeTickSpec(min: number, max: number, stepHint?: number): TickSpec {
  const range = max - min;
  const step = stepHint && stepHint > 0 ? stepHint : autoStep(range, 5);

  // Start from the first tick at or above min
  const firstTick = Math.ceil(min / step) * step;

  const ticks: number[] = [];
  // Allow a small epsilon to include ticks exactly at min/max boundaries
  const eps = step * 1e-9;
  let t = firstTick;
  while (t <= max + eps) {
    // Round to avoid floating-point drift (e.g. 0.1+0.1+0.1 ≠ 0.3)
    const rounded = Math.round(t / step) * step;
    if (rounded >= min - eps && rounded <= max + eps) {
      ticks.push(rounded);
    }
    t += step;
  }

  return { step, ticks };
}

// ─── Function sampling ────────────────────────────────────────────────────────

/** Absolute threshold: values beyond this are always treated as discontinuities */
const ABSOLUTE_DISCONTINUITY = 1e6;
/**
 * Scale threshold: if |gy| > yRange * RANGE_DISCONTINUITY_SCALE, treat as discontinuity.
 * Value of 5 means: values that are more than 5× the displayed y-axis range
 * outside the range are treated as discontinuities (asymptotes, blow-ups).
 */
const RANGE_DISCONTINUITY_SCALE = 5;

/**
 * Sample a compiled function expression across the graph's x-range.
 *
 * @param compiled     A CompiledExpression from compileExpression()
 * @param space        The graph coordinate space (xMin, xMax, yMin, yMax)
 * @param transform    CoordTransform for mapping to canvas pixels
 * @param sampleCount  Number of uniform samples (default 300)
 * @returns            Array of SamplePoint, with gy/cy null at discontinuities
 */
export function sampleFunction(
  compiled: CompiledExpression,
  space: GraphCoordinateSpace,
  transform: CoordTransform,
  sampleCount = 300,
): SamplePoint[] {
  const xMin = typeof space?.xMin === "number" ? space.xMin : -5;
  const xMax = typeof space?.xMax === "number" ? space.xMax : 5;
  const yMin = typeof space?.yMin === "number" ? space.yMin : -5;
  const yMax = typeof space?.yMax === "number" ? space.yMax : 5;
  const step = (xMax - xMin) / (sampleCount - 1);

  // Discontinuity guard: treat values beyond this as undefined.
  // Use the smaller of: absolute threshold OR range-based threshold.
  const yRange = Math.max(Math.abs(yMax - yMin), 1);
  const discontinuityThreshold = Math.min(
    ABSOLUTE_DISCONTINUITY,
    yRange * RANGE_DISCONTINUITY_SCALE,
  );

  const samples: SamplePoint[] = [];

  for (let i = 0; i < sampleCount; i++) {
    const gx = xMin + i * step;
    const rawY = compiled.evaluate(gx);

    let gy: number | null;
    let cy: number | null;

    if (!isFinite(rawY) || isNaN(rawY) || Math.abs(rawY) > discontinuityThreshold) {
      // Discontinuity, asymptote, or undefined value
      gy = null;
      cy = null;
    } else {
      gy = rawY;
      cy = transform.toCanvasY(gy);
    }

    samples.push({
      gx,
      gy,
      cx: transform.toCanvasX(gx),
      cy,
    });
  }

  // Second pass: detect asymptotes where samples jumped across a singularity
  // A sign flip combined with a large jump (> yRange * 2) indicates an asymptote crossing
  const JUMP_THRESHOLD = yRange * 2;
  for (let i = 1; i < samples.length; i++) {
    const prev = samples[i - 1]!;
    const curr = samples[i]!;
    if (prev.gy !== null && curr.gy !== null) {
      const jump = Math.abs(curr.gy - prev.gy);
      const signFlip = Math.sign(curr.gy) !== Math.sign(prev.gy);
      if (signFlip && jump > JUMP_THRESHOLD) {
        prev.gy = null;
        prev.cy = null;
        curr.gy = null;
        curr.cy = null;
      }
    }
  }

  return samples;
}

// ─── Discontinuity segmentation ───────────────────────────────────────────────

/**
 * Split an array of SamplePoints into continuous polyline segments.
 * Segments are broken wherever gy (or cy) is null.
 * Segments with fewer than 2 points are discarded.
 *
 * @param samples  Output of sampleFunction()
 * @returns        Array of PolylineSegment, each with ≥2 canvas points
 */
export function segmentizeSamples(samples: SamplePoint[]): PolylineSegment[] {
  const segments: PolylineSegment[] = [];
  let current: Array<{ cx: number; cy: number }> = [];

  for (const s of samples) {
    if (s.cy === null || s.gy === null) {
      // Discontinuity: flush current segment
      if (current.length >= 2) {
        segments.push({ points: current });
      }
      current = [];
    } else {
      current.push({ cx: s.cx, cy: s.cy });
    }
  }

  // Flush final segment
  if (current.length >= 2) {
    segments.push({ points: current });
  }

  return segments;
}

// ─── Utility ─────────────────────────────────────────────────────────────────

/**
 * Clip a value to [min, max].
 */
export function clipToRange(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/**
 * Format a tick label number for display.
 * Integers: no decimal. Small decimals: up to 2 places. Very large/small: scientific.
 */
export function formatTickLabel(value: number): string {
  if (value === 0) return "0";
  const abs = Math.abs(value);

  // Very large or very small: use exponential
  if (abs >= 10000 || (abs > 0 && abs < 0.01)) {
    return value.toExponential(1);
  }

  // Integer check
  if (Number.isInteger(value)) {
    return value.toString();
  }

  // Up to 2 decimal places, trim trailing zeros
  const fixed2 = parseFloat(value.toFixed(2));
  if (fixed2 === value || Math.abs(fixed2 - value) < 1e-9) {
    return fixed2.toString();
  }

  return parseFloat(value.toFixed(3)).toString();
}
