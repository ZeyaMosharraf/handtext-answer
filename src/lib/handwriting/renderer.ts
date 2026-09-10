import { type Seg } from "./parse";
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
import { formatPageNumber, inkHex, type BandConfig, type HandwritingSettings, type RulingType } from "./types";

function makeRng(seed: number) {
  let state = seed >>> 0 || 1;
  return () => {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    return ((state >>> 0) % 100000) / 100000;
  };
}

function hashString(input: string) {
  let hash = 2166136261;
  for (let index = 0; index < input.length; index++) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function withAlpha(hex: string, alpha: number) {
  const clean = hex.replace("#", "");
  const full = clean.length === 3 ? clean.split("").map((character) => character + character).join("") : clean;
  const red = parseInt(full.slice(0, 2), 16) || 0;
  const green = parseInt(full.slice(2, 4), 16) || 0;
  const blue = parseInt(full.slice(4, 6), 16) || 0;
  return `rgba(${red},${green},${blue},${alpha})`;
}

export interface RenderInput {
  question?: string;
  content: string;
  settings: HandwritingSettings;
  debugLayout?: boolean;
}

interface PenOptions {
  size: number;
  color: string;
  scale?: number;
  underline?: boolean;
}

function plainSegments(text: string): Seg[] {
  return text ? [{ text, bold: false, underline: false, italic: false }] : [];
}

function handUnderline(
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

function writeSegments(
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
    const color = segment.color ?? pen.color;
    for (const character of segment.text) {
      if (character === " ") {
        x +=
          (settings.wordSpacing + (random() - 0.5) * settings.wordSpacing * 0.35 * settings.imperfection) *
          (1 - speed * 0.18) *
          scale;
        continue;
      }
      const sizeJitter = 1 + (random() - 0.5) * 0.07 * settings.charVariation;
      const widthJitter = 1 + (random() - 0.5) * 0.05 * settings.charVariation;
      const size = pen.size * sizeJitter;
      const italicSlant = segment.italic ? 12 : 0;
      const slant = (settings.slant + italicSlant + (random() - 0.5) * settings.slantVariation + speed * 1.2) * (Math.PI / 180);
      const rotation = (random() - 0.5) * 0.012 * settings.imperfection * 6;
      const characterBaselineJitter = (random() - 0.5) * settings.baselineVariation;
      const horizontal = settings.compactness * widthJitter * (1 - speed * 0.06);

      ctx.save();
      ctx.font = `${segment.italic ? "italic " : ""}${size}px "${settings.fontFamily}", cursive`;
      ctx.fillStyle = color;
      ctx.globalAlpha = Math.min(1, (segment.bold ? 1 : settings.inkIntensity) + (random() - 0.5) * 0.22 * settings.inkVariation);
      ctx.translate(x, baselineY + characterBaselineJitter);
      ctx.rotate(rotation);
      ctx.transform(horizontal, 0, -Math.tan(slant), 1, 0, 0);
      const stroke =
        (settings.penWidth - 1) * 0.7 +
        pressure * 0.9 +
        (segment.bold ? 1.1 : 0) +
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
      x += ctx.measureText(character).width * horizontal + settings.letterSpacing * scale * (1 - speed * 0.3);
    }
    if (segment.underline) handUnderline(ctx, settings, segmentStart, x, baselineY + 7, color, random);
  }
  if (pen.underline) handUnderline(ctx, settings, baseX, x, baselineY + 8, pen.color, random);
  ctx.restore();
  return x;
}

function writeText(
  ctx: CanvasRenderingContext2D,
  text: string,
  settings: HandwritingSettings,
  x: number,
  baselineY: number,
  random: () => number,
  pen: PenOptions,
) {
  if (!text.trim()) return x;
  return writeSegments(ctx, plainSegments(text), settings, x, baselineY, random, pen);
}

function measureHandwritten(ctx: CanvasRenderingContext2D, text: string, settings: HandwritingSettings, size: number) {
  if (!text.trim()) return 0;
  ctx.font = `${size}px "${settings.fontFamily}", cursive`;
  return ctx.measureText(text).width * settings.compactness + text.length * settings.letterSpacing;
}

function inkLine(
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
  band: BandConfig,
  settings: HandwritingSettings,
  coordinates: PageCoordinateSystem,
  topY: number,
  pageNumber: number,
  totalPages: number,
  random: () => number,
) {
  if (!band.enabled || !bandApplies(band, pageNumber, totalPages)) return;
  const isHeader = band === settings.header;
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
    // Separate right-aligned metadata elements (e.g. Date, Page Number) from others
    const rightElements = visible.filter((el) => el.slot === "right");
    const otherElements = visible.filter((el) => el.slot !== "right");

    if (rightElements.length > 0) {
      // Physical assignment-sheet top-right printed metadata box
      const boxWidth = 230;
      const boxRight = coordinates.pageWidth - pad;
      const boxLeft = boxRight - boxWidth;
      const rowCount = Math.max(1, rightElements.length);
      const boxRowHeight = Math.min(32, Math.floor((activeHeight - 20) / rowCount));
      const boxHeight = rowCount * boxRowHeight;
      const boxTop = Math.max(12, Math.floor((activeHeight - boxHeight) / 2));

      const showBox = settings.templateId !== "notebook" && (rightElements.length > 1 || band.borderBottom);

      if (showBox) {
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
      }

      rightElements.forEach((element, index) => {
        const rowY = boxTop + index * boxRowHeight;
        const baselineY = rowY + Math.round(boxRowHeight * 0.7);
        const text = bandElementText(element, pageNumber, totalPages);

        if (element.handwritten) {
          const label = element.label.trim();
          const value =
            element.kind === "pageNumber"
              ? formatPageNumber(element.format, pageNumber, totalPages)
              : element.value.trim();
          if (label && value) {
            ctx.save();
            ctx.font = '13px "Plus Jakarta Sans", ui-sans-serif, sans-serif';
            ctx.fillStyle = withAlpha(element.color, 0.75);
            ctx.textBaseline = "alphabetic";
            ctx.fillText(`${label}:`, boxLeft + 8, baselineY);
            const labelW = ctx.measureText(`${label}: `).width;
            ctx.restore();
            writeText(ctx, value, settings, boxLeft + 8 + labelW, baselineY, random, {
              size: element.fontSize * 1.05,
              color: element.color,
            });
          } else if (label) {
            ctx.save();
            ctx.font = '13px "Plus Jakarta Sans", ui-sans-serif, sans-serif';
            ctx.fillStyle = withAlpha(element.color, 0.75);
            ctx.textBaseline = "alphabetic";
            ctx.fillText(`${label}:`, boxLeft + 8, baselineY);
            ctx.restore();
          } else {
            writeText(ctx, text, settings, boxLeft + 8, baselineY, random, {
              size: element.fontSize * 1.05,
              color: element.color,
            });
          }
        } else {
          ctx.save();
          ctx.font = '13px "Plus Jakarta Sans", ui-sans-serif, sans-serif';
          ctx.fillStyle = element.color;
          ctx.textBaseline = "alphabetic";
          ctx.fillText(text, boxLeft + 8, baselineY);
          ctx.restore();
        }
      });
    }

    // Left and center aligned elements in header
    for (const element of otherElements) {
      const text = bandElementText(element, pageNumber, totalPages);
      const requestedBaseline = topY + BAND_PAD_TOP + element.row * BAND_ROW_HEIGHT + element.fontSize * 0.6;
      const baselineY = Math.min(topY + activeHeight - 8, Math.max(topY + element.fontSize, requestedBaseline));
      if (element.handwritten) {
        const size = element.fontSize * 1.2;
        const width = measureHandwritten(ctx, text, settings, size);
        const x = element.slot === "left" ? left : coordinates.pageWidth / 2 - width / 2;
        writeText(ctx, text, settings, x, baselineY, random, { size, color: element.color });
      } else {
        ctx.save();
        ctx.font = `${element.fontSize}px "Plus Jakarta Sans", ui-sans-serif, sans-serif`;
        ctx.fillStyle = element.color;
        ctx.textBaseline = "alphabetic";
        ctx.textAlign = element.slot === "left" ? "left" : "center";
        ctx.fillText(text, element.slot === "left" ? left : coordinates.pageWidth / 2, baselineY);
        ctx.restore();
      }
    }
  } else {
    // Footer elements: strictly contained within footer boundary
    for (const element of visible) {
      const text = bandElementText(element, pageNumber, totalPages);
      const requestedBaseline = topY + BAND_PAD_TOP + element.row * BAND_ROW_HEIGHT + element.fontSize * 0.6;
      const baselineY = Math.min(topY + activeHeight - 8, Math.max(topY + element.fontSize, requestedBaseline));
      if (element.handwritten) {
        const size = element.fontSize * 1.2;
        const width = measureHandwritten(ctx, text, settings, size);
        const x =
          element.slot === "left" ? left : element.slot === "center" ? coordinates.pageWidth / 2 - width / 2 : right - width;
        writeText(ctx, text, settings, x, baselineY, random, { size, color: element.color });
      } else {
        ctx.save();
        ctx.font = `${element.fontSize}px "Plus Jakarta Sans", ui-sans-serif, sans-serif`;
        ctx.fillStyle = element.color;
        ctx.textBaseline = "alphabetic";
        ctx.textAlign = element.slot === "left" ? "left" : element.slot === "center" ? "center" : "right";
        ctx.fillText(text, element.slot === "left" ? left : element.slot === "center" ? coordinates.pageWidth / 2 : right, baselineY);
        ctx.restore();
      }
    }
  }
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
    const availableLines = placement.lineUnits;
    const firstTextLine = placement.lineIndex + Math.max(0, Math.floor((availableLines - lines.length) / 2));
    lines.forEach((text, line) => {
      if (!text.trim()) return;
      writeText(
        ctx,
        text,
        settings,
        x + settings.table.cellPadding,
        getBaseline(coordinates, firstTextLine + line),
        random,
        {
          size: settings.fontSize * settings.table.fontScale * (placement.isHeader ? 1.02 : 1),
          color: ink,
          scale: settings.table.fontScale,
        },
      );
    });
    x += placement.columnWidths[column] ?? 0;
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
export function writingArea(settings: HandwritingSettings) {
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas rendering is unavailable");
  const coordinates = createPageCoordinateSystem(settings, ctx);
  return {
    pageWidth: coordinates.pageWidth,
    pageHeight: coordinates.pageHeight,
    left: coordinates.contentLeft / coordinates.pageWidth,
    top: coordinates.contentTop / coordinates.pageHeight,
    width: (coordinates.contentRight - coordinates.contentLeft) / coordinates.pageWidth,
    height: (coordinates.contentBottom - coordinates.contentTop) / coordinates.pageHeight,
    lineHeight: coordinates.rulingSpacing,
    fontSize: settings.fontSize,
  };
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
    if (input.settings.header.enabled) {
      drawBand(ctx, input.settings.header, input.settings, page.coordinates, 0, page.pageNumber, totalPages, random);
    }
    if (input.settings.footer.enabled) {
      drawBand(
        ctx,
        input.settings.footer,
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

export { createPageCoordinateSystem, getBaseline, getNearestBaseline, layoutDocument } from "./layout";
export type { LayoutDocument, LayoutPage, LayoutPlacement, PageCoordinateSystem } from "./layout";