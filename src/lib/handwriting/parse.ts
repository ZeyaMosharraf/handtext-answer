export type BlockKind =
  | "heading"
  | "subheading"
  | "bullet"
  | "numbered"
  | "paragraph"
  | "quote"
  | "divider"
  | "table"
  | "blank";

/** A run of text sharing the same inline formatting. */
export interface Seg {
  text: string;
  bold: boolean;
  underline: boolean;
  italic?: boolean;
  color?: string;
}

export interface TableData {
  rows: string[][];
  headerRow: boolean;
}

export interface Block {
  kind: BlockKind;
  text: string;
  segs?: Seg[];
  marker?: string;
  table?: TableData;
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
    .map((c) => stripInline(c.trim()));
}

function block(kind: BlockKind, text: string, marker?: string): Block {
  const segs = parseInline(text);
  return { kind, text: segText(segs), segs, ...(marker ? { marker } : {}) };
}

/** Detects whether content is formatted as HTML from the rich text editor. */
export function isHtmlContent(raw: string): boolean {
  return /<\s*(p|h1|h2|h3|ul|ol|table|blockquote|hr|div|span|strong|b|em|i|u)\b/i.test(raw);
}

function unescapeHtml(str: string): string {
  return str
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ");
}

/** Parses inline HTML text runs into structured Seg[] */
export function parseInlineHtml(innerHtml: string): Seg[] {
  const segs: Seg[] = [];
  const tokenRe = /<(\/)?([a-z0-9]+)([^>]*)>|([^<]+)/gi;
  let boldCount = 0;
  let italicCount = 0;
  let underlineCount = 0;
  let currentColor: string | undefined = undefined;

  let match: RegExpExecArray | null;
  while ((match = tokenRe.exec(innerHtml)) !== null) {
    const isClose = Boolean(match[1]);
    const tag = match[2]?.toUpperCase();
    const attrs = match[3] ?? "";
    const textPart = match[4];

    if (textPart) {
      const decoded = unescapeHtml(textPart);
      if (decoded) {
        segs.push({
          text: decoded,
          bold: boldCount > 0,
          italic: italicCount > 0,
          underline: underlineCount > 0,
          ...(currentColor ? { color: currentColor } : {}),
        });
      }
      continue;
    }

    if (!tag) continue;

    if (tag === "BR") {
      segs.push({
        text: "\n",
        bold: boldCount > 0,
        italic: italicCount > 0,
        underline: underlineCount > 0,
        ...(currentColor ? { color: currentColor } : {}),
      });
      continue;
    }

    if (isClose) {
      if (tag === "STRONG" || tag === "B") boldCount = Math.max(0, boldCount - 1);
      else if (tag === "EM" || tag === "I") italicCount = Math.max(0, italicCount - 1);
      else if (tag === "U") underlineCount = Math.max(0, underlineCount - 1);
      else if (tag === "MARK" || tag === "SPAN" || tag === "FONT") currentColor = undefined;
    } else {
      if (tag === "STRONG" || tag === "B") boldCount++;
      else if (tag === "EM" || tag === "I") italicCount++;
      else if (tag === "U") underlineCount++;
      else if (tag === "MARK") {
        currentColor = HIGHLIGHT_COLOR;
        boldCount++;
      } else if (tag === "SPAN" || tag === "FONT") {
        if (
          attrs.includes(HIGHLIGHT_COLOR) ||
          attrs.includes("141821") ||
          attrs.includes("rgb(20, 24, 33)") ||
          attrs.includes("rgb(20,24,33)") ||
          (tag === "FONT" && attrs.includes("color"))
        ) {
          currentColor = HIGHLIGHT_COLOR;
        }
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
      last.color === seg.color
    ) {
      last.text += seg.text;
    } else {
      merged.push({ ...seg });
    }
  }

  return merged.length ? merged : [{ text: "", bold: false, underline: false, italic: false }];
}

/**
 * Parses structured HTML from the rich text editor directly into Block[] and Seg[]
 * runs without intermediate markdown syntax or markers. Works universally in browser and Node/SSR.
 */
export function parseHtmlContent(html: string): Block[] {
  const blocks: Block[] = [];

  // Match top-level blocks or sequential block tags
  const blockRegex =
    /<(h1|h2|h3|h4|blockquote|hr|table|ul|ol|p|div)([^>]*)>([\s\S]*?)<\/\1>|<hr\s*\/?>/gi;

  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = blockRegex.exec(html)) !== null) {
    // Check if there was non-empty text before this block
    const prevText = unescapeHtml(html.slice(lastIndex, match.index).replace(/<[^>]+>/g, "")).trim();
    if (prevText) {
      blocks.push({
        kind: "paragraph",
        text: prevText,
        segs: [{ text: prevText, bold: false, underline: false, italic: false }],
      });
    }
    lastIndex = blockRegex.lastIndex;

    const tag = (match[1] ?? "hr").toLowerCase();
    const inner = match[3] ?? "";

    if (tag === "hr") {
      blocks.push({ kind: "divider", text: "" });
      continue;
    }

    if (tag === "h1") {
      const segs = parseInlineHtml(inner);
      blocks.push({ kind: "heading", text: segText(segs), segs });
      continue;
    }

    if (tag === "h2" || tag === "h3" || tag === "h4") {
      const segs = parseInlineHtml(inner);
      blocks.push({ kind: "subheading", text: segText(segs), segs });
      continue;
    }

    if (tag === "blockquote") {
      const segs = parseInlineHtml(inner);
      blocks.push({ kind: "quote", text: segText(segs), segs });
      continue;
    }

    if (tag === "ul") {
      const liRe = /<li[^>]*>([\s\S]*?)<\/li>/gi;
      let liMatch: RegExpExecArray | null;
      while ((liMatch = liRe.exec(inner)) !== null) {
        const segs = parseInlineHtml(liMatch[1] ?? "");
        blocks.push({ kind: "bullet", text: segText(segs), segs, marker: "•" });
      }
      continue;
    }

    if (tag === "ol") {
      const liRe = /<li[^>]*>([\s\S]*?)<\/li>/gi;
      let liMatch: RegExpExecArray | null;
      let idx = 1;
      while ((liMatch = liRe.exec(inner)) !== null) {
        const segs = parseInlineHtml(liMatch[1] ?? "");
        blocks.push({ kind: "numbered", text: segText(segs), segs, marker: `${idx++}.` });
      }
      continue;
    }

    if (tag === "table") {
      const rows: string[][] = [];
      let headerRow = false;
      const trRe = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
      let trMatch: RegExpExecArray | null;
      let rowIndex = 0;

      while ((trMatch = trRe.exec(inner)) !== null) {
        const trContent = trMatch[1] ?? "";
        const cellRe = /<(td|th)[^>]*>([\s\S]*?)<\/\1>/gi;
        let cellMatch: RegExpExecArray | null;
        const rowCells: string[] = [];
        let hasTh = false;

        while ((cellMatch = cellRe.exec(trContent)) !== null) {
          if (cellMatch[1]?.toLowerCase() === "th") hasTh = true;
          const cellText = unescapeHtml(cellMatch[2]?.replace(/<[^>]+>/g, "") ?? "").trim();
          rowCells.push(cellText);
        }

        if (rowIndex === 0 && hasTh) headerRow = true;
        if (rowCells.length > 0) rows.push(rowCells);
        rowIndex++;
      }

      if (rows.length > 0) {
        blocks.push({ kind: "table", text: "", table: { rows, headerRow } });
      }
      continue;
    }

    if (tag === "p" || tag === "div") {
      const cleanInner = inner.trim();
      if (!cleanInner || cleanInner === "<br>" || cleanInner === "<br/>") {
        blocks.push({ kind: "blank", text: "" });
        continue;
      }
      const segs = parseInlineHtml(inner);
      const text = segText(segs).trim();
      if (!text) {
        blocks.push({ kind: "blank", text: "" });
      } else {
        blocks.push({ kind: "paragraph", text: segText(segs), segs });
      }
      continue;
    }
  }

  // Handle trailing content if any
  const trailing = unescapeHtml(html.slice(lastIndex).replace(/<[^>]+>/g, "")).trim();
  if (trailing) {
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
    const line = (lines[i] ?? "").trim();

    if (isTableRow(line)) {
      const collected: string[][] = [];
      let headerRow = false;
      while (i < lines.length && isTableRow((lines[i] ?? "").trim())) {
        const current = (lines[i] ?? "").trim();
        if (isDivider(current)) {
          headerRow = collected.length === 1;
        } else {
          collected.push(cells(current));
        }
        i++;
      }
      i--;
      if (collected.length) {
        blocks.push({ kind: "table", text: "", table: { rows: collected, headerRow } });
      }
      continue;
    }

    if (!line) {
      blocks.push({ kind: "blank", text: "" });
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

    blocks.push(block("paragraph", line));
  }

  return blocks;
}

