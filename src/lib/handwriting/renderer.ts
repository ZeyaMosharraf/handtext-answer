import { HIGHLIGHT_COLOR, parseInline, type Seg } from "./parse";
import {
  BAND_PAD_TOP,
  BAND_ROW_HEIGHT,
  bandApplies,
  bandElementText,
  createPageCoordinateSystem,
  getBaseline,
  getNearestBaseline,
  layoutDocument,
  visibleBandElements,
  type LayoutPage,
  type LayoutTableBounds,
  type PageCoordinateSystem,
} from "./layout";
import {
  fontSizeForTextSize,
  formatPageNumber,
  inkHex,
  type BandConfig,
  type HandwritingSettings,
  type RulingType,
} from "./types";
import { resolveEffectiveBand } from "./band-operations";
import {
  makeRng,
  hashString,
  withAlpha,
  plainSegments,
  handUnderline,
  drawHighlighterWash,
  estimateSegmentWidth,
  writeSegments,
  writeText,
  measureHandwritten,
  measureSegments,
  inkLine,
  type PenOptions,
} from "./pen";
import { parseMath, layoutMath } from "../math";

export interface RenderInput {
  question?: string;
  content: string;
  settings: HandwritingSettings;
  debugLayout?: boolean;
}

function paintPaper(
  ctx: CanvasRenderingContext2D,
  settings: HandwritingSettings,
  coordinates: PageCoordinateSystem,
  random: () => number,
) {
  const { pageWidth, pageHeight, rulingSpacing, firstBaselineY, headerHeight, footerHeight, contentBottom } = coordinates;
  const paperTop = 0;
  const paperBottom = pageHeight;
  ctx.fillStyle = settings.page.paperColor;
  ctx.fillRect(0, 0, pageWidth, pageHeight);

  const textureDots = { off: 0, low: 500, medium: 1100, high: 2200 }[settings.page.texture];
  if (textureDots) {
    ctx.save();
    ctx.globalAlpha = 0.03;
    ctx.fillStyle = "#8a7f6a";
    for (let index = 0; index < textureDots; index++) {
      ctx.fillRect(random() * pageWidth, random() * pageHeight, 1.4, 1.4);
    }
    ctx.restore();
  }

  const ruling = settings.page.ruling;
  const rulingType: RulingType =
    ruling.type ??
    (settings.paper === "plain"
      ? "plain"
      : settings.paper === "dotted"
      ? "dotted"
      : settings.paper === "graph" || settings.paper === "grid"
      ? "graph"
      : "ruled");

  if (ruling.enabled && rulingType !== "plain") {
    ctx.strokeStyle = withAlpha(ruling.color, ruling.opacity);
    ctx.lineWidth = ruling.thickness;
    const step = ruling.spacing && ruling.spacing > 0 ? ruling.spacing : rulingSpacing;
    if (rulingType === "graph" || settings.paper === "grid" || settings.paper === "graph") {
      const gStep = settings.paper === "graph" ? step / 4 : step / 2;
      for (let x = gStep; x < pageWidth; x += gStep) {
        ctx.beginPath();
        ctx.moveTo(x, paperTop);
        ctx.lineTo(x, paperBottom);
        ctx.stroke();
      }
      for (let y = firstBaselineY; y <= contentBottom; y += gStep) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(pageWidth, y);
        ctx.stroke();
      }
    } else if (rulingType === "dotted") {
      const dStep = step / 2;
      ctx.save();
      ctx.fillStyle = withAlpha(ruling.color, Math.min(1, ruling.opacity + 0.15));
      for (let y = firstBaselineY; y <= contentBottom; y += dStep) {
        for (let x = dStep; x < pageWidth; x += dStep) {
          ctx.beginPath();
          ctx.arc(x, y, Math.max(0.9, ruling.thickness), 0, Math.PI * 2);
          ctx.fill();
        }
      }
      ctx.restore();
    } else {
      // Real physical ruled notebook paper:
      // Ruled writing lines run across the writing area from pad to pad, crossing the vertical red margin line.
      // They begin strictly below the header area on the master ruling lattice.
      const left = settings.paper === "exam" ? 0 : 36;
      const right = settings.paper === "exam" ? pageWidth : pageWidth - 36;
      const lastRuledY = footerHeight > 0 ? pageHeight - footerHeight - 1 : contentBottom;

      for (let y = firstBaselineY; y <= lastRuledY; y += step) {
        ctx.beginPath();
        ctx.moveTo(left, y);
        ctx.lineTo(right, y);
        ctx.stroke();
        if (settings.paper === "double" || settings.paper === "narrow") {
          ctx.save();
          ctx.globalAlpha = 0.4;
          ctx.beginPath();
          ctx.moveTo(left, y - step * 0.32);
          ctx.lineTo(right, y - step * 0.32);
          ctx.stroke();
          ctx.restore();
        }
      }
    }
  }

  if (settings.paper === "cornell") {
    const cueX = Math.max(settings.page.margin.position, pageWidth * 0.28);
    ctx.save();
    ctx.strokeStyle = withAlpha(settings.page.margin.color, 0.85);
    ctx.lineWidth = Math.max(1, settings.page.margin.thickness);
    ctx.beginPath();
    ctx.moveTo(cueX, paperTop);
    ctx.lineTo(cueX, contentBottom - 180);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(40, contentBottom - 180);
    ctx.lineTo(pageWidth - 40, contentBottom - 180);
    ctx.stroke();
    ctx.restore();
  }
  if (settings.paper === "border") {
    ctx.save();
    ctx.strokeStyle = withAlpha(settings.page.margin.color, 0.9);
    ctx.lineWidth = Math.max(1.5, settings.page.margin.thickness);
    ctx.strokeRect(46, 46, pageWidth - 92, pageHeight - 92);
    ctx.globalAlpha = 0.6;
    ctx.strokeRect(58, 58, pageWidth - 116, pageHeight - 116);
    ctx.restore();
  }
  if (settings.page.margin.enabled) {
    ctx.strokeStyle = settings.page.margin.color;
    ctx.lineWidth = settings.page.margin.thickness;
    ctx.beginPath();
    ctx.moveTo(settings.page.margin.position, paperTop);
    ctx.lineTo(settings.page.margin.position, paperBottom);
    ctx.stroke();
  }
}

