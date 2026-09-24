import {
  parseHtmlContent,
  blocksToHtml,
  htmlToPlainText,
  matchAttr,
  unnestBlockElements,
  type Block,
} from "../src/lib/handwriting/parse";
import {
  htmlToBlocks,
  blocksToHtml as docBlocksToHtml,
} from "../src/lib/editor/blockSerialization";
import type { DocumentBlock, MathBlock, TableBlock, GraphBlock } from "../src/types/document";

let passedCount = 0;
let failedCount = 0;

function assert(condition: unknown, testName: string, detail?: string) {
  if (Boolean(condition)) {
    console.log(`  ✓ [PASS] ${testName}`);
    passedCount++;
  } else {
    console.error(`  ✗ [FAIL] ${testName}${detail ? ` - ${detail}` : ""}`);
    failedCount++;
  }
}

console.log("\n==================================================");
console.log("PHASE 1 CONSISTENCY REGRESSION TESTS");
console.log("==================================================\n");

// ─── TEST 1: x' = x - min / max - min ───────────────────────────────────────
console.log("─── TEST 1: x' = x - min / max - min ───");
{
  const latexTarget = "x' = x - min / max - min";
  const html = `<p>Normalization formula:</p><div class="math-block" data-latex="${latexTarget}">preview</div><p>Next step.</p>`;

  // 1. handwriting parser (parseHtmlContent)
  const blocks = parseHtmlContent(html);
  const mathBlock = blocks.find((b) => b.kind === "math");
  assert(Boolean(mathBlock), "Math block detected by parseHtmlContent");
  assert(mathBlock?.math?.latex === latexTarget, "LaTeX formula contains apostrophe and not truncated", `Got: "${mathBlock?.math?.latex}"`);

  // 2. editor block serialization (htmlToBlocks)
  const docBlocks = htmlToBlocks(html);
  const docMath = docBlocks.find((b) => b.type === "math") as MathBlock | undefined;
  assert(Boolean(docMath), "Math block detected by htmlToBlocks");
  assert(docMath?.latex === latexTarget, "htmlToBlocks retains full formula with apostrophe", `Got: "${docMath?.latex}"`);

  // 3. htmlToPlainText
  const plain = htmlToPlainText(html);
  assert(plain.includes(latexTarget), "htmlToPlainText includes full formula without quote truncation");
}

// ─── TEST 2: f'(x) ──────────────────────────────────────────────────────────
console.log("\n─── TEST 2: f'(x) ───");
{
  const latexTarget = "f'(x) = 3x^2 + 2x";
  const html = `<div class="math-block" data-latex="${latexTarget}"></div>`;
  const blocks = parseHtmlContent(html);
  assert(blocks[0]?.kind === "math", "Block kind is math");
  assert(blocks[0]?.math?.latex === latexTarget, "Derivative formula f'(x) preserved completely", `Got: "${blocks[0]?.math?.latex}"`);
}

// ─── TEST 3: y'' ────────────────────────────────────────────────────────────
console.log("\n─── TEST 3: y'' ───");
{
  const latexTarget = "y'' + 4y' + 4y = 0";
  const html = `<div class="math-block" data-latex="${latexTarget}"></div>`;
  const blocks = parseHtmlContent(html);
  assert(blocks[0]?.kind === "math", "Block kind is math");
  assert(blocks[0]?.math?.latex === latexTarget, "Double-prime formula y'' preserved completely", `Got: "${blocks[0]?.math?.latex}"`);
}

