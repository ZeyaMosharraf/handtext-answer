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

console.log("Unnest tests completed.");
