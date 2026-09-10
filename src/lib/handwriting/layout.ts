import { parseContent, type Block, type BlockKind, type Seg } from "./parse";
import {
  formatPageNumber,
  pageDimensions,
  type BandConfig,
  type HandwritingSettings,
  type PageElement,
} from "./types";

export interface PageCoordinateSystem {
  pageWidth: number;
  pageHeight: number;
  contentLeft: number;
  contentRight: number;
  contentTop: number;
  contentBottom: number;
  rulingSpacing: number;
  firstBaselineY: number;
  baselineOffset: number;
  headerHeight: number;
  footerHeight: number;
}

export interface LayoutLine {
  type: "line";
  lineIndex: number;
  segs: Seg[];
  kind: BlockKind;
  marker?: string;
  indent: number;
  scale: number;
  underline: boolean;
}

export interface LayoutTableRow {
  type: "tableRow";
  lineIndex: number;
  lineUnits: number;
  tableId: number;
  isHeader: boolean;
  isFirst: boolean;
  isLast: boolean;
  cells: string[][];
  columnWidths: number[];
}

export interface LayoutTableBounds {
  tableId: number;
  left: number;
  top: number;
  right: number;
  bottom: number;
}

export type LayoutPlacement = LayoutLine | LayoutTableRow;

export interface LayoutPage {
  pageNumber: number;
  coordinates: PageCoordinateSystem;
  placements: LayoutPlacement[];
}

export interface LayoutDocument {
  pages: LayoutPage[];
}

interface FlowLine {
  type: "line";
  segs: Seg[];
  kind: BlockKind;
  marker?: string;
  indent: number;
  scale: number;
  underline: boolean;
  gapLines: number;
}

interface FlowTableRow {
  type: "tableRow";
  tableId: number;
  isHeader: boolean;
  isFirst: boolean;
  isLast: boolean;
  cells: string[][];
  columnWidths: number[];
  lineUnits: number;
  gapLines: number;
}

type FlowItem = FlowLine | FlowTableRow;

const KIND_SCALE: Record<BlockKind, number> = {
  heading: 1.22,
  subheading: 1.08,
  bullet: 1,
  numbered: 1,
  paragraph: 1,
  quote: 1,
  divider: 1,
  table: 1,
  blank: 1,
};

export function bandApplies(band: BandConfig, pageNumber: number, totalPages: number) {
  if (!band.enabled) return false;
  if (band.applyTo === "first") return pageNumber === 1;
  if (band.applyTo === "last") return pageNumber === totalPages;
  return true;
}

/** Vertical padding above/below band rows, and the height of one band row. */
export const BAND_PAD_TOP = 26;
export const BAND_PAD_BOTTOM = 18;
export const BAND_ROW_HEIGHT = 40;

export function bandElementText(element: PageElement, pageNumber: number, totalPages: number) {
  if (element.kind === "pageNumber") {
    const formatted = formatPageNumber(element.format, pageNumber, totalPages).trim();
    if (element.label?.trim()) {
      return `${element.label.trim()}: ${formatted}`;
    }
    return formatted;
  }
  const value = element.value.trim();
  if (element.label?.trim() && value) return `${element.label.trim()}: ${value}`;
  if (element.label?.trim()) return `${element.label.trim()}: ______________`;
  return value;
}

function elementApplies(element: PageElement, pageNumber: number, totalPages: number) {
  if (!element.enabled) return false;
  if (element.applyTo === "first") return pageNumber === 1;
  if (element.applyTo === "last") return pageNumber === totalPages;
  return true;
}

/** Elements that actually render on this page (enabled, in scope, non-empty text). */
export function visibleBandElements(band: BandConfig, pageNumber: number, totalPages: number) {
  if (!bandApplies(band, pageNumber, totalPages)) return [];
  return band.elements.filter(
    (element) => elementApplies(element, pageNumber, totalPages) && bandElementText(element, pageNumber, totalPages).trim().length > 0,
  );
}

/**
 * A band reserves its configured height when enabled and applicable to the page.
 * When disabled (or outside page scope), it consumes zero layout space.
 */
export function bandHeight(band: BandConfig, pageNumber: number, totalPages: number) {
  if (!bandApplies(band, pageNumber, totalPages)) return 0;
  return Math.max(0, band.height || 0);
}