function drawBand(
  ctx: CanvasRenderingContext2D,
  which: "header" | "footer",
  band: BandConfig,
  settings: HandwritingSettings,
  coordinates: PageCoordinateSystem,
  topY: number,
  pageNumber: number,
  totalPages: number,
  random: () => number,
) {
  if (!band.enabled || !bandApplies(band, pageNumber, totalPages)) return;
  const isHeader = which === "header";
  const activeHeight = isHeader ? coordinates.headerHeight : coordinates.footerHeight;
  if (activeHeight <= 0) return;
  const pad = 36;
  const left = coordinates.contentLeft;
  const right = coordinates.pageWidth - pad;

  const topRule = topY;
  const bottomRule = Math.min(coordinates.pageHeight - 1, topY + activeHeight);

  // Draw borders aligned with physical page coordinate lattice
  ctx.save();
  ctx.strokeStyle = band.borderColor || withAlpha(settings.page.ruling.color, 0.7);
  ctx.lineWidth = 1.2;
  if (band.borderTop) {
    ctx.beginPath();
    ctx.moveTo(pad, topRule);
    ctx.lineTo(coordinates.pageWidth - pad, topRule);
    ctx.stroke();
  }
  if (band.borderBottom) {
    ctx.beginPath();
    ctx.moveTo(pad, bottomRule);
    ctx.lineTo(coordinates.pageWidth - pad, bottomRule);
    ctx.stroke();
  }
  ctx.restore();

  const visible = visibleBandElements(band, pageNumber, totalPages);

  if (isHeader) {
    // Separate right-aligned metadata elements from others
    const rightElements = visible.filter((el) => el.slot === "right");
    const otherElements = visible.filter((el) => el.slot !== "right");

    // Classic assignment metadata box is drawn when 2 or more right-aligned metadata elements exist (e.g. Date + Page)
    const showBox = settings.templateId !== "notebook" && rightElements.length >= 2;

    if (showBox) {
      // Physical assignment-sheet top-right printed metadata box
      const boxWidth = 230;
      const boxRight = coordinates.pageWidth - pad;
      const boxLeft = boxRight - boxWidth;
      const rowCount = Math.max(1, rightElements.length);
      const boxRowHeight = Math.min(32, Math.floor((activeHeight - 20) / rowCount));
      const boxHeight = rowCount * boxRowHeight;
      const boxTop = Math.max(12, Math.floor((activeHeight - boxHeight) / 2));

      ctx.save();
      ctx.strokeStyle = band.borderColor || withAlpha(settings.page.ruling.color, 0.75);
      ctx.lineWidth = 1;
      ctx.strokeRect(boxLeft, boxTop, boxWidth, boxHeight);
      for (let i = 1; i < rowCount; i++) {
        const lineY = boxTop + i * boxRowHeight;
        ctx.beginPath();
        ctx.moveTo(boxLeft, lineY);
        ctx.lineTo(boxRight, lineY);
        ctx.stroke();
      }
      ctx.restore();

      rightElements.forEach((element, index) => {
        const effectiveFontSize = element.textSize ? fontSizeForTextSize(element.textSize) : (element.fontSize || 20);
        const rowY = boxTop + index * boxRowHeight;
        const baselineY = rowY + Math.round(boxRowHeight * 0.7);
        const text = bandElementText(element, pageNumber, totalPages);
        const penColor = element.color && element.color !== "#333333" ? element.color : inkHex(settings);

        if (element.handwritten) {
          const label = element.label.trim();
          const start = Math.max(
            1,
            typeof element.startPageNumber === "number" && !isNaN(element.startPageNumber)
              ? Math.floor(element.startPageNumber)
              : 1,
          );
          const displayPageNumber = start + (pageNumber - 1);
          const value =
            element.kind === "pageNumber"
              ? formatPageNumber(element.format, displayPageNumber, totalPages)
              : element.value.trim();
          const boxFontScale = effectiveFontSize / 20;
          const boxFontSize = Math.round(13 * boxFontScale);
          if (label && value) {
            ctx.save();
            ctx.font = `${boxFontSize}px "Plus Jakarta Sans", ui-sans-serif, sans-serif`;
            ctx.fillStyle = withAlpha("#333333", 0.75);
            ctx.textBaseline = "alphabetic";
            ctx.fillText(`${label}:`, boxLeft + 8, baselineY);
            const labelW = ctx.measureText(`${label}: `).width;
            ctx.restore();
            writeText(ctx, value, settings, boxLeft + 8 + labelW, baselineY, random, {
              size: effectiveFontSize * 1.05,
              color: penColor,
            });
          } else if (label) {
            ctx.save();
            ctx.font = `${boxFontSize}px "Plus Jakarta Sans", ui-sans-serif, sans-serif`;
            ctx.fillStyle = withAlpha("#333333", 0.75);
            ctx.textBaseline = "alphabetic";
            ctx.fillText(`${label}:`, boxLeft + 8, baselineY);
            ctx.restore();
          } else {
            writeText(ctx, text, settings, boxLeft + 8, baselineY, random, {
              size: effectiveFontSize * 1.05,
              color: penColor,
            });
          }
        } else {
          ctx.save();
          const boxFontScale = effectiveFontSize / 20;
          const boxFontSize = Math.round(13 * boxFontScale);
          ctx.font = `${boxFontSize}px "Plus Jakarta Sans", ui-sans-serif, sans-serif`;
          ctx.fillStyle = "#333333";
          ctx.textBaseline = "alphabetic";
          ctx.fillText(text, boxLeft + 8, baselineY);
          ctx.restore();
        }
      });

      // Left and center aligned elements in header alongside the box
      otherElements.forEach((element, idx) => {
        const effectiveFontSize = element.textSize ? fontSizeForTextSize(element.textSize) : (element.fontSize || 20);
        const text = bandElementText(element, pageNumber, totalPages);
        const slotIndex = otherElements.slice(0, idx).filter((prev) => prev.slot === element.slot).length;
        const hasRowCollision = otherElements.slice(0, idx).some(
          (prev) => (typeof prev.row === "number" ? prev.row : 0) === element.row && prev.slot === element.slot,
        );
        const effectiveRow = typeof element.row === "number" && !hasRowCollision ? element.row : slotIndex;
        const requestedBaseline = topY + BAND_PAD_TOP + effectiveRow * BAND_ROW_HEIGHT + effectiveFontSize * 0.6;
        const baselineY = Math.min(topY + activeHeight - 8, Math.max(topY + effectiveFontSize, requestedBaseline));
        if (element.handwritten) {
          const penColor = element.color && element.color !== "#333333" ? element.color : inkHex(settings);
          const size = effectiveFontSize * 1.2;
          const width = measureHandwritten(ctx, text, settings, size);
          const x = element.slot === "left" ? left : coordinates.pageWidth / 2 - width / 2;
          writeText(ctx, text, settings, x, baselineY, random, { size, color: penColor });
        } else {
          ctx.save();
          ctx.font = `${effectiveFontSize}px "Plus Jakarta Sans", ui-sans-serif, sans-serif`;
          ctx.fillStyle = "#333333";
          ctx.textBaseline = "alphabetic";
          ctx.textAlign = element.slot === "left" ? "left" : "center";
          ctx.fillText(text, element.slot === "left" ? left : coordinates.pageWidth / 2, baselineY);
          ctx.restore();
        }
      });
    } else {
      // Standard header elements without metadata box: all slots (left, center, right)
      visible.forEach((element, idx) => {
        const effectiveFontSize = element.textSize ? fontSizeForTextSize(element.textSize) : (element.fontSize || 20);
        const text = bandElementText(element, pageNumber, totalPages);
        const slotIndex = visible.slice(0, idx).filter((prev) => prev.slot === element.slot).length;
        const hasRowCollision = visible.slice(0, idx).some(
          (prev) => (typeof prev.row === "number" ? prev.row : 0) === element.row && prev.slot === element.slot,
        );
        const effectiveRow = typeof element.row === "number" && !hasRowCollision ? element.row : slotIndex;
        const requestedBaseline = topY + BAND_PAD_TOP + effectiveRow * BAND_ROW_HEIGHT + effectiveFontSize * 0.6;
        const baselineY = Math.min(topY + activeHeight - 8, Math.max(topY + effectiveFontSize, requestedBaseline));
        if (element.handwritten) {
          const penColor = element.color && element.color !== "#333333" ? element.color : inkHex(settings);
          const size = effectiveFontSize * 1.2;
          const width = measureHandwritten(ctx, text, settings, size);
          const x =
            element.slot === "left" ? left : element.slot === "center" ? coordinates.pageWidth / 2 - width / 2 : right - width;
          writeText(ctx, text, settings, x, baselineY, random, { size, color: penColor });
        } else {
          ctx.save();
          ctx.font = `${effectiveFontSize}px "Plus Jakarta Sans", ui-sans-serif, sans-serif`;
          ctx.fillStyle = "#333333";
          ctx.textBaseline = "alphabetic";
          ctx.textAlign = element.slot === "left" ? "left" : element.slot === "center" ? "center" : "right";
          ctx.fillText(text, element.slot === "left" ? left : element.slot === "center" ? coordinates.pageWidth / 2 : right, baselineY);
          ctx.restore();
        }
      });
    }
  } else {
    // Footer elements: strictly contained within footer boundary
    visible.forEach((element, idx) => {
      const effectiveFontSize = element.textSize ? fontSizeForTextSize(element.textSize) : (element.fontSize || 20);
      const text = bandElementText(element, pageNumber, totalPages);
      // Auto-resolve row collision so elements sharing the same slot never overlap vertically
      const slotIndex = visible.slice(0, idx).filter((prev) => prev.slot === element.slot).length;
      const hasRowCollision = visible.slice(0, idx).some(
        (prev) => (typeof prev.row === "number" ? prev.row : 0) === element.row && prev.slot === element.slot,
      );
      const effectiveRow = typeof element.row === "number" && !hasRowCollision ? element.row : slotIndex;
      const footerRowHeight = 32;
      const requestedBaseline = topY + BAND_PAD_TOP + effectiveRow * footerRowHeight + effectiveFontSize * 0.6;
      const baselineY = Math.min(topY + activeHeight - 8, Math.max(topY + effectiveFontSize, requestedBaseline));
      if (element.handwritten) {
        const penColor = element.color && element.color !== "#333333" ? element.color : inkHex(settings);
        const size = effectiveFontSize * 1.2;
        const width = measureHandwritten(ctx, text, settings, size);
        const x =
          element.slot === "left" ? left : element.slot === "center" ? coordinates.pageWidth / 2 - width / 2 : right - width;
        writeText(ctx, text, settings, x, baselineY, random, { size, color: penColor });
      } else {
        ctx.save();
        ctx.font = `${effectiveFontSize}px "Plus Jakarta Sans", ui-sans-serif, sans-serif`;
        ctx.fillStyle = "#333333";
        ctx.textBaseline = "alphabetic";
        ctx.textAlign = element.slot === "left" ? "left" : element.slot === "center" ? "center" : "right";
        ctx.fillText(text, element.slot === "left" ? left : element.slot === "center" ? coordinates.pageWidth / 2 : right, baselineY);
        ctx.restore();
      }
    });
  }
}

