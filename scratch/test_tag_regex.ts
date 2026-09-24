export function matchAttr(tagOrAttrs: string, attrName: string): string | null {
  const re = new RegExp(`${attrName}=(?:(["'])([\\s\\S]*?)\\1|([^\\s>]+))`, "i");
  const match = tagOrAttrs.match(re);
  if (!match) return null;
  return match[2] !== undefined ? match[2] : (match[3] ?? null);
}

const tagRe = /<div\b((?:[^"'>]|(["'])[\s\S]*?\2)*)>([\s\S]*?)<\/div>/gi;

const samples = [
  '<div class="math-block" data-latex="x > 0 and x\' = 1">content</div>',
  '<div class="math-block" data-latex="x\' = x - min / max - min" data-color="#123456">preview</div>',
  '<div data-latex=\'f"(x) > 0\' class="math-block">preview2</div>',
  '<div data-block-id="abc" data-block-type="math" data-latex="y\'\' + y = 0">preview3</div>'
];

for (const s of samples) {
  tagRe.lastIndex = 0;
  const match = tagRe.exec(s);
  if (match) {
    const attrs = match[1];
    console.log("Matched attrs:", attrs);
    console.log("data-latex:", matchAttr(attrs, "data-latex"));
    console.log("data-color:", matchAttr(attrs, "data-color"));
    console.log("---");
  } else {
    console.log("FAILED to match:", s);
  }
}
