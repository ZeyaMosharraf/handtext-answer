import { parseHtmlContent } from "../src/lib/handwriting/parse";
import { layoutDocument } from "../src/lib/handwriting/layout";
import { DEFAULT_SETTINGS } from "../src/lib/handwriting/types";

// Canvas mock for node
const mockCtx = {
  font: "",
  measureText: (text: string) => ({ width: text.length * 10 }),
  save: () => {},
  restore: () => {},
  fillText: () => {},
  strokeText: () => {},
  beginPath: () => {},
  moveTo: () => {},
  lineTo: () => {},
  stroke: () => {},
  fill: () => {},
  arc: () => {},
  transform: () => {},
  setLineDash: () => {},
} as unknown as CanvasRenderingContext2D;

const content = `<div data-block-id="txt_fa51ccdf257b" data-block-type="text"><p>First paragraph of student essay.</p><p>Second paragraph after pressing Enter naturally.</p><ul><li>First bullet point</li><li>Second bullet point</li><li> hello world  Here is a brand new sentence with multiple spaces and punctuation!</li><li>Now testing spaces inside the new paragraph: word one, word two, word three. typing with spaces test one two three </li></ul></div>
<div data-block-id="math_3a9fbe606eed" data-block-type="math" data-natural-expr="p_i" data-latex="p_i" data-display-mode="block" class="math-block" contenteditable="false">p_i</div>
<div data-block-id="txt_b5672f312003" data-block-type="text">&nbsp;Equation one<p></p><p></p></div>
<div data-block-id="math_f65b92bd784f" data-block-type="math" data-natural-expr="x^2" data-latex="x^2" data-display-mode="block" class="math-block" contenteditable="false">x^2</div>
<div data-block-id="math_3a09ce89f988" data-block-type="math" data-natural-expr="\\sqrt{x}" data-latex="\\sqrt{x}" data-display-mode="block" class="math-block" contenteditable="false">\\sqrt{x}</div>
<div data-block-id="txt_de6e196afbb2" data-block-type="text">&nbsp;<p></p><p></p></div>
<div data-block-id="math_3d51df339cac" data-block-type="math" data-natural-expr="E = mgh" data-latex="E = mgh" data-display-mode="block" class="math-block" contenteditable="false">E = mgh</div>
<div data-block-id="txt_4b8bf33539f9" data-block-type="text"><div data-block-id="txt_dfdd7db9df54" data-block-type="text">                               ghghvgjh     </div></div>
<div data-block-id="tbl_558a394131dd" data-block-type="table"><table class="my-3 w-full border-collapse border border-border text-sm"><thead><tr><th class="border border-border bg-muted/50 p-2 text-left text-xs font-semibold text-foreground">Col 1</th><th class="border border-border bg-muted/50 p-2 text-left text-xs font-semibold text-foreground">Col 2</th><th class="border border-border bg-muted/50 p-2 text-left text-xs font-semibold text-foreground">Col 3</th></tr></thead><tbody><tr><td class="border border-border p-2 text-xs text-foreground">&nbsp;</td><td class="border border-border p-2 text-xs text-foreground">&nbsp;</td><td class="border border-border p-2 text-xs text-foreground">&nbsp;</td></tr><tr><td class="border border-border p-2 text-xs text-foreground">&nbsp;</td><td class="border border-border p-2 text-xs text-foreground">&nbsp;</td><td class="border border-border p-2 text-xs text-foreground">&nbsp;</td></tr><tr><td class="border border-border p-2 text-xs text-foreground">&nbsp;</td><td class="border border-border p-2 text-xs text-foreground">&nbsp;</td><td class="border border-border p-2 text-xs text-foreground">&nbsp;</td></tr></tbody></table></div>
<div data-block-id="txt_8a54702b4414" data-block-type="text"><p><br></p></div>
<div data-block-id="grp_55d156eddc70" data-block-type="graph" data-graph-definition="{&quot;id&quot;:&quot;150d93e8-fbfa-48a1-9ee9-cbfa7b58649f&quot;,&quot;type&quot;:&quot;function&quot;,&quot;space&quot;:{&quot;xMin&quot;:-5,&quot;xMax&quot;:5,&quot;yMin&quot;:-1.5,&quot;yMax&quot;:1.5,&quot;showGrid&quot;:true,&quot;showAxisLabels&quot;:true,&quot;originVisible&quot;:true},&quot;xLabel&quot;:&quot;x&quot;,&quot;yLabel&quot;:&quot;y&quot;,&quot;functions&quot;:[{&quot;expression&quot;:&quot;sin(x)&quot;,&quot;label&quot;:&quot;y = sin(x)&quot;}]}" class="graph-block" contenteditable="false"><span class="graph-placeholder" style="width: 100%; height: 180px; border: 1px dashed #ccc; display: flex; align-items: center; justify-content: center; font-family: monospace; color: #666;">[Graph: function]</span></div>
<div data-block-id="txt_383895e57394" data-block-type="text"><p>Concluding student answer below graph: final results are verified with proper spacing.</p></div>`;

const layout = layoutDocument(mockCtx, {
  content,
  settings: DEFAULT_SETTINGS,
});

console.log("TOTAL PAGES:", layout.pages.length);
layout.pages.forEach((p, pIdx) => {
  console.log(`--- PAGE ${pIdx + 1} (placements: ${p.placements.length}) ---`);
  p.placements.forEach((pl, i) => {
    if (pl.type === "line") {
      const text = pl.segs.map(s => s.text).join("");
      console.log(`  [${i}] lineIndex=${pl.lineIndex} text=${JSON.stringify(text)}`);
    } else if (pl.type === "tableRow") {
      console.log(`  [${i}] lineIndex=${pl.lineIndex} lineUnits=${pl.lineUnits} TABLE ROW isFirst=${pl.isFirst} isHeader=${pl.isHeader}`);
    } else if (pl.type === "mathBlock") {
      console.log(`  [${i}] lineIndex=${pl.lineIndex} lineUnits=${pl.lineUnits} MATH: ${pl.latex}`);
    } else if (pl.type === "graphBlock") {
      console.log(`  [${i}] lineIndex=${pl.lineIndex} lineUnits=${pl.lineUnits} GRAPH`);
    }
  });
});