function drawMathBlock(
  ctx: CanvasRenderingContext2D,
  placement: Extract<LayoutPage["placements"][number], { type: "mathBlock" }>,
  settings: HandwritingSettings,
  coordinates: PageCoordinateSystem,
  random: () => number,
  ink: string,
): void {
  const ast = parseMath(placement.latex);
  const box = layoutMath(ast, ctx, settings, 1.0);

  // Baseline:
  // For 1-line formulas, lock directly to the ruled line baseline for 100% handwriting consistency.
  // For multi-line formulas (e.g. 2-story fractions), balance the formula's math axis across the allocated lines.
  const rulingSpacing = coordinates.rulingSpacing;
  const ruledLineY = getBaseline(coordinates, placement.lineIndex);
  let baselineY = ruledLineY;

  if (placement.lineUnits === 1) {
    // For 1-line formulas, lock directly to the ruled line baseline for normal text/math.
    // If expression has a deep descent (like a compact fraction denominator),
    // lift it so the bottom rests cleanly on the ruled line instead of cutting through.
    if (box.descent > rulingSpacing * 0.12) {
      baselineY = ruledLineY - box.descent;
    }
  } else {
    // For multi-line formulas (e.g. multi-line fractions, integrals, large matrices),
    // center the formula box vertically across the allocated ruled lines band.
    const bandCenterY = ruledLineY + (placement.lineUnits - 1) * rulingSpacing * 0.5;
    const boxCenterRel = (box.descent - box.ascent) * 0.5;
    baselineY = bandCenterY - boxCenterRel;
  }

  // Left-align with content margin matching normal handwritten lines
  const startX = coordinates.contentLeft;

  box.draw(ctx, startX, baselineY, settings, random, ink);
}

