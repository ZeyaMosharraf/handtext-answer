import { matchAttr, unescapeHtml } from "../src/lib/handwriting/parse";
import { htmlToBlocks, blocksToHtml, unescapeAttr } from "../src/lib/editor/blockSerialization";

const html1 = '<div data-block-id="m1" data-block-type="math" data-latex="x\' = x - min / max - min" class="math-block">preview</div>';
const blocks1 = htmlToBlocks(html1);
console.log("Blocks 1:", blocks1);
if (blocks1[0].type === "math") {
  console.log("Latex 1:", blocks1[0].latex);
}

const html2 = '<p>Intro</p><div class="math-block" data-latex="f\'(x) = 2x"></div><p>Outro</p>';
const blocks2 = htmlToBlocks(html2);
console.log("Blocks 2 count:", blocks2.length);
if (blocks2[1].type === "math") {
  console.log("Latex 2:", blocks2[1].latex);
}