// ─── TEST 4: Graph JSON/title containing quotes ─────────────────────────────
console.log("\n─── TEST 4: Graph JSON/title containing quotes ───");
{
  const graphTitle = "John's \"Special\" Curve";
  const graphDef = {
    title: graphTitle,
    type: "function",
    functions: [{ id: "f1", fn: "x^2", color: "#10b981", active: true }],
  };
  const defJson = JSON.stringify(graphDef).replace(/"/g, "&quot;");
  const html = `<div class="graph-block" data-graph-definition="${defJson}"></div>`;

  const blocks = parseHtmlContent(html);
  assert(blocks[0]?.kind === "graph", "Graph block detected");
  assert(blocks[0]?.graph?.definition?.title === graphTitle, "Graph title containing quotes parsed accurately", `Got: "${blocks[0]?.graph?.definition?.title}"`);

  // Serialization guard in blockSerialization.ts
  const docBlock: GraphBlock = {
    id: "grp_123",
    type: "graph",
    graphDef: graphDef as any,
    createdAt: Date.now(),
  };
  const serialized = docBlocksToHtml([docBlock]);
  assert(!serialized.includes("undefined"), "Serialized graph block does not contain 'undefined'");
  assert(serialized.includes("data-graph-definition="), "Serialized graph block has data-graph-definition");
}

// ─── TEST 5: Table cell containing normal text ──────────────────────────────
console.log("\n─── TEST 5: Table cell containing normal text ───");
{
  const tableHtml = `<table><tbody><tr><td>Product</td><td>Price</td></tr><tr><td>Notebook</td><td>$5.00</td></tr></tbody></table>`;
  const blocks = parseHtmlContent(tableHtml);
  assert(blocks[0]?.kind === "table", "Table parsed as kind table");
  assert(blocks[0]?.table?.rows.length === 2, "Table has 2 rows");
  assert(blocks[0]?.table?.rows[0]?.[0]?.text === "Product", "Cell [0,0] text is 'Product'");

  // Verify blocksToHtml does not produce [object Object]
  const serializedHtml = blocksToHtml(blocks);
  assert(!serializedHtml.includes("[object Object]"), "blocksToHtml does NOT output [object Object]");
  assert(serializedHtml.includes("<td>Product</td>") || serializedHtml.includes("<th>Product</th>"), "Serialized HTML contains cell text");
}

// ─── TEST 6: Table cell containing rich formatting ──────────────────────────
console.log("\n─── TEST 6: Table cell containing rich formatting ───");
{
  const tableHtml = `<table><tbody><tr><td><strong>Bold Title</strong> and <span style="color: #ff0000" data-color="#ff0000">Red Alert</span></td></tr></tbody></table>`;
  const blocks = parseHtmlContent(tableHtml);
  const cell = blocks[0]?.table?.rows[0]?.[0];
  assert(Boolean(cell), "Cell exists");
  assert(Boolean(cell?.segs.some((s) => s.bold && s.text.includes("Bold Title"))), "Bold segment parsed in cell");
  assert(Boolean(cell?.segs.some((s) => s.color === "#ff0000" && s.text.includes("Red Alert"))), "Color segment parsed in cell");

  const serializedHtml = blocksToHtml(blocks);
  assert(!serializedHtml.includes("[object Object]"), "Rich table serialization never outputs [object Object]");
  assert(serializedHtml.includes("<strong>Bold Title</strong>"), "Serialized table preserves <strong> tag");
  assert(serializedHtml.includes("#ff0000"), "Serialized table preserves color attribute");

  // Re-parse round trip
  const reparsed = parseHtmlContent(serializedHtml);
  const reparsedCell = reparsed[0]?.table?.rows[0]?.[0];
  assert(Boolean(reparsedCell?.segs.some((s) => s.bold)), "Round-tripped cell retains bold formatting");
  assert(Boolean(reparsedCell?.segs.some((s) => s.color === "#ff0000")), "Round-tripped cell retains color formatting");
}

// ─── TEST 7: Text → Math → Text ─────────────────────────────────────────────
console.log("\n─── TEST 7: Text → Math → Text ───");
{
  const html = `<p>First paragraph</p><div class="math-block" data-latex="x' = 1"></div><p>Second paragraph</p>`;
  const blocks = parseHtmlContent(html);
  assert(blocks.length === 3, `Expected 3 blocks, got ${blocks.length}`);
  assert(blocks[0]?.kind === "paragraph" && blocks[0]?.text.includes("First"), "Block 0 is paragraph 'First'");
  assert(blocks[1]?.kind === "math" && blocks[1]?.math?.latex === "x' = 1", "Block 1 is math 'x\\' = 1'");
  assert(blocks[2]?.kind === "paragraph" && blocks[2]?.text.includes("Second"), "Block 2 is paragraph 'Second'");
}

// ─── TEST 8: Text → Graph → Text ────────────────────────────────────────────
console.log("\n─── TEST 8: Text → Graph → Text ───");
{
  const html = `<p>Graph intro</p><div class="graph-block" data-graph-definition="{&quot;title&quot;:&quot;Plot&quot;}"></div><p>Graph outro</p>`;
  const blocks = parseHtmlContent(html);
  assert(blocks.length === 3, `Expected 3 blocks, got ${blocks.length}`);
  assert(blocks[0]?.kind === "paragraph", "Block 0 is paragraph");
  assert(blocks[1]?.kind === "graph", "Block 1 is graph");
  assert(blocks[2]?.kind === "paragraph", "Block 2 is paragraph");
}

// ─── TEST 9: Text → Table → Text ────────────────────────────────────────────
console.log("\n─── TEST 9: Text → Table → Text ───");
{
  const html = `<p>Table header intro</p><table><tr><td>Alpha</td><td>Beta</td></tr></table><p>Table footer note</p>`;
  const blocks = parseHtmlContent(html);
  assert(blocks.length === 3, `Expected 3 blocks, got ${blocks.length}`);
  assert(blocks[0]?.kind === "paragraph", "Block 0 is paragraph");
  assert(blocks[1]?.kind === "table", "Block 1 is table");
  assert(blocks[2]?.kind === "paragraph", "Block 2 is paragraph");
}

// ─── TEST 10: Nested block inside <p> is recovered ──────────────────────────
console.log("\n─── TEST 10: Nested block inside <p> is recovered ───");
{
  // 1. Math trapped inside <p>
  const trappedMath = `<p>Leading text <div class="math-block" data-latex="x' = x - min / max - min">preview</div> Trailing text</p>`;
  const unnestedMath = unnestBlockElements(trappedMath);
  assert(unnestedMath.includes("<p>Leading text </p>"), "Leading text wrapped in clean paragraph");
  assert(unnestedMath.includes('<div class="math-block" data-latex="x\' = x - min / max - min">preview</div>'), "Math block cleanly hoisted out of <p>");
  assert(unnestedMath.includes("<p> Trailing text</p>"), "Trailing text wrapped in clean paragraph");

  const blocksFromTrappedMath = parseHtmlContent(trappedMath);
  assert(blocksFromTrappedMath.length === 3, `Trapped math produced 3 blocks, got ${blocksFromTrappedMath.length}`);
  assert(blocksFromTrappedMath[0]?.kind === "paragraph" && blocksFromTrappedMath[0]?.text.includes("Leading"), "Leading paragraph parsed");
  assert(blocksFromTrappedMath[1]?.kind === "math" && blocksFromTrappedMath[1]?.math?.latex === "x' = x - min / max - min", "Trapped Math block recovered with full formula");
  assert(blocksFromTrappedMath[2]?.kind === "paragraph" && blocksFromTrappedMath[2]?.text.includes("Trailing"), "Trailing paragraph parsed");

  // 2. Only math inside <p>
  const isolatedMath = `<p><div class="math-block" data-latex="E = mc^2"></div></p>`;
  const blocksFromIsolated = parseHtmlContent(isolatedMath);
  assert(blocksFromIsolated.length === 1, `Isolated math produced 1 block, got ${blocksFromIsolated.length}`);
  assert(blocksFromIsolated[0]?.kind === "math" && blocksFromIsolated[0]?.math?.latex === "E = mc^2", "Isolated math block preserved cleanly without orphaned <p>");

  // 3. Table trapped inside <p>
  const trappedTable = `<p>Table caption: <table><tr><td>Item 1</td></tr></table> End of table.</p>`;
  const blocksFromTrappedTable = parseHtmlContent(trappedTable);
  assert(blocksFromTrappedTable.length === 3, `Trapped table produced 3 blocks, got ${blocksFromTrappedTable.length}`);
  assert(blocksFromTrappedTable[1]?.kind === "table", "Trapped Table block recovered without deletion");

  // 4. Graph trapped inside <p>
  const trappedGraph = `<p>See figure: <div class="graph-block" data-graph-definition="{&quot;title&quot;:&quot;Trapped Graph&quot;}"></div> (Fig 1.1)</p>`;
  const blocksFromTrappedGraph = parseHtmlContent(trappedGraph);
  assert(blocksFromTrappedGraph.length === 3, `Trapped graph produced 3 blocks, got ${blocksFromTrappedGraph.length}`);
  assert(blocksFromTrappedGraph[1]?.kind === "graph", "Trapped Graph block recovered without deletion");
}

// ─── TEST 11: Backward Compatibility & Quote Delimiters ───────────────────────
console.log("\n─── TEST 11: Backward Compatibility & Quote Delimiters ───");
{
  // Single-quoted attributes
  const singleQuoted = `<div class='math-block' data-latex='f"(x) = 12'></div>`;
  const sqBlocks = parseHtmlContent(singleQuoted);
  assert(sqBlocks[0]?.kind === "math" && sqBlocks[0]?.math?.latex === 'f"(x) = 12', "Single-quoted attributes containing double quotes parsed correctly");

  // Unquoted attribute in matchAttr
  assert(matchAttr('data-scale=1.2', 'data-scale') === '1.2', "Unquoted attribute parsed correctly");

  // Greater-than inside attribute
  const gtFormula = 'data-latex="x > 0 and y < 10"';
  assert(matchAttr(gtFormula, 'data-latex') === 'x > 0 and y < 10', "Formula containing > and < attributes extracted without truncation");
}

console.log("\n==================================================");
console.log(`PHASE 1 TEST SUMMARY: ${passedCount} PASSED, ${failedCount} FAILED`);
console.log("==================================================\n");

if (failedCount > 0) {
  process.exit(1);
}