function drawTableRow(
  ctx: CanvasRenderingContext2D,
  placement: Extract<LayoutPage["placements"][number], { type: "tableRow" }>,
  settings: HandwritingSettings,
  coordinates: PageCoordinateSystem,
  random: () => number,
  ink: string,
): LayoutTableBounds {
  // A notebook table uses the paper's existing horizontal rules: every row
  // begins one rule above its first text baseline and ends on its last one.
  const top = getBaseline(coordinates, placement.lineIndex - 1);
  const bottom = getBaseline(coordinates, placement.lineIndex + placement.lineUnits - 1);
  const left = coordinates.contentLeft;
  const width = placement.columnWidths.reduce((sum, columnWidth) => sum + columnWidth, 0);
  const right = Math.min(coordinates.contentRight, left + width);
  const border = settings.table.borderColor || ink;

  if (placement.isFirst) inkLine(ctx, left, top, right, top, random, border, settings.table.borderWidth);
  inkLine(ctx, left, bottom, right, bottom, random, border, settings.table.borderWidth);
  let x = left;
  for (let column = 0; column <= placement.columnWidths.length; column++) {
    inkLine(ctx, x, top, x, bottom, random, border, settings.table.borderWidth);
    x += placement.columnWidths[column] ?? 0;
  }

  x = left;
  placement.cells.forEach((lines, column) => {
    const colWidth = placement.columnWidths[column] ?? 0;
    const colLeft = x;
    const innerWidth = Math.max(0, colWidth - settings.table.cellPadding * 2);
    const align = placement.alignments?.[column] ?? "left";

    const availableLines = placement.lineUnits;
    const firstTextLine = placement.lineIndex + Math.max(0, Math.floor((availableLines - lines.length) / 2));
    const fontScale = settings.table.fontScale;
    const baseSize = settings.fontSize * fontScale * (placement.isHeader ? 1.02 : 1);
    const baselineOffset = Math.max(0, coordinates.rulingSpacing * 0.5 - baseSize * 0.25);

    lines.forEach((cellLine, line) => {
      const lineText = typeof cellLine === "string" ? cellLine : cellLine.text;
      if (!lineText || !lineText.trim()) return;

      const segs =
        typeof cellLine !== "string" && cellLine.segs && cellLine.segs.length > 0
          ? cellLine.segs
          : parseInline(lineText);
      const lineWidth = measureSegments(ctx, segs, settings, baseSize);

      let textX = colLeft + settings.table.cellPadding;
      if (align === "center") {
        textX = colLeft + settings.table.cellPadding + Math.max(0, (innerWidth - lineWidth) / 2);
      } else if (align === "right") {
        textX = colLeft + settings.table.cellPadding + Math.max(0, innerWidth - lineWidth);
      }

      writeSegments(
        ctx,
        segs,
        settings,
        textX,
        getBaseline(coordinates, firstTextLine + line) - baselineOffset,
        random,
        {
          size: baseSize,
          color: ink,
          scale: fontScale,
        },
      );
    });
    x += colWidth;
  });
  return { tableId: placement.tableId, left, top, right, bottom };
}