function fontString(settings: HandwritingSettings, scale: number) {
  return `${settings.fontSize * scale}px "${settings.fontFamily}", cursive`;
}

function textWidth(ctx: CanvasRenderingContext2D, text: string, settings: HandwritingSettings, scale: number) {
  if (!text) return 0;
  ctx.font = fontString(settings, scale);
  return ctx.measureText(text).width * settings.compactness + text.length * settings.letterSpacing * scale;
}

function segmentsWidth(ctx: CanvasRenderingContext2D, segs: Seg[], settings: HandwritingSettings, scale: number) {
  return segs.reduce((width, seg) => width + textWidth(ctx, seg.text, settings, scale), 0);
}

function plainSegments(text: string): Seg[] {
  return text ? [{ text, bold: false, underline: false }] : [];
}

function wrapSegments(
  ctx: CanvasRenderingContext2D,
  segs: Seg[],
  settings: HandwritingSettings,
  scale: number,
  maxWidth: number,
) {
  const tokens: Seg[] = [];
  for (const seg of segs) {
    for (const part of seg.text.split(/(\s+)/)) {
      if (part) tokens.push({ ...seg, text: /^\s+$/.test(part) ? " " : part });
    }
  }

  const lines: Seg[][] = [];
  let current: Seg[] = [];
  for (const token of tokens) {
    if (token.text === " " && current.length === 0) continue;
    const candidate = [...current, token];
    if (token.text !== " " && current.length && segmentsWidth(ctx, candidate, settings, scale) > maxWidth) {
      while (current.at(-1)?.text === " ") current.pop();
      lines.push(current);
      current = [token];
    } else {
      current.push(token);
    }
  }
  while (current.at(-1)?.text === " ") current.pop();
  if (current.length) lines.push(current);
  return lines;
}

function wrapWords(
  ctx: CanvasRenderingContext2D,
  text: string,
  settings: HandwritingSettings,
  scale: number,
  maxWidth: number,
) {
  if (!text.trim()) return [];
  const words = text.trim().split(/\s+/);
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (current && textWidth(ctx, candidate, settings, scale) > maxWidth) {
      lines.push(current);
      current = word;
    } else {
      current = candidate;
    }
  }
  if (current) lines.push(current);
  return lines;
}

function activeCoordinateSystem(
  settings: HandwritingSettings,
  ctx: CanvasRenderingContext2D,
  pageNumber: number,
  totalPages: number,
): PageCoordinateSystem {
  const { w, h } = pageDimensions(settings.page);
  const rulingSpacing = settings.fontSize * settings.lineSpacing;

  // Header geometry: align header boundary to master ruling lattice
  const rawHeaderHeight = bandHeight(settings.header, pageNumber, totalPages);
  const headerHeight = rawHeaderHeight > 0 ? Math.max(2, Math.round(rawHeaderHeight / rulingSpacing)) * rulingSpacing : 0;

  // Footer geometry: align footer boundary to master ruling lattice
  const rawFooterHeight = bandHeight(settings.footer, pageNumber, totalPages);
  const footerHeight = rawFooterHeight > 0 ? Math.max(1, Math.round(rawFooterHeight / rulingSpacing)) * rulingSpacing : 0;

  // Margin rule alignment
  const marginRuleRight = settings.page.margin.enabled ? settings.page.margin.position + 24 : 48;
  const contentLeft = Math.max(settings.marginLeft, marginRuleRight);
  const contentRight = w - Math.max(48, settings.marginRight);

  // When header is active: writing starts on the first ruled line below the header boundary.
  // When header is inactive: writing starts at the top margin aligned to ruling intervals.
  const contentTop = headerHeight > 0 ? headerHeight : Math.max(1, Math.round(settings.marginTop / rulingSpacing)) * rulingSpacing;
  const firstBaselineY = headerHeight > 0 ? headerHeight + rulingSpacing : contentTop;

  // Content bottom is strictly bounded by the footer top boundary if enabled.
  // Main content must stop before the footer region.
  const contentBottom = footerHeight > 0
    ? h - footerHeight - 1
    : Math.floor((h - Math.max(48, settings.marginBottom) - firstBaselineY) / rulingSpacing) * rulingSpacing + firstBaselineY;

  return {
    pageWidth: w,
    pageHeight: h,
    contentLeft,
    contentRight,
    contentTop,
    contentBottom,
    rulingSpacing,
    firstBaselineY,
    baselineOffset: 0,
    headerHeight,
    footerHeight,
  };
}