/**
 * Turns content into structured blocks for the handwriting layout engine.
 * Supports rich HTML from the editor as well as backward-compatible legacy markdown.
 */
export function parseContent(raw: string): Block[] {
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
        .replace(/>/g, "&gt;");
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
      case "blank":
        parts.push("<p><br></p>");
        break;
      case "table": {
        if (b.table) {
          const t = b.table;
          const rowsHtml = t.rows
            .map((row, rIdx) => {
              const tag = rIdx === 0 && t.headerRow ? "th" : "td";
              const cells = row.map((cell) => `<${tag}>${cell}</${tag}>`).join("");
              return `<tr>${cells}</tr>`;
            })
            .join("");
          parts.push(`<table><tbody>${rowsHtml}</tbody></table>`);
        }
        break;
      }
      case "paragraph":
      default:
        parts.push(`<p>${segsToHtml(b.segs)}</p>`);
        break;
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
    out.push(`| ${row.join(" | ")} |`);
    if (index === 0 && table.headerRow) out.push(`|${row.map(() => "---").join("|")}|`);
  });
  return out.join("\n");
}

/** Converts HTML content to plain text with preserved line breaks for on-page text editing. */
export function htmlToPlainText(html: string): string {
  if (!html) return "";
  if (!isHtmlContent(html)) return html;
  const withLineBreaks = html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|h[1-6]|li|tr|blockquote)>/gi, "\n")
    .replace(/<hr\s*\/?>/gi, "\n---\n");
  const stripped = withLineBreaks.replace(/<[^>]+>/g, "");
  return unescapeHtml(stripped).replace(/\r/g, "").replace(/\n{3,}/g, "\n\n").trimEnd();
}

/** Converts plain text input from on-page writing into clean paragraph HTML. */
export function plainTextToHtml(plain: string): string {
  if (!plain) return "<p><br></p>";
  const lines = plain.split("\n");
  const paragraphs: string[] = [];
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) {
      paragraphs.push("<p><br></p>");
    } else {
      const escaped = trimmed
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");
      paragraphs.push(`<p>${escaped}</p>`);
    }
  }
  return paragraphs.join("");
}
