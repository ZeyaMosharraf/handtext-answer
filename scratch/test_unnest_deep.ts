import { matchAttr, unescapeHtml, parseHtmlContent } from "../src/lib/handwriting/parse";

export function unnestBlockElements(html: string): string {
  // Hoist block-level elements (math-block, graph-block, tables) out of enclosing <p> tags
  const blockElementPattern = /<(?:div\b((?:[^"'>]|(["'])[\s\S]*?\2)*)>([\s\S]*?)<\/div>|table\b((?:[^"'>]|(["'])[\s\S]*?\5)*)>([\s\S]*?)<\/table>)/gi;

  return html.replace(/<p\b([^>]*)>([\s\S]*?)<\/p>/gi, (fullP, pAttrs, pInner) => {
    // Quick check if there might be a block element inside
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

// Test cases
const tests = [
  {
    name: "Text -> Math -> Text inside <p>",
    html: `<p>Intro text <div class="math-block" data-latex="x' = x - min / max - min">preview</div> Outro text</p>`,
  },
  {
    name: "Only Math inside <p>",
    html: `<p><div class="math-block" data-latex="f'(x) = 2x">preview</div></p>`,
  },
  {
    name: "Text -> Table -> Text inside <p>",
    html: `<p>Table header: <table><tr><td>Cell A</td><td>Cell B</td></tr></table> Table footer.</p>`,
  },
  {
    name: "Text -> Graph -> Text inside <p>",
    html: `<p>Graph intro <div class="graph-block" data-graph-definition="{&quot;title&quot;:&quot;My Graph&quot;}">preview</div> Graph outro</p>`,
  }
];

for (const t of tests) {
  console.log("=== Test:", t.name, "===");
  const unnested = unnestBlockElements(t.html);
  console.log("Unnested:\n" + unnested);
}
