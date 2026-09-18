/**
 * src/lib/graph/renderer.ts
 *
 * Orchestrates the complete handwritten graph canvas drawing sequence.
 * Draws all elements (title, grid, axes, ticks, functions, points, annotations)
 * using natural pen strokes.
 */

import type { HandwritingSettings } from "../handwriting/types";
import { writeText, measureHandwritten } from "../handwriting/pen";
import type { GraphDefinition, GraphLayoutBox } from "./types";
import { compileExpression } from "./parser";
import {
  makeCoordTransform,
  computeTickSpec,
  sampleFunction,
  segmentizeSamples,
  formatTickLabel,
} from "./geometry";
import {
  drawGraphLine,
  drawGridLine,
  drawAxis,
  drawArrowhead,
  drawTickMark,
  drawPointMarker,
} from "./handwriting";

/**
 * Draw a complete graph on the canvas.
 *
 * @param ctx         Canvas 2D context
 * @param definition  Graph specification
 * @param box         Computed layout box
 * @param originX     Content-left margin (X offset)
 * @param topY        Starting line baseline/top (Y offset)
 * @param settings    Active handwriting settings
 * @param random      Seeded PRNG
 * @param ink         Active ink color
 */
export function drawGraph(
  ctx: CanvasRenderingContext2D,
  definition: GraphDefinition,
  box: GraphLayoutBox,
  originX: number,
  topY: number,
  settings: HandwritingSettings,
  random: () => number,
  ink: string,
): void {
  const canvasLeft = originX + box.graphArea.left;
  const canvasTop = topY + box.graphArea.top;
  const canvasWidth = box.graphArea.width;
  const canvasHeight = box.graphArea.height;

  const transform = makeCoordTransform(
    definition.space,
    canvasLeft,
    canvasTop,
    canvasWidth,
    canvasHeight,
  );

  // ── 1. Title ──
  if (definition.title) {
    const titleSize = Math.round(settings.fontSize * 1.1);
    const titleWidth = measureHandwritten(ctx, definition.title, settings, titleSize);
    const titleX = canvasLeft + Math.max(0, (canvasWidth - titleWidth) / 2);
    const titleY = topY + Math.round(settings.fontSize * 1.0);
    writeText(ctx, definition.title, settings, titleX, titleY, random, {
      size: titleSize,
      color: ink,
    });
  }

  // ── 2. Grid ──
  const xTicks = computeTickSpec(
    definition.space.xMin,
    definition.space.xMax,
    definition.space.xStep,
  );
  const yTicks = computeTickSpec(
    definition.space.yMin,
    definition.space.yMax,
    definition.space.yStep,
  );

  if (definition.space.showGrid) {
    for (const tx of xTicks.ticks) {
      const cx = transform.toCanvasX(tx);
      drawGridLine(ctx, cx, canvasTop, cx, canvasTop + canvasHeight, random, ink);
    }
    for (const ty of yTicks.ticks) {
      const cy = transform.toCanvasY(ty);
      drawGridLine(ctx, canvasLeft, cy, canvasLeft + canvasWidth, cy, random, ink);
    }
  }

  // ── 3. Axes ──
  let axisY: number;
  if (0 >= definition.space.yMin && 0 <= definition.space.yMax) {
    axisY = transform.toCanvasY(0);
  } else if (definition.space.yMin > 0) {
    axisY = canvasTop + canvasHeight;
  } else {
    axisY = canvasTop;
  }

  let axisX: number;
  if (0 >= definition.space.xMin && 0 <= definition.space.xMax) {
    axisX = transform.toCanvasX(0);
  } else if (definition.space.xMin > 0) {
    axisX = canvasLeft;
  } else {
    axisX = canvasLeft + canvasWidth;
  }

  // X-Axis and arrow
  drawAxis(
    ctx,
    canvasLeft,
    axisY,
    canvasLeft + canvasWidth,
    axisY,
    random,
    ink,
    settings.penWidth,
  );
  drawArrowhead(ctx, canvasLeft + canvasWidth, axisY, 0, random, ink);

  // Y-Axis and arrow
  drawAxis(
    ctx,
    axisX,
    canvasTop + canvasHeight,
    axisX,
    canvasTop,
    random,
    ink,
    settings.penWidth,
  );
  drawArrowhead(ctx, axisX, canvasTop, -90, random, ink);

  // ── 4. Ticks and Numeric Labels ──
  const tickFontSize = Math.max(9, Math.round(settings.fontSize * 0.75));

  for (const tx of xTicks.ticks) {
    const cx = transform.toCanvasX(tx);
    drawTickMark(ctx, cx, axisY, true, 8, random, ink);
    if (definition.space.showAxisLabels) {
      if (
        tx === 0 &&
        definition.space.originVisible &&
        0 >= definition.space.yMin &&
        0 <= definition.space.yMax
      ) {
        continue;
      }
      const label = formatTickLabel(tx);
      const w = measureHandwritten(ctx, label, settings, tickFontSize);
      writeText(ctx, label, settings, cx - w / 2, axisY + 16, random, {
        size: tickFontSize,
        color: ink,
      });
    }
  }

  for (const ty of yTicks.ticks) {
    const cy = transform.toCanvasY(ty);
    drawTickMark(ctx, axisX, cy, false, 8, random, ink);
    if (definition.space.showAxisLabels) {
      if (
        ty === 0 &&
        definition.space.originVisible &&
        0 >= definition.space.xMin &&
        0 <= definition.space.xMax
      ) {
        continue;
      }
      const label = formatTickLabel(ty);
      const w = measureHandwritten(ctx, label, settings, tickFontSize);
      writeText(ctx, label, settings, axisX - w - 6, cy + tickFontSize * 0.35, random, {
        size: tickFontSize,
        color: ink,
      });
    }
  }

  if (
    definition.space.showAxisLabels &&
    definition.space.originVisible &&
    0 >= definition.space.xMin &&
    0 <= definition.space.xMax &&
    0 >= definition.space.yMin &&
    0 <= definition.space.yMax
  ) {
    writeText(ctx, "0", settings, axisX - tickFontSize - 4, axisY + tickFontSize + 2, random, {
      size: tickFontSize,
      color: ink,
    });
  }

  // ── 5. Axis Titles (xLabel, yLabel) ──
  if (definition.xLabel) {
    const xLabelSize = Math.round(settings.fontSize * 0.9);
    const w = measureHandwritten(ctx, definition.xLabel, settings, xLabelSize);
    writeText(
      ctx,
      definition.xLabel,
      settings,
      canvasLeft + Math.max(0, (canvasWidth - w) / 2),
      canvasTop + canvasHeight + 24,
      random,
      { size: xLabelSize, color: ink },
    );
  }

  if (definition.yLabel) {
    const yLabelSize = Math.round(settings.fontSize * 0.9);
    ctx.save();
    ctx.translate(canvasLeft - 26, canvasTop + canvasHeight / 2);
    ctx.rotate(-Math.PI / 2);
    const w = measureHandwritten(ctx, definition.yLabel, settings, yLabelSize);
    writeText(ctx, definition.yLabel, settings, -w / 2, 0, random, {
      size: yLabelSize,
      color: ink,
    });
    ctx.restore();
  }

  // ── 6. Function curves ──
  if (definition.functions && definition.functions.length > 0) {
    for (const fn of definition.functions) {
      if (!fn.expression) continue;
      try {
        const compiled = compileExpression(fn.expression);
        const samples = sampleFunction(compiled, definition.space, transform, 300);
        const segments = segmentizeSamples(samples);
        const curveColor = fn.color ?? ink;

        for (const seg of segments) {
          for (let i = 0; i < seg.points.length - 1; i++) {
            const p1 = seg.points[i]!;
            const p2 = seg.points[i + 1]!;
            drawGraphLine(
              ctx,
              p1.cx,
              p1.cy,
              p2.cx,
              p2.cy,
              random,
              curveColor,
              Math.max(0.8, settings.penWidth * 1.1),
            );
          }
        }

        if (fn.label && segments.length > 0) {
          const lastSeg = segments[segments.length - 1]!;
          if (lastSeg.points.length > 0) {
            const lastPt = lastSeg.points[lastSeg.points.length - 1]!;
            const labelSize = Math.round(settings.fontSize * 0.85);
            writeText(ctx, fn.label, settings, lastPt.cx + 6, lastPt.cy, random, {
              size: labelSize,
              color: curveColor,
            });
          }
        }
      } catch {
        // Silently skip invalid functions
      }
    }
  }

  // ── 7. Data points ──
  if (definition.points && definition.points.length > 0) {
    let prevCx: number | null = null;
    let prevCy: number | null = null;
    const markerStyle = definition.type === "scatter" ? "dot" : "cross";

    for (const pt of definition.points) {
      const cx = transform.toCanvasX(pt.x);
      const cy = transform.toCanvasY(pt.y);

      drawPointMarker(ctx, cx, cy, markerStyle, random, ink, 6);

      if (pt.connect && prevCx !== null && prevCy !== null) {
        drawGraphLine(ctx, prevCx, prevCy, cx, cy, random, ink, settings.penWidth);
      }

      if (pt.label) {
        const ptLabelSize = Math.round(settings.fontSize * 0.8);
        writeText(ctx, pt.label, settings, cx + 6, cy - 6, random, {
          size: ptLabelSize,
          color: ink,
        });
      }

      prevCx = cx;
      prevCy = cy;
    }
  }

  // ── 8. Annotations ──
  if (definition.annotations && definition.annotations.length > 0) {
    const annSize = Math.round(settings.fontSize * 0.85);
    for (const ann of definition.annotations) {
      const cx = transform.toCanvasX(ann.x);
      const cy = transform.toCanvasY(ann.y);
      writeText(ctx, ann.text, settings, cx + 8, cy, random, {
        size: annSize,
        color: ink,
      });
    }
  }
}