function drawDebug(
  ctx: CanvasRenderingContext2D,
  coordinates: PageCoordinateSystem,
  tableBounds: LayoutTableBounds[],
) {
  ctx.save();
  ctx.font = '12px ui-monospace, monospace';
  ctx.textBaseline = "alphabetic";
  ctx.strokeStyle = "rgba(220,38,38,.75)";
  ctx.fillStyle = "rgba(220,38,38,.9)";
  ctx.strokeRect(
    coordinates.contentLeft,
    coordinates.contentTop,
    coordinates.contentRight - coordinates.contentLeft,
    coordinates.contentBottom - coordinates.contentTop,
  );
  const capacity = Math.floor((coordinates.contentBottom - coordinates.firstBaselineY) / coordinates.rulingSpacing) + 1;
  for (let line = 0; line < capacity; line++) {
    const y = getBaseline(coordinates, line);
    ctx.beginPath();
    ctx.moveTo(coordinates.contentLeft, y);
    ctx.lineTo(coordinates.contentRight, y);
    ctx.stroke();
    ctx.fillText(`baseline ${line}`, coordinates.contentRight - 80, y - 2);
  }
  ctx.strokeStyle = "rgba(22,163,74,.8)";
  if (coordinates.headerHeight > 0) ctx.strokeRect(0, 0, coordinates.pageWidth, coordinates.headerHeight);
  if (coordinates.footerHeight > 0) {
    ctx.strokeRect(0, coordinates.pageHeight - coordinates.footerHeight, coordinates.pageWidth, coordinates.footerHeight);
  }
  ctx.strokeStyle = "rgba(147,51,234,.9)";
  for (const bounds of tableBounds) ctx.strokeRect(bounds.left, bounds.top, bounds.right - bounds.left, bounds.bottom - bounds.top);
  ctx.restore();
}

