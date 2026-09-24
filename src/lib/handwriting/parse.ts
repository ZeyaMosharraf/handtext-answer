import type { ColumnAlignment } from "./types";
import type { GraphDefinition } from "../graph/types";
import type { MarginMarker, MarginMarkerType, DocumentBlock } from "@/types/document";

export type BlockKind =
  | "heading"
  | "subheading"
  | "bullet"
  | "numbered"
  | "paragraph"
  | "quote"
  | "divider"
  | "table"
  | "blank"
  | "math"
  | "graph";

/** A run of text sharing the same inline formatting. */
export interface Seg {
  text: string;
  bold: boolean;
  underline: boolean;
  italic?: boolean;
  color?: string;
  scale?: number; // Normalized relative handwriting scale: 0.85, 1.0, 1.2, 1.4
  highlight?: string; // Hex color for translucent highlighter wash, e.g. #fef08a
}

export function normalizeFontScale(rawScale: number): number {
  if (rawScale <= 0.92) return 0.85; // Small
  if (rawScale <= 1.1) return 1.0;   // Normal
  if (rawScale <= 1.3) return 1.2;   // Medium
  return 1.4;                        // Large
}

function rgbToHex(rgbStr: string): string | null {
  const m = rgbStr.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/i);
  if (!m || !m[1] || !m[2] || !m[3]) return null;
  const r = parseInt(m[1], 10).toString(16).padStart(2, "0");
  const g = parseInt(m[2], 10).toString(16).padStart(2, "0");
  const b = parseInt(m[3], 10).toString(16).padStart(2, "0");
  return `#${r}${g}${b}`;
}

/**
 * Safely extracts an attribute value from an HTML tag string or attribute list.
 * Respects quote pairing: an attribute opened with " can contain literal ' without truncating,
 * and an attribute opened with ' can contain literal " without truncating.
 */
export function matchAttr(tagOrAttrs: string, attrName: string): string | null {
  const re = new RegExp(`${attrName}=(?:(["'])([\\s\\S]*?)\\1|([^\\s>]+))`, "i");
  const match = tagOrAttrs.match(re);
  if (!match) return null;
  return match[2] !== undefined ? match[2] : (match[3] ?? null);
}

