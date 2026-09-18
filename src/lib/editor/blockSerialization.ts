/**
 * src/lib/editor/blockSerialization.ts
 *
 * Bidirectional serialization between DocumentBlock[] and HTML string.
 *
 * Architectural Invariants:
 * 1. Lossless round-trip: htmlToBlocks(blocksToHtml(blocks)) preserves all blocks,
 *    their stable IDs, types, content, and ordering.
 * 2. 100% Backward Compatibility: Legacy HTML (with unadorned math-block divs,
 *    tables, or graph-block divs) is parsed cleanly into typed blocks with generated stable IDs.
 * 3. Environment agnostic: Runs identically in Node.js (tests/SSR) and browser.
 * 4. Selection and ephemeral UI state are NEVER serialized into HTML.
 * 5. Formatting and attributes (e.g. data-latex, data-graph-definition, table classes)
 *    are preserved so that the downstream handwriting layout engine (parse.ts)
 *    continues to work without any modifications.
 */

import {
  type DocumentBlock,
  type TextBlock,
  type MathBlock,
  type TableBlock,
  type GraphBlock,
  createEmptyTextBlock,
  generateBlockId,
} from "../../types/document";
import type { GraphDefinition } from "../graph/types";

// ─── Attribute & HTML Escaping Helpers ───────────────────────────────────────