export function getBaseline(coordinates: PageCoordinateSystem, lineIndex: number) {
  return coordinates.firstBaselineY + lineIndex * coordinates.rulingSpacing;
}

/** Snap page furniture to the same ruled-line lattice used by written content. */
export function getNearestBaseline(coordinates: PageCoordinateSystem, y: number) {
  const lineIndex = Math.round((y - coordinates.firstBaselineY) / coordinates.rulingSpacing);
  return getBaseline(coordinates, lineIndex);
}

function lineCapacity(coordinates: PageCoordinateSystem) {
  if (coordinates.contentBottom < coordinates.firstBaselineY) return 0;
  return Math.floor((coordinates.contentBottom - coordinates.firstBaselineY) / coordinates.rulingSpacing) + 1;
}

function blockLines(
  ctx: CanvasRenderingContext2D,
  block: Block,
  settings: HandwritingSettings,
  contentWidth: number,
): FlowLine[] {
  const scale = KIND_SCALE[block.kind];
  const markerWidth = block.marker ? textWidth(ctx, `${block.marker} `, settings, scale) : 0;
  const explicitIndent = block.kind === "quote" ? settings.fontSize * 0.9 : 0;
  const availableWidth = Math.max(1, contentWidth - explicitIndent - markerWidth);
  const wrapped = wrapSegments(ctx, block.segs ?? plainSegments(block.text), settings, scale, availableWidth);

  return wrapped.map((segs, index) => ({
    type: "line",
    segs,
    kind: block.kind,
    ...(index === 0 && block.marker ? { marker: block.marker } : {}),
    indent: explicitIndent + (index > 0 ? markerWidth : 0),
    scale,
    underline: block.kind === "heading",
    gapLines: 0,
  }));
}

function tableRows(
  ctx: CanvasRenderingContext2D,
  block: Block,
  settings: HandwritingSettings,
  contentWidth: number,
  tableId: number,
): FlowTableRow[] {
  const table = block.table;
  if (!table || table.rows.length === 0) return [];
  const columns = Math.max(1, ...table.rows.map((row) => row.length));
  const padding = settings.table.cellPadding;
  const scale = settings.table.fontScale;
  const natural = Array.from({ length: columns }, (_, column) => {
    const widest = Math.max(0, ...table.rows.map((row) => textWidth(ctx, row[column] ?? "", settings, scale)));
    return Math.min(widest + padding * 2, contentWidth * 0.6);
  });
  const naturalTotal = natural.reduce((sum, width) => sum + width, 0) || 1;
  const widthScale = contentWidth / naturalTotal;
  const columnWidths = natural.map((width) => width * widthScale);

  return table.rows.map((row, rowIndex) => {
    const cells = columnWidths.map((width, column) =>
      wrapWords(ctx, row[column] ?? "", settings, scale, Math.max(24, width - padding * 2)),
    );
    const textLines = Math.max(1, ...cells.map((lines) => lines.length));
    // Keep at least one complete ruled interval around the writing. This lets
    // the horizontal table borders land on notebook rules without touching it.
    const paddingLines = Math.floor((padding * 2) / (settings.fontSize * settings.lineSpacing));
    return {
      type: "tableRow",
      tableId,
      isHeader: Boolean(table.headerRow && rowIndex === 0),
      isFirst: rowIndex === 0,
      isLast: rowIndex === table.rows.length - 1,
      cells,
      columnWidths,
      lineUnits: Math.max(2, textLines + 1 + paddingLines),
      gapLines: 0,
    };
  });
}

