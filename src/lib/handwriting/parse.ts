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

const HIGHLIGHT_COLOR = "#141821"; // strong black ink for ==highlighted== words

/**
 * Inline formatting:
 *   **bold**      thicker, darker strokes
 *   __underline__ hand-drawn underline
 *   ==black==     forced dark ink for emphasis
 */
export function parseInline(raw: string): Seg[] {
  return parseInlineInto(raw, false, false);
}

function parseInlineInto(raw: string, bold: boolean, underline: boolean, color?: string): Seg[] {
  const segs: Seg[] = [];
  const re = /(\*\*|__|==)([\s\S]+?)\1/g;
  let last = 0;
  let match: RegExpExecArray | null;
  const push = (text: string, b: boolean, u: boolean, c?: string) => {
    if (!text) return;
    // Formats can nest (e.g. **__==word==__**) — recurse so markers never leak through.
    if (/(\*\*|__|==)/.test(text)) {
      segs.push(...parseInlineInto(text, b, u, c));
      return;
    }
    segs.push({ text, bold: b, underline: u, ...(c ? { color: c } : {}) });
  };
  while ((match = re.exec(raw))) {
    push(raw.slice(last, match.index), bold, underline, color);
    const inner = match[2] ?? "";
    if (match[1] === "**") push(inner, true, underline, HIGHLIGHT_COLOR);
    else if (match[1] === "__") push(inner, bold, true, color);
    else push(inner, bold, underline, HIGHLIGHT_COLOR);
    last = re.lastIndex;
  }
  push(raw.slice(last), bold, underline, color);
  return segs.length ? segs : [{ text: "", bold: false, underline: false }];
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

/**
 * Turns plain text (with light markdown-ish conventions) into structured
 * blocks so the handwriting renderer can preserve the answer's structure.
 * Supports markdown pipe tables, quotes, dividers and inline formatting.
 */
export function parseContent(raw: string): Block[] {
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

export function wordCount(raw: string): number {
  return raw.trim() ? raw.trim().split(/\s+/).length : 0;
}

/** Serialises a table back into markdown pipe syntax for the editor. */
export function tableToMarkdown(table: TableData): string {
  const out: string[] = [];
  table.rows.forEach((row, index) => {
    out.push(`| ${row.join(" | ")} |`);
    if (index === 0 && table.headerRow) out.push(`|${row.map(() => "---").join("|")}|`);
  });
  return out.join("\n");
}