export function escapeAttr(str: string): string {
  if (!str) return "";
  return str
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

export function unescapeAttr(str: string): string {
  if (!str) return "";
  return str
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");
}

export function escapeHtml(str: string): string {
  return escapeAttr(str);
}

// ─── Serialization: DocumentBlock[] -> HTML ─────────────────────────────────

/**
 * Serializes an array of DocumentBlock objects into a clean, semantic HTML string.
 *
 * Each block is encapsulated in a top-level container with `data-block-id` and `data-block-type`.
 * Non-text blocks retain their specific marker attributes (`data-latex`, `data-graph-definition`,
 * `class="math-block"`, `class="graph-block"`) to guarantee full backward compatibility
 * with HandText's A4 pagination and handwriting renderer.
 */
export function blocksToHtml(blocks: DocumentBlock[]): string {
  if (!blocks || blocks.length === 0) {
    return "";
  }

  const parts: string[] = [];

  for (const block of blocks) {
    switch (block.type) {
      case "text": {
        const content = block.html?.trim() ? block.html : "<p><br></p>";
        parts.push(
          `<div data-block-id="${escapeAttr(block.id)}" data-block-type="text">${content}</div>`
        );
        break;
      }

      case "math": {
        const naturalExpr = block.naturalExpr || block.latex || "";
        const latex = block.latex || block.naturalExpr || "";
        const displayMode = block.displayMode || "block";
        const innerContent = escapeHtml(naturalExpr);

        parts.push(
          `<div data-block-id="${escapeAttr(block.id)}" data-block-type="math" data-natural-expr="${escapeAttr(naturalExpr)}" data-latex="${escapeAttr(latex)}" data-display-mode="${escapeAttr(displayMode)}" class="math-block" contenteditable="false">${innerContent}</div>`
        );
        break;
      }

      case "table": {
        const tableHtml = block.html?.trim() || "<table><tbody><tr><td></td></tr></tbody></table>";
        parts.push(
          `<div data-block-id="${escapeAttr(block.id)}" data-block-type="table">${tableHtml}</div>`
        );
        break;
      }

      case "graph": {
        const defJson = JSON.stringify(block.graphDef);
        const titleOrType = block.graphDef.title || block.graphDef.type || "Graph";

        parts.push(
          `<div data-block-id="${escapeAttr(block.id)}" data-block-type="graph" data-graph-definition="${escapeAttr(defJson)}" class="graph-block" contenteditable="false"><div class="graph-placeholder" style="width: 100%; height: 180px; border: 1px dashed #ccc; display: flex; align-items: center; justify-content: center; font-family: monospace; color: #666;">[Graph: ${escapeHtml(titleOrType)}]</div></div>`
        );
        break;
      }
    }
  }

  return parts.join("\n");
}

// ─── Deserialization: HTML -> DocumentBlock[] ─────────────────────────────────

/**
 * Parses an HTML string into an ordered list of typed DocumentBlock instances.
 *
 * Supports:
 * 1. Modern HandText HTML containing `data-block-type` and `data-block-id` attributes.
 * 2. Legacy HandText HTML containing unadorned `<div class="math-block">`, `<table ...>`,
 *    or `<div class="graph-block">` elements.
 * 3. Mixed content where some blocks have IDs and some do not.
 */
export function htmlToBlocks(rawHtml: string): DocumentBlock[] {
  if (!rawHtml || !rawHtml.trim()) {
    return [createEmptyTextBlock()];
  }

  const trimmed = rawHtml.trim();

  // Fast path: Check if document consists strictly of top-level data-block-type containers
  const modernBlockRegex =
    /<div[^>]*data-block-id=["']([^"']*)["'][^>]*data-block-type=["'](text|math|table|graph)["'][^>]*>([\s\S]*?)<\/div>|<div[^>]*data-block-type=["'](text|math|table|graph)["'][^>]*data-block-id=["']([^"']*)["'][^>]*>([\s\S]*?)<\/div>/gi;

  const modernBlocks: DocumentBlock[] = [];
  let lastIndex = 0;
  let hasNonModernContent = false;
  let match: RegExpExecArray | null;

  while ((match = modernBlockRegex.exec(trimmed)) !== null) {
    // Check if there was significant content preceding this modern block
    const precedingContent = trimmed.slice(lastIndex, match.index).trim();
    if (precedingContent && precedingContent.replace(/<[^>]+>/g, "").trim()) {
      hasNonModernContent = true;
      break;
    }

    lastIndex = modernBlockRegex.lastIndex;

    const blockId = match[1] || match[5] || generateBlockId("blk");
    const blockType = (match[2] || match[4]) as DocumentBlock["type"];
    const fullMatchedDiv = match[0];
    const innerHtml = match[3] || match[6] || "";

    if (blockType === "text") {
      modernBlocks.push({
        id: blockId,
        type: "text",
        html: innerHtml,
        createdAt: Date.now(),
      });
    } else if (blockType === "math") {
      const latexMatch = fullMatchedDiv.match(/data-latex=["']([^"']*)["']/i);
      const naturalMatch = fullMatchedDiv.match(/data-natural-expr=["']([^"']*)["']/i);
      const displayMatch = fullMatchedDiv.match(/data-display-mode=["']([^"']*)["']/i);

      const latex = latexMatch ? unescapeAttr(latexMatch[1] ?? "") : innerHtml.trim();
      const naturalExpr = naturalMatch
        ? unescapeAttr(naturalMatch[1] ?? "")
        : latex;
      const displayMode = (displayMatch ? displayMatch[1] : "block") as
        | "block"
        | "compact";

      modernBlocks.push({
        id: blockId,
        type: "math",
        naturalExpr,
        latex,
        displayMode: displayMode === "compact" ? "compact" : "block",
        createdAt: Date.now(),
      });
    } else if (blockType === "table") {
      // Find the inner <table> or treat innerHtml as table
      const tableMatch = innerHtml.match(/<table[\s\S]*?<\/table>/i);
      const tableHtml = tableMatch ? tableMatch[0] : innerHtml;

      modernBlocks.push({
        id: blockId,
        type: "table",
        html: tableHtml,
        createdAt: Date.now(),
      });
    } else if (blockType === "graph") {
      const defMatch = fullMatchedDiv.match(/data-graph-definition=["']([^"']*)["']/i);
      let graphDef: GraphDefinition;

      if (defMatch) {
        try {
          graphDef = JSON.parse(unescapeAttr(defMatch[1] ?? ""));
        } catch {
          graphDef = createDefaultGraphDef(blockId);
        }
      } else {
        graphDef = createDefaultGraphDef(blockId);
      }

      modernBlocks.push({
        id: blockId,
        type: "graph",
        graphDef,
        createdAt: Date.now(),
      });
    }
  }

  // Check if all content was matched cleanly by modern blocks
  const trailingContent = trimmed.slice(lastIndex).trim();
  if (
    !hasNonModernContent &&
    modernBlocks.length > 0 &&
    (!trailingContent || !trailingContent.replace(/<[^>]+>/g, "").trim())
  ) {
    return modernBlocks;
  }

  // Fallback / Hybrid Parser: Parses legacy HTML or mixed content
  return parseMixedOrLegacyHtml(trimmed);
}

// ─── Legacy & Mixed HTML Parser ──────────────────────────────────────────────

/**
 * Universal tag tokenizer for legacy or mixed HTML documents.
 * Extracts math blocks, table blocks, graph blocks, and bundles
 * surrounding HTML into clean TextBlock instances.
 */
function parseMixedOrLegacyHtml(html: string): DocumentBlock[] {
  const blocks: DocumentBlock[] = [];

  // Step 1: Pre-tokenize math blocks so nested divs don't break regex matching
  const mathTokenMap = new Map<
    string,
    { id?: string | undefined; latex: string; naturalExpr: string; displayMode: "block" | "compact" }
  >();
  let mathCounter = 0;

  let tokenized = html.replace(
    /<div[^>]*class=["'][^"']*math-block[^"']*["'][^>]*>([\s\S]*?)<\/div>|<div[^>]*data-latex=["'][^"']*["'][^>]*>([\s\S]*?)<\/div>/gi,
    (fullMatch) => {
      const idMatch = fullMatch.match(/data-block-id=["']([^"']*)["']/i);
      const latexMatch = fullMatch.match(/data-latex=["']([^"']*)["']/i);
      const naturalMatch = fullMatch.match(/data-natural-expr=["']([^"']*)["']/i);
      const displayMatch = fullMatch.match(/data-display-mode=["']([^"']*)["']/i);

      // Extract inner text fallback if data-latex is missing
      const innerText = fullMatch.replace(/<[^>]+>/g, "").trim();
      const latex = latexMatch ? unescapeAttr(latexMatch[1] ?? "") : innerText;
      const naturalExpr = naturalMatch ? unescapeAttr(naturalMatch[1] ?? "") : latex;
      const displayMode = (displayMatch ? displayMatch[1] : "block") as "block" | "compact";

      const token = `__HANDTEXT_MATH_BLOCK_TOKEN_${mathCounter++}__`;
      mathTokenMap.set(token, {
        id: idMatch ? idMatch[1] : undefined,
        latex,
        naturalExpr,
        displayMode,
      });

      return `\n${token}\n`;
    }
  );

  // Step 2: Pre-tokenize graph blocks
  const graphTokenMap = new Map<string, { id?: string | undefined; graphDef: GraphDefinition }>();
  let graphCounter = 0;

  tokenized = tokenized.replace(
    /<div[^>]*class=["'][^"']*graph-block[^"']*["'][^>]*>([\s\S]*?)<\/div>|<div[^>]*data-graph-definition=["'][^"']*["'][^>]*>([\s\S]*?)<\/div>/gi,
    (fullMatch) => {
      const idMatch = fullMatch.match(/data-block-id=["']([^"']*)["']/i);
      const defMatch = fullMatch.match(/data-graph-definition=["']([^"']*)["']/i);

      let graphDef: GraphDefinition;
      const idSeed = (idMatch && idMatch[1]) ? idMatch[1] : "grp";
      if (defMatch) {
        try {
          graphDef = JSON.parse(unescapeAttr(defMatch[1] ?? ""));
        } catch {
          graphDef = createDefaultGraphDef(idSeed);
        }
      } else {
        graphDef = createDefaultGraphDef(idSeed);
      }

      const token = `__HANDTEXT_GRAPH_BLOCK_TOKEN_${graphCounter++}__`;
      graphTokenMap.set(token, {
        id: idMatch ? idMatch[1] : undefined,
        graphDef,
      });

      return `\n${token}\n`;
    }
  );

  // Step 3: Pre-tokenize tables
  const tableTokenMap = new Map<string, { id?: string | undefined; tableHtml: string }>();
  let tableCounter = 0;

  tokenized = tokenized.replace(/<table[\s\S]*?<\/table>/gi, (tableHtml) => {
    const idMatch = tableHtml.match(/data-block-id=["']([^"']*)["']/i);
    const token = `__HANDTEXT_TABLE_BLOCK_TOKEN_${tableCounter++}__`;
    tableTokenMap.set(token, {
      id: idMatch ? idMatch[1] : undefined,
      tableHtml,
    });
    return `\n${token}\n`;
  });

  // Step 4: Split by tokens and extract interleaved text blocks
  const tokenRegex =
    /(__HANDTEXT_MATH_BLOCK_TOKEN_\d+__|__HANDTEXT_GRAPH_BLOCK_TOKEN_\d+__|__HANDTEXT_TABLE_BLOCK_TOKEN_\d+__)/g;

  let cursor = 0;
  let tokenMatch: RegExpExecArray | null;

  while ((tokenMatch = tokenRegex.exec(tokenized)) !== null) {
    const textPart = tokenized.slice(cursor, tokenMatch.index).trim();
    if (textPart && textPart.replace(/<[^>]+>/g, "").trim()) {
      blocks.push(buildTextBlockFromHtmlChunk(textPart));
    }

    cursor = tokenRegex.lastIndex;
    const token = tokenMatch[1]!;

    if (mathTokenMap.has(token)) {
      const data = mathTokenMap.get(token)!;
      blocks.push({
        id: data.id || generateBlockId("math"),
        type: "math",
        naturalExpr: data.naturalExpr,
        latex: data.latex,
        displayMode: data.displayMode,
        createdAt: Date.now(),
      });
    } else if (tableTokenMap.has(token)) {
      const data = tableTokenMap.get(token)!;
      blocks.push({
        id: data.id || generateBlockId("tbl"),
        type: "table",
        html: data.tableHtml,
        createdAt: Date.now(),
      });
    } else if (graphTokenMap.has(token)) {
      const data = graphTokenMap.get(token)!;
      blocks.push({
        id: data.id || generateBlockId("grp"),
        type: "graph",
        graphDef: data.graphDef,
        createdAt: Date.now(),
      });
    }
  }

  // Trailing text part
  const remainingText = tokenized.slice(cursor).trim();
  if (remainingText && remainingText.replace(/<[^>]+>/g, "").trim()) {
    blocks.push(buildTextBlockFromHtmlChunk(remainingText));
  }

  // If no blocks were found, provide an empty text block
  if (blocks.length === 0) {
    blocks.push(createEmptyTextBlock());
  }

  return blocks;
}

/**
 * Normalizes a raw HTML text chunk into a sanitized TextBlock.
 */
function buildTextBlockFromHtmlChunk(chunkHtml: string): TextBlock {
  // Check if chunk is wrapped in <div data-block-id="...">
  const idMatch = chunkHtml.match(/data-block-id=["']([^"']*)["']/i);
  const blockId = idMatch ? idMatch[1]! : generateBlockId("txt");

  // Clean wrapper divs if present
  let cleanHtml = chunkHtml;
  if (/^<div[^>]*data-block-type=["']text["'][^>]*>[\s\S]*<\/div>$/i.test(chunkHtml)) {
    cleanHtml = chunkHtml.replace(/^<div[^>]*>|<\/div>$/gi, "").trim();
  }

  return {
    id: blockId,
    type: "text",
    html: cleanHtml || "<p><br></p>",
    createdAt: Date.now(),
  };
}

/**
 * Creates a safe fallback GraphDefinition struct if JSON parsing fails.
 */
function createDefaultGraphDef(idSeed: string): GraphDefinition {
  return {
    id: idSeed || generateBlockId("grp"),
    type: "coordinate",
    space: {
      xMin: -5,
      xMax: 5,
      yMin: -5,
      yMax: 5,
      showGrid: true,
      showAxisLabels: true,
      originVisible: true,
    },
  };
}