function buildFlow(
  ctx: CanvasRenderingContext2D,
  content: string,
  question: string | undefined,
  settings: HandwritingSettings,
  contentWidth: number,
) {
  const blocks: Block[] = [];
  if (question?.trim()) {
    const text = `Q. ${question.trim()}`;
    blocks.push({ kind: "heading", text, segs: plainSegments(text) });
    blocks.push({ kind: "blank", text: "" });
    blocks.push({ kind: "subheading", text: "Answer", segs: plainSegments("Answer") });
  }
  blocks.push(...parseContent(content));

  const flow: FlowItem[] = [];
  let pendingGapLines = 0;
  let tableId = 0;
  for (const block of blocks) {
    if (block.kind === "blank") {
      pendingGapLines = Math.max(pendingGapLines, 1);
      continue;
    }
    if (block.kind === "divider") {
      const divider: FlowLine = {
        type: "line",
        segs: plainSegments("———————————————"),
        kind: "divider",
        indent: 0,
        scale: 1,
        underline: false,
        gapLines: pendingGapLines,
      };
      flow.push(divider);
      pendingGapLines = 0;
      continue;
    }
    const laid = block.kind === "table"
      ? tableRows(ctx, block, settings, contentWidth, tableId++)
      : blockLines(ctx, block, settings, contentWidth);
    if (laid.length === 0) continue;
    laid[0]!.gapLines = pendingGapLines;
    pendingGapLines = 0;
    flow.push(...laid);
  }
  return flow;
}

function paginate(
  flow: FlowItem[],
  settings: HandwritingSettings,
  ctx: CanvasRenderingContext2D,
  estimatedTotal: number,
) {
  const pages: LayoutPage[] = [];
  const tableHeaders = new Map<number, FlowTableRow>();
  for (const item of flow) if (item.type === "tableRow" && item.isHeader) tableHeaders.set(item.tableId, item);

  let pageNumber = 1;
  let coordinates = activeCoordinateSystem(settings, ctx, pageNumber, estimatedTotal);
  let capacity = lineCapacity(coordinates);
  let currentLineIndex = 0;
  let placements: LayoutPlacement[] = [];

  const finishPage = () => {
    pages.push({ pageNumber, coordinates, placements });
    pageNumber += 1;
    coordinates = activeCoordinateSystem(settings, ctx, pageNumber, estimatedTotal);
    capacity = lineCapacity(coordinates);
    currentLineIndex = 0;
    placements = [];
  };

  for (const item of flow) {
    let gapLines = placements.length === 0 ? 0 : item.gapLines;
    const units = item.type === "line" ? 1 : item.lineUnits;
    if (currentLineIndex + gapLines + units > capacity && placements.length > 0) {
      finishPage();
      gapLines = 0;
      if (item.type === "tableRow" && settings.table.repeatHeader && !item.isHeader) {
        const header = tableHeaders.get(item.tableId);
        if (header && header.lineUnits + units <= capacity) {
          placements.push({ ...header, lineIndex: 0, isFirst: true });
          currentLineIndex = header.lineUnits;
        }
      }
    }

    const lineIndex = currentLineIndex + gapLines;
    if (item.type === "line") {
      placements.push({
        type: "line",
        lineIndex,
        segs: item.segs,
        kind: item.kind,
        ...(item.marker ? { marker: item.marker } : {}),
        indent: item.indent,
        scale: item.scale,
        underline: item.underline,
      });
    } else {
      placements.push({ ...item, lineIndex });
    }
    currentLineIndex = lineIndex + units;
  }

  if (placements.length || pages.length === 0) pages.push({ pageNumber, coordinates, placements });
  return pages;
}

export function layoutDocument(
  ctx: CanvasRenderingContext2D,
  input: { question?: string; content: string; settings: HandwritingSettings },
): LayoutDocument {
  const firstCoordinates = activeCoordinateSystem(input.settings, ctx, 1, 1);
  const contentWidth = firstCoordinates.contentRight - firstCoordinates.contentLeft;
  const flow = buildFlow(ctx, input.content, input.question, input.settings, contentWidth);
  let pages = paginate(flow, input.settings, ctx, 1);

  for (let pass = 0; pass < 3; pass++) {
    const next = paginate(flow, input.settings, ctx, pages.length);
    if (next.length === pages.length) {
      pages = next;
      break;
    }
    pages = next;
  }
  return { pages };
}

export function createPageCoordinateSystem(
  settings: HandwritingSettings,
  ctx: CanvasRenderingContext2D,
  pageNumber = 1,
  totalPages = 1,
) {
  return activeCoordinateSystem(settings, ctx, pageNumber, totalPages);
}