/** Writing area of a page as fractions of the page, for the direct-writing overlay. */
export function writingArea(settings: HandwritingSettings, pageNumber = 1, totalPages = 1) {
  const coordinates = createPageCoordinateSystem(settings, undefined, pageNumber, totalPages);
  const line0Top = coordinates.firstBaselineY - coordinates.rulingSpacing;
  return {
    pageWidth: coordinates.pageWidth,
    pageHeight: coordinates.pageHeight,
    left: coordinates.contentLeft / coordinates.pageWidth,
    top: line0Top / coordinates.pageHeight,
    width: (coordinates.contentRight - coordinates.contentLeft) / coordinates.pageWidth,
    height: (coordinates.contentBottom - line0Top) / coordinates.pageHeight,
    lineHeight: coordinates.rulingSpacing,
    fontSize: settings.fontSize,
    firstBaselineY: coordinates.firstBaselineY,
    rulingSpacing: coordinates.rulingSpacing,
    contentLeft: coordinates.contentLeft,
    contentRight: coordinates.contentRight,
    coordinates,
  };
}

/**
 * Renders a single page directly into an existing canvas element for immediate interactive display.
 * Avoids toDataURL and image decoding overhead to achieve instantaneous 60fps responsiveness.
 */
export async function renderPageToCanvas(
  input: RenderInput,
  targetCanvas: HTMLCanvasElement,
  pageIndex = 0,
): Promise<{ totalPages: number; coordinates: PageCoordinateSystem }> {
  await ensureFontsReady([input.settings.fontFamily]);
  const measurer = document.createElement("canvas").getContext("2d");
  if (!measurer) throw new Error("Canvas rendering is unavailable");
  const documentLayout = layoutDocument(measurer, input);
  const totalPages = documentLayout.pages.length;
  const clampedIndex = totalPages > 0 ? Math.max(0, Math.min(pageIndex, totalPages - 1)) : 0;
  const page = documentLayout.pages[clampedIndex] ?? documentLayout.pages[0];
  if (!page) throw new Error("No page available to render");

  if (targetCanvas.width !== page.coordinates.pageWidth || targetCanvas.height !== page.coordinates.pageHeight) {
    targetCanvas.width = page.coordinates.pageWidth;
    targetCanvas.height = page.coordinates.pageHeight;
  }

  const ctx = targetCanvas.getContext("2d");
  if (!ctx) throw new Error("Canvas context is unavailable");

  const ink = inkHex(input.settings);
  const seed = hashString(`${input.content}|${input.question ?? ""}|${input.settings.styleId}|${input.settings.fontFamily}`);
  const random = makeRng(seed + page.pageNumber * 7919);

  paintPaper(ctx, input.settings, page.coordinates, random);
  const effectiveHeader = resolveEffectiveBand(input.settings, "header", page.pageNumber, totalPages);
  if (effectiveHeader.enabled) {
    drawBand(ctx, "header", effectiveHeader, input.settings, page.coordinates, 0, page.pageNumber, totalPages, random);
  }
  const effectiveFooter = resolveEffectiveBand(input.settings, "footer", page.pageNumber, totalPages);
  if (effectiveFooter.enabled) {
    drawBand(
      ctx,
      "footer",
      effectiveFooter,
      input.settings,
      page.coordinates,
      page.coordinates.pageHeight - page.coordinates.footerHeight,
      page.pageNumber,
      totalPages,
      random,
    );
  }

  const tableBounds: LayoutTableBounds[] = [];
  for (const placement of page.placements) {
    if (placement.type === "tableRow") {
      tableBounds.push(drawTableRow(ctx, placement, input.settings, page.coordinates, random, ink));
      continue;
    }
    if (placement.type === "mathBlock") {
      drawMathBlock(ctx, placement, input.settings, page.coordinates, random, ink);
      continue;
    }
    const segments = placement.marker
      ? [...plainSegments(`${placement.marker} `), ...placement.segs]
      : placement.segs;
    if (!segments.some((segment) => segment.text.trim())) continue;
    writeSegments(
      ctx,
      segments,
      input.settings,
      page.coordinates.contentLeft + placement.indent,
      getBaseline(page.coordinates, placement.lineIndex),
      random,
      {
        size: input.settings.fontSize * placement.scale,
        color: ink,
        scale: placement.scale,
        underline: placement.underline,
      },
    );
  }

  if (import.meta.env.DEV && input.debugLayout === true) drawDebug(ctx, page.coordinates, tableBounds);

  return { totalPages, coordinates: page.coordinates };
}