export function escapeHtml(str: string): string {
  if (!str) return "";
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function extractScale(attrs: string, tag: string): number | undefined {
  const dataMatch = attrs.match(/data-scale=["']?([0-9.]+)/i);
  if (dataMatch?.[1]) {
    return normalizeFontScale(parseFloat(dataMatch[1]));
  }
  const emMatch = attrs.match(/font-size:\s*([0-9.]+)em/i);
  if (emMatch?.[1]) {
    return normalizeFontScale(parseFloat(emMatch[1]));
  }
  const pctMatch = attrs.match(/font-size:\s*([0-9.]+)%/i);
  if (pctMatch?.[1]) {
    return normalizeFontScale(parseFloat(pctMatch[1]) / 100);
  }
  const fontMatch = tag === "FONT" ? attrs.match(/size=["']?([1-7])/i) : null;
  if (fontMatch?.[1]) {
    const sz = parseInt(fontMatch[1], 10);
    if (sz <= 2) return 0.85;
    if (sz === 3 || sz === 4) return 1.0;
    if (sz === 5) return 1.2;
    return 1.4;
  }
  if (tag === "BIG") return 1.2;
  if (tag === "SMALL") return 0.85;
  return undefined;
}

function extractColor(attrs: string, tag: string): string | undefined {
  const dataColor = attrs.match(/data-color=["']?([^"'\s>]+)/i);
  if (dataColor?.[1] && dataColor[1] !== "inherit") return dataColor[1];

  const fontColor = tag === "FONT" ? attrs.match(/color=["']?([^"'\s>]+)/i) : null;
  if (fontColor?.[1] && fontColor[1] !== "inherit") {
    const val = fontColor[1];
    return val.startsWith("rgb") ? (rgbToHex(val) ?? val) : val;
  }

  const styleColor = attrs.match(/(?:^|;|\s|["'])color:\s*([^;"]+)/i);
  if (styleColor?.[1] && styleColor[1].trim() !== "inherit") {
    const val = styleColor[1].trim();
    return val.startsWith("rgb") ? (rgbToHex(val) ?? val) : val;
  }

  return undefined;
}

function extractHighlight(attrs: string, tag: string): string | undefined {
  const dataHigh = attrs.match(/data-highlight=["']?([^"'\s>]+)/i);
  if (dataHigh?.[1] && dataHigh[1] !== "transparent") return dataHigh[1];

  const styleHigh = attrs.match(/(?:^|;|\s|["'])(?:background-color|background):\s*([^;"]+)/i);
  if (styleHigh?.[1]) {
    const val = styleHigh[1].trim();
    if (val !== "transparent" && val !== "inherit" && val !== "none") {
      return val.startsWith("rgb") ? (rgbToHex(val) ?? val) : val;
    }
  }

  if (tag === "MARK") {
    return "#fef08a"; // Default yellow highlighter wash
  }

  return undefined;
}

interface StyleFrame {
  tag: string;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  color?: string | undefined;
  scale?: number | undefined;
  highlight?: string | undefined;
}

export interface TableCellData {
  text: string;
  segs: Seg[];
}

export interface TableData {
  rows: TableCellData[][];
  headerRow: boolean;
  alignments?: ColumnAlignment[];
}

export function getTableCellText(cell: TableCellData | string | undefined): string {
  if (!cell) return "";
  if (typeof cell === "string") return cell;
  return cell.text;
}

export function getTableCellSegs(cell: TableCellData | string | undefined): Seg[] {
  if (!cell) return [];
  if (typeof cell === "string") return parseInline(cell);
  return cell.segs.length ? cell.segs : [{ text: cell.text, bold: false, underline: false, italic: false }];
}

/** Stored in Block.math when kind === "math" (import-safe: no circular dep) */
export interface MathBlockData {
  latex: string;
  display: "block" | "inline";
  color?: string | undefined;
}

/** Stored in Block.graph when kind === "graph" */
export interface GraphBlockData {
  definition: GraphDefinition;
}

export interface Block {
  /** Stable block ID if preserved across editor or serialization */
  id?: string | undefined;
  kind: BlockKind;
  text: string;
  segs?: Seg[];
  marker?: string;
  table?: TableData;
  /** Present when kind === "math" */
  math?: MathBlockData;
  /** Present when kind === "graph" */
  graph?: GraphBlockData;
  /** Answer-sheet gutter margin marker (e.g. Q1, Ans, a), 5M) */
  marginMarker?: MarginMarker | undefined;
}

export const HIGHLIGHT_COLOR = "#141821"; // strong black ink for emphasis

/**
 * Inline formatting (legacy markdown syntax):
 *   **bold**      thicker, darker strokes
 *   __underline__ hand-drawn underline
 *   ==black==     forced dark ink for emphasis
 */
export function parseInline(raw: string): Seg[] {
  return parseInlineInto(raw, false, false, false);
}

function parseInlineInto(raw: string, bold: boolean, underline: boolean, italic: boolean, color?: string): Seg[] {
  const segs: Seg[] = [];
  const re = /(\*\*|__|==|\*|_)([\s\S]+?)\1/g;
  let last = 0;
  let match: RegExpExecArray | null;
  const push = (text: string, b: boolean, u: boolean, it: boolean, c?: string) => {
    if (!text) return;
    // Formats can nest (e.g. **__word__**) — recurse so markers never leak through.
    if (/(\*\*|__|==|\*|_)/.test(text)) {
      segs.push(...parseInlineInto(text, b, u, it, c));
      return;
    }
    segs.push({ text, bold: b, underline: u, italic: it, ...(c ? { color: c } : {}) });
  };
  while ((match = re.exec(raw))) {
    push(raw.slice(last, match.index), bold, underline, italic, color);
    const inner = match[2] ?? "";
    if (match[1] === "**") push(inner, true, underline, italic, HIGHLIGHT_COLOR);
    else if (match[1] === "__") push(inner, bold, true, italic, color);
    else if (match[1] === "==") push(inner, bold, underline, italic, HIGHLIGHT_COLOR);
    else if (match[1] === "*" || match[1] === "_") push(inner, bold, underline, true, color);
    last = re.lastIndex;
  }
  push(raw.slice(last), bold, underline, italic, color);
  return segs.length ? segs : [{ text: "", bold: false, underline: false, italic: false }];
}

export function segText(segs: Seg[]): string {
  return segs.map((s) => s.text).join("");
}

/** Removes inline markers, used where formatting isn't supported (table cells). */
export function stripInline(raw: string): string {
  return segText(parseInline(raw));
}

function isTableRow(line: string) {
  return /^\|.*\|$/.test(line);
}

function isDivider(line: string) {
  return /^\|[\s:|-]+\|$/.test(line) && line.includes("-");
}

function cells(line: string) {
  return line
    .slice(1, -1)
    .split("|")
    .map((c) => c.replace(/<br\s*\/?>/gi, "\n").trim());
}

function block(kind: BlockKind, text: string, marker?: string): Block {
  const segs = parseInline(text);
  return { kind, text: segText(segs), segs, ...(marker ? { marker } : {}) };
}

/** Detects whether content is formatted as HTML from the rich text editor. */
export function isHtmlContent(raw: string): boolean {
  return /<\s*(p|h1|h2|h3|ul|ol|table|blockquote|hr|div|span|strong|b|em|i|u|pre)\b/i.test(raw);
}

export function unescapeHtml(str: string): string {
  return str
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/\u00A0/g, " ");
}

export function plainSegments(text: string): Seg[] {
  return text ? [{ text, bold: false, underline: false, italic: false }] : [];
}

/** Parses inline HTML text runs into structured Seg[] */
export function parseInlineHtml(innerHtml: string): Seg[] {
  const segs: Seg[] = [];
  const tokenRe = /<(\/)?([a-z0-9]+)([^>]*)>|([^<]+)/gi;
  const stack: StyleFrame[] = [];
  let boldCount = 0;
  let italicCount = 0;
  let underlineCount = 0;

  let match: RegExpExecArray | null;
  while ((match = tokenRe.exec(innerHtml)) !== null) {
    const isClose = Boolean(match[1]);
    const tag = match[2]?.toUpperCase();
    const attrs = match[3] ?? "";
    const textPart = match[4];

    if (textPart) {
      const decoded = unescapeHtml(textPart);
      if (decoded) {
        const activeColor = stack.map((f) => f.color).filter(Boolean).at(-1);
        const activeScale = stack.map((f) => f.scale).filter(Boolean).at(-1);
        const activeHighlight = stack.map((f) => f.highlight).filter(Boolean).at(-1);

        segs.push({
          text: decoded,
          bold: boldCount > 0,
          italic: italicCount > 0,
          underline: underlineCount > 0,
          ...(activeColor ? { color: activeColor } : {}),
          ...(activeScale ? { scale: activeScale } : {}),
          ...(activeHighlight ? { highlight: activeHighlight } : {}),
        });
      }
      continue;
    }

    if (!tag) continue;

    if (tag === "BR") {
      const activeColor = stack.map((f) => f.color).filter(Boolean).at(-1);
      const activeScale = stack.map((f) => f.scale).filter(Boolean).at(-1);
      const activeHighlight = stack.map((f) => f.highlight).filter(Boolean).at(-1);
      segs.push({
        text: "\n",
        bold: boldCount > 0,
        italic: italicCount > 0,
        underline: underlineCount > 0,
        ...(activeColor ? { color: activeColor } : {}),
        ...(activeScale ? { scale: activeScale } : {}),
        ...(activeHighlight ? { highlight: activeHighlight } : {}),
      });
      continue;
    }

    if (isClose) {
      if (tag === "STRONG" || tag === "B") boldCount = Math.max(0, boldCount - 1);
      else if (tag === "EM" || tag === "I") italicCount = Math.max(0, italicCount - 1);
      else if (tag === "U") underlineCount = Math.max(0, underlineCount - 1);

      // Pop matching frame from top of stack
      for (let i = stack.length - 1; i >= 0; i--) {
        const frame = stack[i];
        if (frame && frame.tag === tag) {
          stack.splice(i, 1);
          break;
        }
      }
    } else {
      if (tag === "STRONG" || tag === "B") {
        boldCount++;
        stack.push({ tag, bold: true });
      } else if (tag === "EM" || tag === "I") {
        italicCount++;
        stack.push({ tag, italic: true });
      } else if (tag === "U") {
        underlineCount++;
        stack.push({ tag, underline: true });
      } else {
        const color = extractColor(attrs, tag);
        const scale = extractScale(attrs, tag);
        const highlight = extractHighlight(attrs, tag);
        stack.push({ tag, color, scale, highlight });
      }
    }
  }

  // Merge contiguous segments with identical formatting
  const merged: Seg[] = [];
  for (const seg of segs) {
    if (!seg.text) continue;
    const last = merged[merged.length - 1];
    if (
      last &&
      last.bold === seg.bold &&
      last.italic === seg.italic &&
      last.underline === seg.underline &&
      last.color === seg.color &&
      last.scale === seg.scale &&
      last.highlight === seg.highlight
    ) {
      last.text += seg.text;
    } else {
      merged.push({ ...seg });
    }
  }

  return merged.length ? merged : [{ text: "", bold: false, underline: false, italic: false }];
}

function extractMarginMarker(attrs: string): MarginMarker | undefined {
  const textVal = matchAttr(attrs, "data-margin-marker");
  if (!textVal || !textVal.trim()) return undefined;
  const rawType = matchAttr(attrs, "data-margin-type") || "custom";
  const colorVal = matchAttr(attrs, "data-margin-color");
  const validTypes: MarginMarkerType[] = ["question", "answer", "subquestion", "marks", "custom"];
  const type: MarginMarkerType = validTypes.includes(rawType as MarginMarkerType)
    ? (rawType as MarginMarkerType)
    : "custom";
  return {
    type,
    text: unescapeHtml(textVal),
    ...(colorVal ? { color: unescapeHtml(colorVal) } : {}),
  };
}

function stripPrefixFromSegs(segs: Seg[], charCount: number): Seg[] {
  let remaining = charCount;
  const result: Seg[] = [];
  for (const seg of segs) {
    if (remaining <= 0) {
      result.push({ ...seg });
      continue;
    }
    if (seg.text.length <= remaining) {
      remaining -= seg.text.length;
      continue;
    }
    result.push({ ...seg, text: seg.text.slice(remaining) });
    remaining = 0;
  }
  return result.length ? result : plainSegments("");
}

function stripTextBlockWrappers(html: string): string {
  let res = html;
  const openRe = /<div[^>]*data-block-type=["']text["'][^>]*>/gi;
  let match: RegExpExecArray | null;
  while ((match = openRe.exec(res)) !== null) {
    const startIdx = match.index;
    const tagLen = match[0].length;
    const openTag = match[0];
    let depth = 1;
    let cursor = startIdx + tagLen;
    const innerTagRe = /<\/?div\b[^>]*>/gi;
    innerTagRe.lastIndex = cursor;
    let innerMatch: RegExpExecArray | null;
    let endIdx = -1;
    let closeLen = 0;
    while ((innerMatch = innerTagRe.exec(res)) !== null) {
      if (innerMatch[0].startsWith("</")) {
        depth--;
        if (depth === 0) {
          endIdx = innerMatch.index;
          closeLen = innerMatch[0].length;
          break;
        }
      } else {
        depth++;
      }
    }
    if (endIdx !== -1) {
      let innerContent = res.slice(startIdx + tagLen, endIdx);
      const markerText = matchAttr(openTag, "data-margin-marker");
      const markerType = matchAttr(openTag, "data-margin-type");
      const markerColor = matchAttr(openTag, "data-margin-color");
      if (markerText && !innerContent.includes("data-margin-marker")) {
        const markerAttrs = ` data-margin-marker="${markerText}"` +
          (markerType ? ` data-margin-type="${markerType}"` : "") +
          (markerColor ? ` data-margin-color="${markerColor}"` : "");
        if (/<(h1|h2|h3|h4|blockquote|table|ul|ol|p|div|pre)\b/i.test(innerContent)) {
          innerContent = innerContent.replace(/<(h1|h2|h3|h4|blockquote|table|ul|ol|p|div|pre)([^>]*)>/i, `<$1$2${markerAttrs}>`);
        } else {
          innerContent = `<p${markerAttrs}>${innerContent}</p>`;
        }
      }
      res = res.slice(0, startIdx) + "\n" + innerContent + "\n" + res.slice(endIdx + closeLen);
      openRe.lastIndex = startIdx;
    } else {
      break;
    }
  }
  return res;
}

/**
 * Normalizes HTML by hoisting block-level elements (math-block, graph-block, table)
 * out of enclosing <p> tags so that sequential blocks are cleanly parsed without truncation.
 */
export function unnestBlockElements(html: string): string {
  const blockElementPattern = /<(?:div\b((?:[^"'>]|(["'])[\s\S]*?\2)*)>([\s\S]*?)<\/div>|table\b((?:[^"'>]|(["'])[\s\S]*?\5)*)>([\s\S]*?)<\/table>)/gi;

  return html.replace(/<p\b([^>]*)>([\s\S]*?)<\/p>/gi, (fullP, pAttrs, pInner) => {
    if (
      !pInner.includes("math-block") &&
      !pInner.includes("graph-block") &&
      !pInner.includes("data-block-type") &&
      !pInner.includes("data-latex") &&
      !pInner.includes("<table")
    ) {
      return fullP;
    }

    blockElementPattern.lastIndex = 0;
    const parts: string[] = [];
    let lastIdx = 0;
    let bMatch: RegExpExecArray | null;
    let found = false;

    while ((bMatch = blockElementPattern.exec(pInner)) !== null) {
      const fullBlockMatch = bMatch[0];
      const isBlock =
        fullBlockMatch.startsWith("<table") ||
        /class=(["'])[\s\S]*?(?:math-block|graph-block)[\s\S]*?\1/i.test(fullBlockMatch) ||
        /data-block-type=(["'])(?:math|graph|table)\1/i.test(fullBlockMatch) ||
        /data-latex=/i.test(fullBlockMatch) ||
        /data-graph-definition=/i.test(fullBlockMatch);

      if (!isBlock) {
        continue;
      }

      found = true;
      const before = pInner.slice(lastIdx, bMatch.index);
      const cleanBefore = before.replace(/<br\s*\/?>/gi, "").trim();
      if (cleanBefore) {
        parts.push(`<p${pAttrs}>${before}</p>`);
      }
      parts.push(fullBlockMatch);
      lastIdx = blockElementPattern.lastIndex;
    }

    if (!found) {
      return fullP;
    }

    const after = pInner.slice(lastIdx);
    const cleanAfter = after.replace(/<br\s*\/?>/gi, "").trim();
    if (cleanAfter) {
      parts.push(`<p${pAttrs}>${after}</p>`);
    }

    return parts.join("\n");
  });
}

/**
 * Extracts structured TableData from raw HTML <table> markup.
 * Parses rows, headers (<th>), cell inline segments, and column alignments.
 */
export function parseTableHtml(tableHtml: string): TableData | undefined {
  const rows: TableCellData[][] = [];
  let headerRow = false;
  const alignments: ColumnAlignment[] = [];
  const trRe = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
  let trMatch: RegExpExecArray | null;
  let rowIndex = 0;

  while ((trMatch = trRe.exec(tableHtml)) !== null) {
    const trContent = trMatch[1] ?? "";
    const cellRe = /<(td|th)([^>]*)>([\s\S]*?)<\/\1>/gi;
    let cellMatch: RegExpExecArray | null;
    const rowCells: TableCellData[] = [];
    let hasTh = false;
    let colIndex = 0;

    while ((cellMatch = cellRe.exec(trContent)) !== null) {
      const isTh = cellMatch[1]?.toLowerCase() === "th";
      if (isTh) hasTh = true;
      const attrs = cellMatch[2] ?? "";
      const rawCellHtml = cellMatch[3] ?? "";

      // Extract column alignment
      if (rowIndex === 0 || !alignments[colIndex]) {
        let colAlign: ColumnAlignment = "left";
        const alignAttr = attrs.match(/align=["']?(left|center|right)["']?/i);
        const styleAlign = attrs.match(/text-align:\s*(left|center|right)/i);
        const dataAlign = attrs.match(/data-align=["']?(left|center|right)["']?/i);
        const classAlign = attrs.match(/\btext-(left|center|right)\b/i);

        const matched = (alignAttr?.[1] || styleAlign?.[1] || dataAlign?.[1] || classAlign?.[1])?.toLowerCase();
        if (matched === "center" || matched === "right" || matched === "left") {
          colAlign = matched;
        }
        alignments[colIndex] = colAlign;
      }

      // Normalize container tags inside cell to line breaks, preserving spans, styles, and inline markup
      const normalizedCellHtml = rawCellHtml
        .replace(/<br\s*\/?>/gi, "<br>")
        .replace(/<\/p>\s*<p[^>]*>/gi, "<br>")
        .replace(/<\/div>\s*<div[^>]*>/gi, "<br>")
        .replace(/<\/?(p|div)[^>]*>/gi, "")
        .replace(/\r/g, "");

      // Parse full inline formatting (color, scale, bold, italic, underline, highlight, newlines)
      const segs = parseInlineHtml(normalizedCellHtml);
      const cellText = segText(segs).replace(/\n+$/, "");

      rowCells.push({ text: cellText, segs });
      colIndex++;
    }

    if (rowIndex === 0 && hasTh) headerRow = true;
    if (rowCells.length > 0) rows.push(rowCells);
    rowIndex++;
  }

  if (rows.length === 0) return undefined;
  return { rows, headerRow, alignments };
}

/** Converts TableData to clean semantic HTML. */
export function tableDataToHtml(t: TableData): string {
  const rowsHtml = t.rows
    .map((row, rIdx) => {
      const tag = rIdx === 0 && t.headerRow ? "th" : "td";
      const cells = row
        .map((cell, cIdx) => {
          const align = t.alignments?.[cIdx];
          const alignAttr = align && align !== "left" ? ` data-align="${align}" style="text-align: ${align};"` : "";
          const cellHtml =
            typeof cell === "string"
              ? escapeHtml(cell)
              : cell?.segs && cell.segs.length > 0
              ? segsToHtml(cell.segs)
              : escapeHtml(cell?.text || "");
          return `<${tag}${alignAttr}>${cellHtml}</${tag}>`;
        })
        .join("");
      return `<tr>${cells}</tr>`;
    })
    .join("");
  return `<table><tbody>${rowsHtml}</tbody></table>`;
}

/**
 * Parses structured HTML from the rich text editor directly into Block[] and Seg[]
 * runs without intermediate markdown syntax or markers. Works universally in browser and Node/SSR.
 */
export function parseHtmlContent(
  html: string,
  mathBlocksMap = new Map<string, { latex: string; color?: string | undefined; id?: string | undefined }>(),
  graphBlocksMap = new Map<string, { defStr: string; id?: string | undefined }>(),
): Block[] {
  const blocks: Block[] = [];

  // Unwrap any top-level text block container divs and hoist blocks trapped in <p> tags
  const unwrappedHtml = unnestBlockElements(stripTextBlockWrappers(html));

  function extractMarkerAttributesString(tagStr: string): string {
    const marker = matchAttr(tagStr, "data-margin-marker");
    const type = matchAttr(tagStr, "data-margin-type");
    const color = matchAttr(tagStr, "data-margin-color");
    const blockId = matchAttr(tagStr, "data-block-id");
    return (
      (blockId ? ` data-block-id="${blockId}"` : "") +
      (marker ? ` data-margin-marker="${marker}"` : "") +
      (type ? ` data-margin-type="${type}"` : "") +
      (color ? ` data-margin-color="${color}"` : "")
    );
  }

  // Pre-extract math blocks so nested <div> wrappers in contenteditable never truncate blockRegex
  let mathCounter = mathBlocksMap.size;
  let tokenizedHtml = unwrappedHtml.replace(
    /<div\b((?:[^"'>]|(["'])[\s\S]*?\2)*)>([\s\S]*?)<\/div>/gi,
    (fullMatch, attrs, _q, inner) => {
      const isMath =
        /class=(["'])[\s\S]*?math-block[\s\S]*?\1/i.test(attrs) ||
        /data-block-type=(["'])math\1/i.test(attrs) ||
        matchAttr(attrs, "data-latex") !== null;
      if (!isMath) return fullMatch;
      const rawId = matchAttr(attrs, "data-block-id");
      const rawLatex = matchAttr(attrs, "data-latex");
      const latex = unescapeHtml(rawLatex !== null ? rawLatex : (inner ? inner.trim() : ""));
      const rawColor = matchAttr(attrs, "data-color");
      const color = rawColor ? unescapeHtml(rawColor) : undefined;
      const markerAttrs = extractMarkerAttributesString(fullMatch);
      const token = `__MATH_BLOCK_TOKEN_${mathCounter++}__`;
      mathBlocksMap.set(token, { latex, color, id: rawId ?? undefined });
      return `<p data-math-token="${token}"${markerAttrs}></p>`;
    },
  );

  // Pre-extract graph blocks
  let graphCounter = graphBlocksMap.size;
  tokenizedHtml = tokenizedHtml.replace(
    /<div\b((?:[^"'>]|(["'])[\s\S]*?\2)*)>([\s\S]*?)<\/div>/gi,
    (fullMatch, attrs) => {
      const isGraph =
        /class=(["'])[\s\S]*?graph-block[\s\S]*?\1/i.test(attrs) ||
        /data-block-type=(["'])graph\1/i.test(attrs) ||
        matchAttr(attrs, "data-graph-definition") !== null;
      if (!isGraph) return fullMatch;
      const rawId = matchAttr(attrs, "data-block-id");
      const rawDef = matchAttr(attrs, "data-graph-definition");
      const defStr = unescapeHtml(rawDef || "");
      const markerAttrs = extractMarkerAttributesString(fullMatch);
      const token = `__GRAPH_BLOCK_TOKEN_${graphCounter++}__`;
      graphBlocksMap.set(token, { defStr, id: rawId ?? undefined });
      return `<p data-graph-token="${token}"${markerAttrs}></p>`;
    },
  );

  // Match top-level blocks or sequential block tags
  const blockRegex =
    /<(h1|h2|h3|h4|blockquote|hr|table|ul|ol|p|div|pre)([^>]*)>([\s\S]*?)<\/\1>|<hr\s*\/?>/gi;

  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = blockRegex.exec(tokenizedHtml)) !== null) {
    // Check if there was non-empty text before this block (preserving spaces & indentation)
    const rawPrev = unescapeHtml(tokenizedHtml.slice(lastIndex, match.index).replace(/<[^>]+>/g, ""));
    if (rawPrev.trim()) {
      const prevText = rawPrev.replace(/\r\n/g, "\n").replace(/\r/g, "\n").replace(/^\n+|\n+$/g, "");
      blocks.push({
        kind: "paragraph",
        text: prevText,
        segs: [{ text: prevText, bold: false, underline: false, italic: false }],
      });
    }
    lastIndex = blockRegex.lastIndex;

    const tag = (match[1] ?? "hr").toLowerCase();
    const attrs = match[2] ?? "";
    const inner = match[3] ?? "";
    const marginMarker = extractMarginMarker(attrs);
    const blockId = matchAttr(attrs, "data-block-id") ?? undefined;

    // Check if the block tag itself is a math-block token or container
    const token = matchAttr(attrs, "data-math-token");
    if (token && mathBlocksMap.has(token)) {
      const data = mathBlocksMap.get(token)!;
      const latex = data.latex;
      if (latex.trim()) {
        blocks.push({
          id: data.id ?? blockId,
          kind: "math",
          text: latex,
          math: { latex, display: "block", ...(data.color ? { color: data.color } : {}) },
          ...(marginMarker ? { marginMarker } : {}),
        });
      }
      continue;
    }

    const rawLatex = matchAttr(attrs, "data-latex");
    if (rawLatex !== null || attrs.includes("math-block")) {
      const latex = rawLatex !== null ? unescapeHtml(rawLatex) : inner.trim();
      const rawColor = matchAttr(attrs, "data-color");
      const color = rawColor ? unescapeHtml(rawColor) : undefined;
      blocks.push({
        id: blockId,
        kind: "math",
        text: latex,
        math: { latex, display: "block", ...(color ? { color } : {}) },
        ...(marginMarker ? { marginMarker } : {}),
      });
      continue;
    }

    // Check if the block tag itself is a graph-block token or container
    const graphToken = matchAttr(attrs, "data-graph-token");
    if (graphToken && graphBlocksMap.has(graphToken)) {
      const gData = graphBlocksMap.get(graphToken)!;
      const defStr = gData.defStr;
      try {
        const definition = JSON.parse(defStr) as GraphDefinition;
        if (!definition.space) {
          definition.space = { xMin: -5, xMax: 5, yMin: -5, yMax: 5, showGrid: true, showAxisLabels: true, originVisible: true };
        }
        blocks.push({
          id: gData.id ?? blockId,
          kind: "graph",
          text: defStr,
          graph: { definition },
          ...(marginMarker ? { marginMarker } : {}),
        });
      } catch {
        // Silently skip corrupted JSON
      }
      continue;
    }

    const rawGraphDef = matchAttr(attrs, "data-graph-definition");
    if (rawGraphDef !== null || (tag === "div" && attrs.includes("graph-block"))) {
      const defStr = rawGraphDef !== null ? unescapeHtml(rawGraphDef) : inner.trim();
      try {
        const definition = JSON.parse(defStr) as GraphDefinition;
        if (!definition.space) {
          definition.space = { xMin: -5, xMax: 5, yMin: -5, yMax: 5, showGrid: true, showAxisLabels: true, originVisible: true };
        }
        blocks.push({
          id: blockId,
          kind: "graph",
          text: defStr,
          graph: { definition },
          ...(marginMarker ? { marginMarker } : {}),
        });
      } catch {
        // Silently skip corrupted JSON
      }
      continue;
    }

    if (tag === "hr") {
      blocks.push({ id: blockId, kind: "divider", text: "" });
      continue;
    }

    if (tag === "h1") {
      const segs = parseInlineHtml(inner);
      blocks.push({ id: blockId, kind: "heading", text: segText(segs), segs, ...(marginMarker ? { marginMarker } : {}) });
      continue;
    }

    if (tag === "h2" || tag === "h3" || tag === "h4") {
      const segs = parseInlineHtml(inner);
      blocks.push({ id: blockId, kind: "subheading", text: segText(segs), segs, ...(marginMarker ? { marginMarker } : {}) });
      continue;
    }

    if (tag === "blockquote") {
      const segs = parseInlineHtml(inner);
      blocks.push({ id: blockId, kind: "quote", text: segText(segs), segs, ...(marginMarker ? { marginMarker } : {}) });
      continue;
    }

    if (tag === "ul") {
      const liRe = /<li[^>]*>([\s\S]*?)<\/li>/gi;
      let liMatch: RegExpExecArray | null;
      let bulletIdx = 0;
      while ((liMatch = liRe.exec(inner)) !== null) {
        const segs = parseInlineHtml(liMatch[1] ?? "");
        blocks.push({
          id: blockId ? (bulletIdx === 0 ? blockId : `${blockId}_${bulletIdx}`) : undefined,
          kind: "bullet",
          text: segText(segs),
          segs,
          marker: "•",
        });
        bulletIdx++;
      }
      continue;
    }

    if (tag === "ol") {
      const liRe = /<li[^>]*>([\s\S]*?)<\/li>/gi;
      let liMatch: RegExpExecArray | null;
      let idx = 1;
      while ((liMatch = liRe.exec(inner)) !== null) {
        const segs = parseInlineHtml(liMatch[1] ?? "");
        blocks.push({
          id: blockId ? (idx === 1 ? blockId : `${blockId}_${idx}`) : undefined,
          kind: "numbered",
          text: segText(segs),
          segs,
          marker: `${idx++}.`,
        });
      }
      continue;
    }

    if (tag === "table") {
      const parsedTable = parseTableHtml(match[0]);
      if (parsedTable) {
        blocks.push({
          id: blockId,
          kind: "table",
          text: "",
          table: parsedTable,
          ...(marginMarker ? { marginMarker } : {}),
        });
      }
      continue;
    }

    // Math display block: <div class="math-block" data-latex="...">...</div>
    if (tag === "div" && /math-block/i.test(match[2] ?? "")) {
      const latexVal = matchAttr(match[2] ?? "", "data-latex") ?? matchAttr(inner, "data-latex") ?? "";
      const latex = unescapeHtml(latexVal);
      if (latex.trim()) {
        blocks.push({ kind: "math", text: latex, math: { latex, display: "block" }, ...(marginMarker ? { marginMarker } : {}) });
      }
      continue;
    }

    if (tag === "div" && /<(h1|h2|h3|h4|blockquote|hr|table|ul|ol|p|div|pre)\b/i.test(inner)) {
      blocks.push(...parseHtmlContent(inner, mathBlocksMap, graphBlocksMap));
      continue;
    }

    if (tag === "p" || tag === "div" || tag === "pre") {
      // Check if inner contains nested math-block elements or math tokens
      if (inner.includes("data-math-token") || inner.includes("math-block") || inner.includes("data-latex")) {
        const mathPattern =
          /<p\b[^>]*data-math-token=(["'])([\s\S]*?)\1[^>]*><\/p>|<div\b((?:[^"'>]|(["'])[\s\S]*?\4)*)>([\s\S]*?)<\/div>/gi;
        let lastInnerIdx = 0;
        let mMatch: RegExpExecArray | null;
        while ((mMatch = mathPattern.exec(inner)) !== null) {
          const beforeHtml = inner.slice(lastInnerIdx, mMatch.index);
          const beforeSegs = parseInlineHtml(beforeHtml);
          const beforeText = segText(beforeSegs).trim();
          if (beforeText) {
            blocks.push({ kind: "paragraph", text: segText(beforeSegs), segs: beforeSegs });
          }
          let latex = "";
          let mathColor: string | undefined = undefined;
          let mBlockId: string | undefined = undefined;
          const divOrP = mMatch[0];
          const token = matchAttr(divOrP, "data-math-token");
          if (token && mathBlocksMap.has(token)) {
            const data = mathBlocksMap.get(token)!;
            latex = data.latex;
            mathColor = data.color;
            mBlockId = data.id;
          } else {
            const lVal = matchAttr(divOrP, "data-latex");
            const cVal = matchAttr(divOrP, "data-color");
            latex = lVal ? unescapeHtml(lVal) : "";
            mathColor = cVal ? unescapeHtml(cVal) : undefined;
            mBlockId = matchAttr(divOrP, "data-block-id") ?? undefined;
          }
          if (latex) {
            blocks.push({
              id: mBlockId ?? blockId,
              kind: "math",
              text: latex,
              math: { latex, display: "block", ...(mathColor ? { color: mathColor } : {}) },
            });
          }
          lastInnerIdx = mathPattern.lastIndex;
        }
        const afterHtml = inner.slice(lastInnerIdx);
        const afterSegs = parseInlineHtml(afterHtml);
        const afterText = segText(afterSegs).trim();
        if (afterText) {
          blocks.push({ kind: "paragraph", text: segText(afterSegs), segs: afterSegs });
        }
        continue;
      }

      // Check if inner contains nested graph-block elements or graph tokens
      if (inner.includes("data-graph-token") || inner.includes("graph-block") || inner.includes("data-graph-definition")) {
        const graphPattern =
          /<p\b[^>]*data-graph-token=(["'])([\s\S]*?)\1[^>]*><\/p>|<div\b((?:[^"'>]|(["'])[\s\S]*?\4)*)>([\s\S]*?)<\/div>/gi;
        let lastInnerIdx = 0;
        let gMatch: RegExpExecArray | null;
        while ((gMatch = graphPattern.exec(inner)) !== null) {
          const beforeHtml = inner.slice(lastInnerIdx, gMatch.index);
          const beforeSegs = parseInlineHtml(beforeHtml);
          const beforeText = segText(beforeSegs).trim();
          if (beforeText) {
            blocks.push({ kind: "paragraph", text: segText(beforeSegs), segs: beforeSegs });
          }
          let defStr = "";
          let gBlockId: string | undefined = undefined;
          const divOrP = gMatch[0];
          const token = matchAttr(divOrP, "data-graph-token");
          if (token && graphBlocksMap.has(token)) {
            const gData = graphBlocksMap.get(token)!;
            defStr = gData.defStr;
            gBlockId = gData.id;
          } else {
            const dVal = matchAttr(divOrP, "data-graph-definition");
            defStr = dVal ? unescapeHtml(dVal) : "";
            gBlockId = matchAttr(divOrP, "data-block-id") ?? undefined;
          }
          if (defStr) {
            try {
              const definition = JSON.parse(defStr) as GraphDefinition;
              if (!definition.space) {
                definition.space = { xMin: -5, xMax: 5, yMin: -5, yMax: 5, showGrid: true, showAxisLabels: true, originVisible: true };
              }
              blocks.push({ id: gBlockId ?? blockId, kind: "graph", text: defStr, graph: { definition } });
            } catch {
              // Silently skip corrupted JSON
            }
          }
          lastInnerIdx = graphPattern.lastIndex;
        }
        const afterHtml = inner.slice(lastInnerIdx);
        const afterSegs = parseInlineHtml(afterHtml);
        const afterText = segText(afterSegs).trim();
        if (afterText) {
          blocks.push({ kind: "paragraph", text: segText(afterSegs), segs: afterSegs });
        }
        continue;
      }

      const cleanInner = inner.trim();
      if (!cleanInner || cleanInner === "<br>" || cleanInner === "<br/>" || cleanInner === "<br />" || cleanInner === "&nbsp;") {
        if (marginMarker) {
          blocks.push({ id: blockId, kind: "paragraph", text: "", segs: plainSegments(""), marginMarker });
        } else {
          blocks.push({ id: blockId, kind: "blank", text: "" });
        }
        continue;
      }
      const segs = parseInlineHtml(inner);
      const text = segText(segs).trim();

      // Check if text itself represents a standalone margin marker (e.g. user typed "q1" or "Q1." or "Ans" on a line)
      if (!marginMarker) {
        const standaloneMatch = text.match(/^(Q\d+|Ans|[a-z]\)|\([a-z]\))[.:]?$/i);
        if (standaloneMatch) {
          const rawM = standaloneMatch[1]!;
          const normM = rawM.startsWith("q") || rawM.startsWith("Q") ? rawM.toUpperCase() : rawM;
          const inferredType: MarginMarkerType = normM.startsWith("Q")
            ? "question"
            : normM.toLowerCase() === "ans"
            ? "answer"
            : "subquestion";
          blocks.push({
            id: blockId,
            kind: "paragraph",
            text: "",
            segs: plainSegments(""),
            marginMarker: { type: inferredType, text: normM },
          });
          continue;
        }

        // Also check if text starts with a marker prefix like "Q1. " or "Q1: " or "Ans: "
        const prefixMatch = text.match(/^(Q\d+|Ans|[a-z]\)|\([a-z]\))[:.]\s+([\s\S]+)$/i);
        if (prefixMatch) {
          const rawM = prefixMatch[1]!;
          const normM = rawM.startsWith("q") || rawM.startsWith("Q") ? rawM.toUpperCase() : rawM;
          const inferredType: MarginMarkerType = normM.startsWith("Q")
            ? "question"
            : normM.toLowerCase() === "ans"
            ? "answer"
            : "subquestion";
          const bodyText = prefixMatch[2]!;
          const strippedSegs = stripPrefixFromSegs(segs, prefixMatch[0].length - bodyText.length);
          blocks.push({
            id: blockId,
            kind: "paragraph",
            text: segText(strippedSegs),
            segs: strippedSegs,
            marginMarker: { type: inferredType, text: normM },
          });
          continue;
        }
      }

      if (!text) {
        if (marginMarker) {
          blocks.push({ id: blockId, kind: "paragraph", text: "", segs: plainSegments(""), marginMarker });
        } else {
          blocks.push({ id: blockId, kind: "blank", text: "" });
        }
      } else {
        blocks.push({ id: blockId, kind: "paragraph", text: segText(segs), segs, ...(marginMarker ? { marginMarker } : {}) });
      }
      continue;
    }
  }

  // Handle trailing content if any
  const rawTrailing = unescapeHtml(tokenizedHtml.slice(lastIndex).replace(/<[^>]+>/g, ""));
  const trailing = rawTrailing.replace(/\r\n/g, "\n").replace(/\r/g, "\n").replace(/^\n+|\n+$/g, "");
  if (trailing.trim()) {
    blocks.push({
      kind: "paragraph",
      text: trailing,
      segs: [{ text: trailing, bold: false, underline: false, italic: false }],
    });
  }

  return blocks.length
    ? blocks
    : [{ kind: "paragraph", text: "", segs: [{ text: "", bold: false, underline: false, italic: false }] }];
}

function parseLegacyMarkdown(raw: string): Block[] {
  const blocks: Block[] = [];
  const lines = raw.replace(/\r/g, "").split("\n");

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i] ?? "";
    const line = rawLine.trim();

    if (isTableRow(line)) {
      const collected: TableCellData[][] = [];
      let headerRow = false;
      let alignments: ColumnAlignment[] = [];
      while (i < lines.length && isTableRow((lines[i] ?? "").trim())) {
        const current = (lines[i] ?? "").trim();
        if (isDivider(current)) {
          headerRow = collected.length === 1;
          alignments = current
            .slice(1, -1)
            .split("|")
            .map((col) => {
              const trimmed = col.trim();
              if (trimmed.startsWith(":") && trimmed.endsWith(":")) return "center";
              if (trimmed.endsWith(":")) return "right";
              return "left";
            });
        } else {
          const rawRow = cells(current);
          collected.push(
            rawRow.map((cellText) => ({
              text: stripInline(cellText),
              segs: parseInline(cellText),
            })),
          );
        }
        i++;
      }
      i--;
      if (collected.length) {
        blocks.push({ kind: "table", text: "", table: { rows: collected, headerRow, alignments } });
      }
      continue;
    }

    if (!line) {
      blocks.push({ kind: "blank", text: "" });
      continue;
    }

    const markerLineMatch = line.match(/^(Q\d+|Ans|[a-z]\)|\([a-z]\))[.:]?$/i);
    if (markerLineMatch) {
      const rawM = markerLineMatch[1]!;
      const normM = rawM.startsWith("q") || rawM.startsWith("Q") ? rawM.toUpperCase() : rawM;
      const inferredType: MarginMarkerType = normM.startsWith("Q")
        ? "question"
        : normM.toLowerCase() === "ans"
        ? "answer"
        : "subquestion";
      blocks.push({
        kind: "paragraph",
        text: "",
        segs: plainSegments(""),
        marginMarker: { type: inferredType, text: normM },
      });
      continue;
    }

    const prefixLineMatch = line.match(/^(Q\d+|Ans|[a-z]\)|\([a-z]\))[:.]\s+([\s\S]+)$/i);
    if (prefixLineMatch) {
      const rawM = prefixLineMatch[1]!;
      const normM = rawM.startsWith("q") || rawM.startsWith("Q") ? rawM.toUpperCase() : rawM;
      const inferredType: MarginMarkerType = normM.startsWith("Q")
        ? "question"
        : normM.toLowerCase() === "ans"
        ? "answer"
        : "subquestion";
      const bodyText = prefixLineMatch[2]!;
      blocks.push({
        kind: "paragraph",
        text: bodyText,
        segs: parseInline(bodyText),
        marginMarker: { type: inferredType, text: normM },
      });
      continue;
    }

    if (line.startsWith("$$")) {
      if (line.endsWith("$$") && line.length > 4) {
        const latex = line.slice(2, -2).trim();
        blocks.push({ kind: "math", text: latex, math: { latex, display: "block" } });
        continue;
      }
      const latexLines: string[] = [];
      if (line.length > 2) latexLines.push(line.slice(2));
      i++;
      while (i < lines.length && !(lines[i] ?? "").trim().endsWith("$$")) {
        latexLines.push(lines[i] ?? "");
        i++;
      }
      if (i < lines.length) {
        const last = (lines[i] ?? "").trim();
        if (last.length > 2) latexLines.push(last.slice(0, -2));
      }
      const latex = latexLines.join("\n").trim();
      blocks.push({ kind: "math", text: latex, math: { latex, display: "block" } });
      continue;
    }

    if (/^(-{3,}|_{3,}|\*{3,})$/.test(line)) {
      blocks.push({ kind: "divider", text: "" });
      continue;
    }

    const h1 = /^#\s+(.*)$/.exec(line);
    if (h1) {
      blocks.push(block("heading", h1[1]!));
      continue;
    }

    const h2 = /^#{2,}\s+(.*)$/.exec(line);
    if (h2) {
      blocks.push(block("subheading", h2[1]!));
      continue;
    }

    const quote = /^>\s+(.*)$/.exec(line);
    if (quote) {
      blocks.push(block("quote", quote[1]!));
      continue;
    }

    const bullet = /^[-*•]\s+(.*)$/.exec(line);
    if (bullet) {
      blocks.push(block("bullet", bullet[1]!, "•"));
      continue;
    }

    const numbered = /^(\d+)[.)]\s+(.*)$/.exec(line);
    if (numbered) {
      blocks.push(block("numbered", numbered[2]!, `${Number(numbered[1])}.`));
      continue;
    }

    if (line.length <= 60 && /:$/.test(line)) {
      blocks.push(block("subheading", line.replace(/:$/, "")));
      continue;
    }

    blocks.push(block("paragraph", rawLine));
  }

  return blocks;
}

/**
 * Turns content into structured blocks for the handwriting layout engine.
 * Accepts structured DocumentBlock[], layout Block[], rich HTML, or legacy markdown.
 */
export function parseContent(raw: string | Block[] | DocumentBlock[]): Block[] {
  if (Array.isArray(raw)) {
    return toHandwritingBlocks(raw);
  }
  if (isHtmlContent(raw)) {
    return parseHtmlContent(raw);
  }
  return parseLegacyMarkdown(raw);
}

/** Converts Seg[] into clean HTML without marker characters. */
export function segsToHtml(segs: Seg[] | undefined): string {
  if (!segs || segs.length === 0) return "";
  return segs
    .map((seg) => {
      let t = seg.text
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/\n/g, "<br>");
      if (seg.bold) t = `<strong>${t}</strong>`;
      if (seg.italic) t = `<em>${t}</em>`;
      if (seg.underline) t = `<u>${t}</u>`;
      if (seg.color) t = `<span style="color: ${seg.color}" data-color="${seg.color}">${t}</span>`;
      return t;
    })
    .join("");
}

/** Converts Block[] to rich HTML. */
export function blocksToHtml(blocks: Block[]): string {
  const parts: string[] = [];
  let inUl = false;
  let inOl = false;

  const closeLists = () => {
    if (inUl) {
      parts.push("</ul>");
      inUl = false;
    }
    if (inOl) {
      parts.push("</ol>");
      inOl = false;
    }
  };

  for (const b of blocks) {
    if (b.kind === "bullet") {
      if (inOl) {
        parts.push("</ol>");
        inOl = false;
      }
      if (!inUl) {
        parts.push("<ul>");
        inUl = true;
      }
      parts.push(`<li>${segsToHtml(b.segs)}</li>`);
      continue;
    }
    if (b.kind === "numbered") {
      if (inUl) {
        parts.push("</ul>");
        inUl = false;
      }
      if (!inOl) {
        parts.push("<ol>");
        inOl = true;
      }
      parts.push(`<li>${segsToHtml(b.segs)}</li>`);
      continue;
    }

    closeLists();

    switch (b.kind) {
      case "heading":
        parts.push(`<h1>${segsToHtml(b.segs)}</h1>`);
        break;
      case "subheading":
        parts.push(`<h2>${segsToHtml(b.segs)}</h2>`);
        break;
      case "quote":
        parts.push(`<blockquote>${segsToHtml(b.segs)}</blockquote>`);
        break;
      case "divider":
        parts.push("<hr>");
        break;
      case "blank": {
        if (b.marginMarker) {
          const mAttrs = ` data-margin-marker="${b.marginMarker.text}" data-margin-type="${b.marginMarker.type}"` +
            (b.marginMarker.color ? ` data-margin-color="${b.marginMarker.color}"` : "");
          parts.push(`<p${mAttrs}><br></p>`);
        } else {
          parts.push("<p><br></p>");
        }
        break;
      }
      case "table": {
        if (b.table) {
          parts.push(tableDataToHtml(b.table));
        }
        break;
      }
      case "math": {
        const latex = b.math?.latex ?? b.text;
        const escLatex = latex.replace(/"/g, "&quot;");
        const preview = latex.length > 60 ? latex.slice(0, 57) + "…" : latex;
        const escPreview = preview.replace(/</g, "&lt;").replace(/>/g, "&gt;");
        const idAttr = b.id ? ` data-block-id="${b.id}"` : "";
        const colorAttr = b.math?.color ? ` data-color="${b.math.color}"` : "";
        const mAttrs = b.marginMarker
          ? ` data-margin-marker="${b.marginMarker.text}" data-margin-type="${b.marginMarker.type}"` +
            (b.marginMarker.color ? ` data-margin-color="${b.marginMarker.color}"` : "")
          : "";
        parts.push(
          `<div class="math-block"${idAttr}${colorAttr}${mAttrs} data-latex="${escLatex}" contenteditable="false" style="display:inline-flex;align-items:center;gap:6px;padding:4px 10px;margin:4px 0;border-radius:6px;background:rgba(99,102,241,0.08);border:1px solid rgba(99,102,241,0.25);cursor:pointer;user-select:none;font-family:monospace;font-size:0.82em;color:#4338ca;white-space:nowrap;"><span style="opacity:0.7;font-size:1.1em;">∑</span><span>${escPreview}</span></div>`,
        );
        break;
      }
      case "graph": {
        const def = b.graph?.definition;
        const defJson = def ? JSON.stringify(def) : b.text;
        const escDef = defJson.replace(/"/g, "&quot;");
        const title = def?.title || `${def?.type ?? "graph"} graph`;
        const escTitle = title.replace(/</g, "&lt;").replace(/>/g, "&gt;");
        const idAttr = b.id ? ` data-block-id="${b.id}"` : "";
        const mAttrs = b.marginMarker
          ? ` data-margin-marker="${b.marginMarker.text}" data-margin-type="${b.marginMarker.type}"` +
            (b.marginMarker.color ? ` data-margin-color="${b.marginMarker.color}"` : "")
          : "";
        parts.push(
          `<div class="graph-block"${idAttr}${mAttrs} data-graph-definition="${escDef}" contenteditable="false" style="display:inline-flex;align-items:center;gap:6px;padding:4px 10px;margin:4px 0;border-radius:6px;background:rgba(16,185,129,0.08);border:1px solid rgba(16,185,129,0.25);cursor:pointer;user-select:none;font-family:sans-serif;font-size:0.82em;color:#047857;white-space:nowrap;"><span style="opacity:0.7;font-size:1.1em;">📈</span><span>${escTitle}</span></div>`,
        );
        break;
      }
      case "paragraph":
      default: {
        const idAttr = b.id ? ` data-block-id="${b.id}"` : "";
        const mAttrs = b.marginMarker
          ? ` data-margin-marker="${b.marginMarker.text}" data-margin-type="${b.marginMarker.type}"` +
            (b.marginMarker.color ? ` data-margin-color="${b.marginMarker.color}"` : "")
          : "";
        const innerText = segsToHtml(b.segs);
        parts.push(`<p${idAttr}${mAttrs}>${innerText || "<br>"}</p>`);
        break;
      }
    }
  }

  closeLists();
  return parts.join("\n");
}

/**
 * Migration helper:
 * Converts legacy projects with markdown markers (**, __, ==) or plain text
 * into clean rich HTML for the rich-text editor so that NO markers ever appear.
 */
export function migrateLegacyContentToHtml(raw: string): string {
  if (!raw) return "<p><br></p>";
  if (isHtmlContent(raw)) return raw;
  const blocks = parseLegacyMarkdown(raw);
  return blocksToHtml(blocks);
}

export function wordCount(raw: string): number {
  if (!raw.trim()) return 0;
  const plain = raw.replace(/<[^>]*>/g, " ").replace(/&nbsp;/g, " ");
  const trimmed = plain.trim();
  return trimmed ? trimmed.split(/\s+/).length : 0;
}

/** Serialises a table back into markdown pipe syntax for legacy tools if needed. */
export function tableToMarkdown(table: TableData): string {
  const out: string[] = [];
  table.rows.forEach((row, index) => {
    out.push(`| ${row.map((c) => getTableCellText(c)).join(" | ")} |`);
    if (index === 0 && table.headerRow) {
      const divider = row
        .map((_, colIdx) => {
          const align = table.alignments?.[colIdx] ?? "left";
          if (align === "center") return ":---:";
          if (align === "right") return "---:";
          return ":---";
        })
        .join("|");
      out.push(`|${divider}|`);
    }
  });
  return out.join("\n");
}

/**
 * Safely converts Block[] or HTML content to plain text representation with preserved
 * placeholders for Math, Table, and Graph blocks so they can be recognized during Write-on-Page.
 */
export function blocksToPlainText(blocks: Block[]): string {
  const parts: string[] = [];
  for (const b of blocks) {
    switch (b.kind) {
      case "math": {
        const latex = b.math?.latex ?? b.text;
        parts.push(`$$\n${latex}\n$$`);
        break;
      }
      case "graph": {
        const title = b.graph?.definition.title || b.id || "graph";
        parts.push(`[Graph: ${title}]`);
        break;
      }
      case "table": {
        const id = b.id || "table";
        parts.push(`[Table: ${id}]`);
        break;
      }
      default: {
        parts.push(b.text);
        break;
      }
    }
  }
  return parts.join("\n").trimEnd();
}

/** Converts HTML content to plain text with preserved line breaks and block markers for on-page editing. */
export function htmlToPlainText(html: string): string {
  if (!html) return "";
  if (!isHtmlContent(html)) return html;
  const blocks = parseContent(html);
  return blocksToPlainText(blocks);
}

/** Converts plain text input from on-page writing into clean paragraph HTML. */
export function plainTextToHtml(plain: string): string {
  if (!plain) return "<p><br></p>";
  const lines = plain.split("\n");
  const paragraphs: string[] = [];
  for (const line of lines) {
    if (!line.trim()) {
      paragraphs.push("<p><br></p>");
    } else {
      const escaped = line
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");
      paragraphs.push(`<p>${escaped}</p>`);
    }
  }
  return paragraphs.join("");
}

/**
 * Updates a structured document from plain-text input (such as Write-on-Page)
 * without EVER destroying non-text blocks (MathBlock, TableBlock, GraphBlock)
 * or stripping margin metadata.
 */
export function updateContentFromPlainText(originalContent: string, newPlainText: string): string {
  if (!originalContent || !originalContent.trim()) {
    return plainTextToHtml(newPlainText);
  }

  const originalBlocks = parseContent(originalContent);
  if (originalBlocks.length === 0) {
    return plainTextToHtml(newPlainText);
  }

  // Check if there are any structured non-text blocks
  const nonTextIndices: number[] = [];
  originalBlocks.forEach((b, idx) => {
    if (b.kind === "math" || b.kind === "graph" || b.kind === "table") {
      nonTextIndices.push(idx);
    }
  });

  // Fast path: Pure text document
  if (nonTextIndices.length === 0) {
    const rawLines = newPlainText.split("\n");
    const updated: Block[] = [];
    rawLines.forEach((line, idx) => {
      const orig = originalBlocks[idx];
      updated.push({
        kind: orig?.kind || "paragraph",
        text: line,
        segs: [{ text: line, bold: false, underline: false }],
        ...(orig?.id ? { id: orig.id } : {}),
        ...(orig?.marginMarker ? { marginMarker: orig.marginMarker } : {}),
      });
    });
    return blocksToHtml(updated);
  }

  // Non-text blocks present: preserve all non-text blocks strictly
  const pattern = /(\$\$[\s\S]*?\$\$|\[Graph(?::\s*[^\]]*)?\]|\[Table(?::\s*[^\]]*)?\])/gi;
  const textSlices: string[] = [];

  let lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(newPlainText)) !== null) {
    textSlices.push(newPlainText.slice(lastIndex, match.index));
    lastIndex = match.index + match[0].length;
  }
  textSlices.push(newPlainText.slice(lastIndex));

  // Reassemble blocks preserving non-text blocks in their original structure
  const resultBlocks: Block[] = [];

  let origTextIndex = 0;
  for (let i = 0; i <= nonTextIndices.length; i++) {
    const textSlice = (i < textSlices.length ? textSlices[i] : "") || "";
    const cleanLines = textSlice
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => l.length > 0);

    const nextNonTextIdx = i < nonTextIndices.length ? (nonTextIndices[i] ?? originalBlocks.length) : originalBlocks.length;
    const origSlice = originalBlocks.slice(origTextIndex, nextNonTextIdx);

    if (cleanLines.length === 0 && origSlice.length === 0) {
      // no text in this slice
    } else if (cleanLines.length === 0 && origSlice.length > 0) {
      // Slice was emptied
    } else {
      cleanLines.forEach((line, lineIdx) => {
        const origBlock = origSlice[lineIdx];
        resultBlocks.push({
          kind: origBlock?.kind || "paragraph",
          text: line,
          segs: [{ text: line, bold: false, underline: false }],
          ...(origBlock?.id ? { id: origBlock.id } : {}),
          ...(origBlock?.marginMarker ? { marginMarker: origBlock.marginMarker } : {}),
        });
      });
    }

    // Insert the non-text block if there is one at this position
    if (i < nonTextIndices.length) {
      const ntBlock = originalBlocks[nonTextIndices[i]!];
      if (ntBlock) {
        resultBlocks.push(ntBlock);
      }
      origTextIndex = (nonTextIndices[i] ?? 0) + 1;
    }
  }

  return blocksToHtml(resultBlocks);
}

/**
 * Converts canonical DocumentBlock[] into layout-ready handwriting Block[] instances.
 * Operates directly on structured objects without serializing back to HTML string,
 * completely avoiding lossy regex tokenization or round-trip string reparsing.
 */
export function documentBlocksToHandwritingBlocks(blocks: DocumentBlock[]): Block[] {
  if (!blocks || blocks.length === 0) return [];
  const result: Block[] = [];

  for (const block of blocks) {
    switch (block.type) {
      case "text": {
        const textBlocks = parseHtmlContent(block.html);
        if (textBlocks.length === 0) {
          result.push({
            id: block.id,
            kind: "paragraph",
            text: "",
            segs: [],
            ...(block.marginMarker ? { marginMarker: block.marginMarker } : {}),
          });
        } else {
          for (let i = 0; i < textBlocks.length; i++) {
            const tb = textBlocks[i]!;
            result.push({
              ...tb,
              id: i === 0 ? block.id : `${block.id}_${i}`,
              ...(i === 0 && block.marginMarker ? { marginMarker: block.marginMarker } : {}),
            });
          }
        }
        break;
      }
      case "math": {
        result.push({
          id: block.id,
          kind: "math",
          text: block.naturalExpr || block.latex || "",
          math: {
            latex: block.latex || block.naturalExpr || "",
            display: block.displayMode === "compact" ? "inline" : "block",
            ...(block.color ? { color: block.color } : {}),
          },
          ...(block.marginMarker ? { marginMarker: block.marginMarker } : {}),
        });
        break;
      }
      case "table": {
        const tableData = block.tableData ?? parseTableHtml(block.html);
        result.push({
          id: block.id,
          kind: "table",
          text: "",
          ...(tableData ? { table: tableData } : {}),
          ...(block.marginMarker ? { marginMarker: block.marginMarker } : {}),
        });
        break;
      }
      case "graph": {
        result.push({
          id: block.id,
          kind: "graph",
          text: JSON.stringify(block.graphDef),
          graph: {
            definition: block.graphDef,
          },
          ...(block.marginMarker ? { marginMarker: block.marginMarker } : {}),
        });
        break;
      }
    }
  }

  return result;
}

/**
 * Normalizes handwriting Block[] instances into canonical DocumentBlock[] instances.
 * Preserves stable IDs, margin markers, math attributes, table structures, and graph definitions.
 */
export function handwritingBlocksToDocumentBlocks(blocks: Block[]): DocumentBlock[] {
  if (!blocks || blocks.length === 0) {
    return [{
      id: "blk_empty",
      type: "text",
      html: "<p><br></p>",
      createdAt: Date.now(),
    }];
  }

  const result: DocumentBlock[] = [];
  let pendingTextBlocks: Block[] = [];

  const flushPendingText = () => {
    if (pendingTextBlocks.length === 0) return;
    const first = pendingTextBlocks[0]!;
    const html = blocksToHtml(pendingTextBlocks);
    result.push({
      id: first.id || `txt_${Math.random().toString(36).slice(2, 10)}`,
      type: "text",
      html: html || "<p><br></p>",
      ...(first.marginMarker ? { marginMarker: first.marginMarker } : {}),
      createdAt: Date.now(),
    });
    pendingTextBlocks = [];
  };

  for (const b of blocks) {
    if (b.kind === "math") {
      flushPendingText();
      const latex = b.math?.latex || b.text || "";
      result.push({
        id: b.id || `math_${Math.random().toString(36).slice(2, 10)}`,
        type: "math",
        naturalExpr: b.text || latex,
        latex,
        displayMode: b.math?.display === "inline" ? "compact" : "block",
        ...(b.math?.color ? { color: b.math.color } : {}),
        ...(b.marginMarker ? { marginMarker: b.marginMarker } : {}),
        createdAt: Date.now(),
      });
    } else if (b.kind === "graph") {
      flushPendingText();
      result.push({
        id: b.id || `grp_${Math.random().toString(36).slice(2, 10)}`,
        type: "graph",
        graphDef: b.graph?.definition ?? {
          id: b.id || "grp",
          type: "coordinate",
          space: { xMin: -5, xMax: 5, yMin: -5, yMax: 5, showGrid: true, showAxisLabels: true, originVisible: true },
        },
        ...(b.marginMarker ? { marginMarker: b.marginMarker } : {}),
        createdAt: Date.now(),
      });
    } else if (b.kind === "table") {
      flushPendingText();
      result.push({
        id: b.id || `tbl_${Math.random().toString(36).slice(2, 10)}`,
        type: "table",
        tableData: b.table,
        html: b.table ? tableDataToHtml(b.table) : "<table><tbody><tr><td></td></tr></tbody></table>",
        ...(b.marginMarker ? { marginMarker: b.marginMarker } : {}),
        createdAt: Date.now(),
      });
    } else {
      pendingTextBlocks.push(b);
    }
  }

  flushPendingText();
  return result;
}

/**
 * Resolves content into handwriting layout Block[] instances regardless of whether
 * it was provided as an HTML/markdown string, an existing Block[] array, or a DocumentBlock[] array.
 */
export function toHandwritingBlocks(content: string | Block[] | DocumentBlock[]): Block[] {
  if (typeof content === "string") {
    return parseContent(content);
  }
  if (!Array.isArray(content) || content.length === 0) {
    return [];
  }
  const first = content[0] as any;
  if (first && typeof first === "object" && "kind" in first) {
    return content as Block[];
  }
  if (first && typeof first === "object" && "type" in first) {
    return documentBlocksToHandwritingBlocks(content as DocumentBlock[]);
  }
  return [];
}