export interface RenderedPage {
  canvas: HTMLCanvasElement;
  pageNumber: number;
}

export async function ensureFontsReady(families: string[]) {
  if (typeof document === "undefined" || !("fonts" in document)) return;
  await Promise.all(families.flatMap((family) => [document.fonts.load(`30px "${family}"`), document.fonts.load(`40px "${family}"`)]));
  await document.fonts.ready;
}

export async function renderPages(input: RenderInput): Promise<RenderedPage[]> {
  await ensureFontsReady([input.settings.fontFamily]);
  const measurer = document.createElement("canvas").getContext("2d");
  if (!measurer) throw new Error("Canvas rendering is unavailable");
  const documentLayout = layoutDocument(measurer, input);
  const totalPages = documentLayout.pages.length;
  const ink = inkHex(input.settings);
  const seed = hashString(`${input.content}|${input.question ?? ""}|${input.settings.styleId}|${input.settings.fontFamily}`);

  return documentLayout.pages.map((page) => {
    const canvas = document.createElement("canvas");
    canvas.width = page.coordinates.pageWidth;
    canvas.height = page.coordinates.pageHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas rendering is unavailable");
    const random = makeRng(seed + page.pageNumber * 7919);
    paintPaper(ctx, input.settings, page.coordinates, random);
    const effectiveHeader = resolveEffectiveBand(input.settings, "header", page.pageNumber, totalPages);
    if (effectiveHeader.enabled) {
      drawBand(ctx, "header", effectiveHeader, input.settings, page.coordinates, 0, page.pageNumber, totalPages, random);
    }
    const effectiveFooter = resolveEffectiveBand(input.settings, "footer", page.pageNumber, totalPages);
    if (effectiveFooter.enabled) {
      drawBand(
        ctx,
        "footer",
        effectiveFooter,
        input.settings,
        page.coordinates,
        page.coordinates.pageHeight - page.coordinates.footerHeight,
        page.pageNumber,
        totalPages,
        random,
      );
    }

    const tableBounds: LayoutTableBounds[] = [];
    for (const placement of page.placements) {
      if (placement.type === "tableRow") {
        tableBounds.push(drawTableRow(ctx, placement, input.settings, page.coordinates, random, ink));
        continue;
      }
      if (placement.type === "mathBlock") {
        drawMathBlock(ctx, placement, input.settings, page.coordinates, random, ink);
        continue;
      }
      const segments = placement.marker
        ? [...plainSegments(`${placement.marker} `), ...placement.segs]
        : placement.segs;
      if (!segments.some((segment) => segment.text.trim())) continue;
      writeSegments(
        ctx,
        segments,
        input.settings,
        page.coordinates.contentLeft + placement.indent,
        getBaseline(page.coordinates, placement.lineIndex),
        random,
        {
          size: input.settings.fontSize * placement.scale,
          color: ink,
          scale: placement.scale,
          underline: placement.underline,
        },
      );
    }

    if (import.meta.env.DEV && input.debugLayout === true) drawDebug(ctx, page.coordinates, tableBounds);
    return { canvas, pageNumber: page.pageNumber };
  });
}

export {
  createPageCoordinateSystem,
  getBaseline,
  getLineIndexAtPageY,
  getNearestBaseline,
  layoutDocument,
  lineCapacity,
  pageToScreen,
  screenToPage,
} from "./layout";
export type { LayoutDocument, LayoutPage, LayoutPlacement, PageCoordinateSystem } from "./layout";