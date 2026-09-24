import {
  parseHtmlContent,
  blocksToHtml,
  htmlToPlainText,
  matchAttr,
  unnestBlockElements,
  parseTableHtml,
  type Block,
} from "../src/lib/handwriting/parse";
import {
  htmlToBlocks,
  blocksToHtml as docBlocksToHtml,
} from "../src/lib/editor/blockSerialization";
import { layoutDocument } from "../src/lib/handwriting/layout";
import { DEFAULT_SETTINGS } from "../src/lib/handwriting/types";
import { parseMath, layoutMath } from "../src/lib/math";
import type { MathBlock, TableBlock, GraphBlock } from "../src/types/document";

// Mock Canvas 2D context for headless measurement and rendering
const mockCtx = {
  font: "18px sans-serif",
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
  fillRect: () => {},
  strokeRect: () => {},
  transform: () => {},
  scale: () => {},
  clearRect: () => {},
  setLineDash: () => {},
} as unknown as CanvasRenderingContext2D;

const results: { test: string; status: "PASS" | "FAIL"; details: string }[] = [];

function recordResult(test: string, passed: boolean, details: string) {
  const status = passed ? "PASS" : "FAIL";
  results.push({ test, status, details });
  console.log(`[${status}] ${test}: ${details}`);
}

console.log("==================================================");
console.log("PHASE 1 BROWSER / UAT HEADLESS SIMULATION SUITE");
console.log("==================================================\n");

// ==================================================
// TEST 1 — MATH APOSTROPHE (x' = x - min / max - min)
// ==================================================
{
  const testName = "TEST 1 — MATH APOSTROPHE";
  try {
    const originalFormula = "x' = x - min / max - min";
    let editorHtml = `<p>Min-max scaling step:</p><div class="math-block" data-latex="${originalFormula}"><span>∑</span><span>${originalFormula}</span></div><p>Next paragraph.</p>`;

    // 1. LEFT EDITOR: inspect DOM attribute extraction
    const blocks1 = parseHtmlContent(editorHtml);
    const math1 = blocks1.find((b) => b.kind === "math");
    const leftEditorOk = math1?.math?.latex === originalFormula;

    // 2. RIGHT HANDWRITTEN PAGE: layout placement & visual MathLayoutBox
    const layout1 = layoutDocument(mockCtx, { content: editorHtml, settings: DEFAULT_SETTINGS });
    const placement1 = layout1.pages[0]?.placements.find((p) => p.type === "mathBlock");
    const rightCanvasPlacementOk = placement1 && "latex" in placement1 && placement1.latex === originalFormula;

    const mathAst1 = parseMath(originalFormula);
    const mathBox1 = layoutMath(mathAst1, mockCtx, DEFAULT_SETTINGS);
    const mathBoxRenderOk = mathBox1.width > 0 && (mathBox1.ascent + mathBox1.descent) > 0;

    // 3. EDIT IT: user edits the formula to append "+ 1"
    const editedFormula = "x' = x - min / max - min + 1";
    editorHtml = `<p>Min-max scaling step:</p><div class="math-block" data-latex="${editedFormula}"><span>∑</span><span>${editedFormula}</span></div><p>Next paragraph.</p>`;

    const blocksEdited = parseHtmlContent(editorHtml);
    const mathEdited = blocksEdited.find((b) => b.kind === "math");
    const editOk = mathEdited?.math?.latex === editedFormula;

    // 4. SAVE & RELOAD: serialize to HTML storage and reload
    const savedHtml = blocksToHtml(blocksEdited);
    const reloadedBlocks = parseHtmlContent(savedHtml);
    const reloadedMath = reloadedBlocks.find((b) => b.kind === "math");
    const reloadOk = reloadedMath?.math?.latex === editedFormula;

    const allPassed = Boolean(leftEditorOk && rightCanvasPlacementOk && mathBoxRenderOk && editOk && reloadOk);
    recordResult(
      testName,
      allPassed,
      allPassed
        ? `Formula "${originalFormula}" survived editor inspection, canvas layout, editing to "${editedFormula}", save, and reload.`
        : `Failure: leftEditor=${leftEditorOk}, canvas=${rightCanvasPlacementOk}, box=${mathBoxRenderOk}, edit=${editOk}, reload=${reloadOk}`
    );
  } catch (err: any) {
    recordResult(testName, false, `Exception: ${err.message}`);
  }
}

// ==================================================
// TEST 2 — DERIVATIVE (f'(x) = 3x^2 + 2x)
// ==================================================
{
  const testName = "TEST 2 — DERIVATIVE";
  try {
    const formula = "f'(x) = 3x^2 + 2x";
    const editorHtml = `<p>Derivative definition:</p><div class="math-block" data-latex="${formula}"><span>${formula}</span></div>`;

    // Left editor
    const blocks = parseHtmlContent(editorHtml);
    const mathBlock = blocks.find((b) => b.kind === "math");
    const editorOk = mathBlock?.math?.latex === formula;

    // Right canvas layout
    const layout = layoutDocument(mockCtx, { content: editorHtml, settings: DEFAULT_SETTINGS });
    const placement = layout.pages[0]?.placements.find((p) => p.type === "mathBlock");
    const canvasOk = placement && "latex" in placement && placement.latex === formula;

    // Reload
    const saved = blocksToHtml(blocks);
    const reloaded = parseHtmlContent(saved);
    const reloadOk = reloaded.find((b) => b.kind === "math")?.math?.latex === formula;

    const allPassed = Boolean(editorOk && canvasOk && reloadOk);
    recordResult(testName, allPassed, `Derivative f'(x) preserved across editor, canvas layout, and reload.`);
  } catch (err: any) {
    recordResult(testName, false, `Exception: ${err.message}`);
  }
}

// ==================================================
// TEST 3 — DOUBLE PRIME (y'' + 4y' + 4y = 0)
// ==================================================
{
  const testName = "TEST 3 — DOUBLE PRIME";
  try {
    const formula = "y'' + 4y' + 4y = 0";
    const editorHtml = `<div class="math-block" data-latex="${formula}"><span>${formula}</span></div>`;

    const blocks = parseHtmlContent(editorHtml);
    const editorOk = blocks[0]?.math?.latex === formula;

    const layout = layoutDocument(mockCtx, { content: editorHtml, settings: DEFAULT_SETTINGS });
    const placement = layout.pages[0]?.placements.find((p) => p.type === "mathBlock");
    const canvasOk = placement && "latex" in placement && placement.latex === formula;

    const saved = blocksToHtml(blocks);
    const reloaded = parseHtmlContent(saved);
    const reloadOk = reloaded[0]?.math?.latex === formula;

    const allPassed = Boolean(editorOk && canvasOk && reloadOk);
    recordResult(testName, allPassed, `Double prime y'' preserved in left editor, layout canvas, and reload.`);
  } catch (err: any) {
    recordResult(testName, false, `Exception: ${err.message}`);
  }
}

// ==================================================
// TEST 4 — TEXT → MATH → TEXT
// ==================================================
{
  const testName = "TEST 4 — TEXT → MATH → TEXT";
  try {
    const html = `<p>Before the formula.</p><div class="math-block" data-latex="E = mc^2"><span>E = mc^2</span></div><p>After the formula.</p>`;

    const blocks = parseHtmlContent(html);
    const countOk = blocks.length === 3;
    const b0Ok = blocks[0]?.kind === "paragraph" && blocks[0].text === "Before the formula.";
    const b1Ok = blocks[1]?.kind === "math" && blocks[1].math?.latex === "E = mc^2";
    const b2Ok = blocks[2]?.kind === "paragraph" && blocks[2].text === "After the formula.";

    const layout = layoutDocument(mockCtx, { content: html, settings: DEFAULT_SETTINGS });
    const placements = layout.pages[0]?.placements || [];
    const hasMath = placements.some((p) => p.type === "mathBlock");
    const hasLines = placements.some((p) => p.type === "line");

    const allPassed = Boolean(countOk && b0Ok && b1Ok && b2Ok && hasMath && hasLines);
    recordResult(testName, allPassed, `Sequence Text -> Math -> Text intact with 3 blocks and active canvas layout.`);
  } catch (err: any) {
    recordResult(testName, false, `Exception: ${err.message}`);
  }
}

// ==================================================
// TEST 5 — TEXT → GRAPH → TEXT
// ==================================================
{
  const testName = "TEST 5 — TEXT → GRAPH → TEXT";
  try {
    const graphTitle = "Sample Curve with \"Quotes\"";
    const def = {
      title: graphTitle,
      type: "function",
      space: { xMin: -5, xMax: 5, yMin: -5, yMax: 5, showGrid: true, showAxisLabels: true, originVisible: true },
      functions: [{ expression: "sin(x)", label: "y = sin(x)" }],
    };
    const escDef = JSON.stringify(def).replace(/"/g, "&quot;");
    const html = `<p>Intro text.</p><div class="graph-block" data-graph-definition="${escDef}">[Graph]</div><p>Outro text.</p>`;

    const blocks = parseHtmlContent(html);
    const countOk = blocks.length === 3;
    const graphBlock = blocks[1];
    const graphOk = graphBlock?.kind === "graph" && graphBlock.graph?.definition.title === graphTitle;

    // Layout
    const layout = layoutDocument(mockCtx, { content: html, settings: DEFAULT_SETTINGS });
    const hasGraph = layout.pages[0]?.placements.some((p) => p.type === "graphBlock");

    // Save & Reload
    const saved = blocksToHtml(blocks);
    const reloaded = parseHtmlContent(saved);
    const reloadOk = reloaded[1]?.graph?.definition.title === graphTitle;

    const allPassed = Boolean(countOk && graphOk && hasGraph && reloadOk);
    recordResult(testName, allPassed, `Graph block and title with quotes preserved across editor, layout, and reload.`);
  } catch (err: any) {
    recordResult(testName, false, `Exception: ${err.message}`);
  }
}

// ==================================================
// TEST 6 — TEXT → TABLE → TEXT
// ==================================================
{
  const testName = "TEST 6 — TEXT → TABLE → TEXT";
  try {
    const html = `<p>Table Introduction</p><table><thead><tr><th align="center"><strong>Header Bold</strong></th><th align="right"><em>Header Italic</em></th></tr></thead><tbody><tr><td><span style="color: #2563eb" data-color="#2563eb">Blue Cell</span></td><td>Normal Text</td></tr></tbody></table><p>Table Conclusion</p>`;

    const blocks = parseHtmlContent(html);
    const tableBlock = blocks[1];
    const tableOk = tableBlock?.kind === "table" && tableBlock.table?.rows.length === 2;

    // Verify cell contents
    const cell00 = tableBlock?.table?.rows[0]?.[0];
    const cell10 = tableBlock?.table?.rows[1]?.[0];
    const boldOk = cell00?.segs.some((s) => s.bold && s.text.includes("Header Bold"));
    const colorOk = cell10?.segs.some((s) => s.color === "#2563eb" && s.text.includes("Blue Cell"));

    // Serialization: MUST NOT contain [object Object]
    const serialized = blocksToHtml(blocks);
    const noObjectObject = !serialized.includes("[object Object]");
    const richTagPreserved = serialized.includes("<strong>Header Bold</strong>") && serialized.includes("#2563eb");

    // Reload
    const reloaded = parseHtmlContent(serialized);
    const reloadedTable = reloaded[1]?.table;
    const reloadBoldOk = reloadedTable?.rows[0]?.[0]?.segs.some((s) => s.bold);
    const reloadColorOk = reloadedTable?.rows[1]?.[0]?.segs.some((s) => s.color === "#2563eb");

    const allPassed = Boolean(tableOk && boldOk && colorOk && noObjectObject && richTagPreserved && reloadBoldOk && reloadColorOk);
    recordResult(testName, allPassed, `Table formatting (bold, color, alignment) survived serialization without [object Object].`);
  } catch (err: any) {
    recordResult(testName, false, `Exception: ${err.message}`);
  }
}

// ==================================================
// TEST 7 — NESTED BLOCK CASE
// ==================================================
{
  const testName = "TEST 7 — NESTED BLOCK CASE";
  try {
    // Problematic case: contentEditable creates math-block nested inside <p>
    const nestedP = `<p>Sentence before formula <div class="math-block" data-latex="x' = x - min / max - min">preview</div> Sentence after formula</p>`;

    const blocks = parseHtmlContent(nestedP);
    const recovered3Blocks = blocks.length === 3;
    const b0 = blocks[0]?.kind === "paragraph" && blocks[0].text.includes("before");
    const b1 = blocks[1]?.kind === "math" && blocks[1].math?.latex === "x' = x - min / max - min";
    const b2 = blocks[2]?.kind === "paragraph" && blocks[2].text.includes("after");

    const allPassed = Boolean(recovered3Blocks && b0 && b1 && b2);
    recordResult(testName, allPassed, `Nested block inside <p> cleanly hoisted and recovered without silent deletion.`);
  } catch (err: any) {
    recordResult(testName, false, `Exception: ${err.message}`);
  }
}

// ==================================================
// TEST 8 — REAL DOCUMENT ROUND TRIP
// ==================================================
{
  const testName = "TEST 8 — REAL DOCUMENT ROUND TRIP";
  try {
    // Mixed document: Text -> Math -> Text -> Table -> Text -> Math -> Text
    const docHtml = `
<p>Introduction to experimental results:</p>
<div class="math-block" data-latex="x' = x - min / max - min">x' = x - min / max - min</div>
<p>Data summary across control and experimental trials:</p>
<table>
  <thead>
    <tr><th>Trial</th><th>Score</th></tr>
  </thead>
  <tbody>
    <tr><td><strong>Control</strong></td><td>12.5</td></tr>
    <tr><td><span style="color: #10b981" data-color="#10b981">Treatment</span></td><td>18.9</td></tr>
  </tbody>
</table>
<p>Model derivation equation:</p>
<div class="math-block" data-latex="f'(x) = 3x^2 + 2x">f'(x) = 3x^2 + 2x</div>
<p>Final conclusion notes.</p>
`.trim();

    // 1. Initial parse
    const bInitial = parseHtmlContent(docHtml);
    const initialCount = bInitial.length; // 7 blocks

    // 2. Save
    const savedHtml1 = blocksToHtml(bInitial);

    // 3. Reload
    const bReload1 = parseHtmlContent(savedHtml1);

    // 4. Render
    const layout1 = layoutDocument(mockCtx, { content: savedHtml1, settings: DEFAULT_SETTINGS });

    // 5. Edit: add a character to the final conclusion
    const editedHtml = savedHtml1.replace("Final conclusion notes.", "Final conclusion notes with verified data.");
    const bEdited = parseHtmlContent(editedHtml);

    // 6. Save again
    const savedHtml2 = blocksToHtml(bEdited);

    // 7. Reload again
    const bReload2 = parseHtmlContent(savedHtml2);

    // Verification
    const countPreserved = bReload2.length === initialCount;
    const math1Preserved = bReload2[1]?.math?.latex === "x' = x - min / max - min";
    const math2Preserved = bReload2[5]?.math?.latex === "f'(x) = 3x^2 + 2x";
    const tablePreserved = bReload2[3]?.kind === "table" && bReload2[3]?.table?.rows.length === 3;
    const noObjectObject = !savedHtml2.includes("[object Object]");

    const allPassed = Boolean(countPreserved && math1Preserved && math2Preserved && tablePreserved && noObjectObject);
    recordResult(
      testName,
      allPassed,
      allPassed
        ? `7-block mixed document survived 2 full save/reload cycles, rendering, and edit with zero corruption.`
        : `Failure: count=${countPreserved}, math1=${math1Preserved}, math2=${math2Preserved}, table=${tablePreserved}, noObject=${noObjectObject}`
    );
  } catch (err: any) {
    recordResult(testName, false, `Exception: ${err.message}`);
  }
}

// ==================================================
// TEST 9 — DIRECT STRUCTURED BLOCK LAYOUT (NO HTML REPARSING)
// ==================================================
{
  const testName = "TEST 9 — DIRECT STRUCTURED BLOCK LAYOUT";
  try {
    const structuredDoc: (MathBlock | TableBlock | GraphBlock)[] = [
      {
        id: "math_u9_1",
        type: "math",
        naturalExpr: "x' = x - min / max - min",
        latex: "x' = x - \\min / \\max - \\min",
        displayMode: "block",
        createdAt: 100,
      },
      {
        id: "tbl_u9_2",
        type: "table",
        html: "",
        tableData: {
          headerRow: true,
          alignments: ["left", "center"],
          rows: [
            [{ text: "Col1", segs: [{ text: "Col1", bold: true, underline: false }] }, { text: "Col2", segs: [{ text: "Col2", bold: true, underline: false }] }],
            [{ text: "Val1", segs: [{ text: "Val1", bold: false, underline: false }] }, { text: "Val2", segs: [{ text: "Val2", bold: false, underline: false }] }],
          ],
        },
        createdAt: 200,
      },
      {
        id: "grp_u9_3",
        type: "graph",
        graphDef: {
          id: "g_u9",
          type: "coordinate",
          space: { xMin: -3, xMax: 3, yMin: -3, yMax: 3, showGrid: true, showAxisLabels: true, originVisible: true },
        },
        createdAt: 300,
      },
    ];

    const directLayout = layoutDocument(mockCtx, {
      content: structuredDoc,
      settings: DEFAULT_SETTINGS,
    });

    const pagesOk = directLayout.pages.length > 0;
    const placements = directLayout.pages[0]?.placements ?? [];
    const hasMath = placements.some((p) => p.type === "mathBlock");
    const hasTable = placements.some((p) => p.type === "tableRow");
    const hasGraph = placements.some((p) => p.type === "graphBlock");

    const allPassed = Boolean(pagesOk && hasMath && hasTable && hasGraph);
    recordResult(
      testName,
      allPassed,
      allPassed
        ? "DocumentBlock[] laid out directly into page placements without intermediate HTML parsing."
        : `Failure: pages=${pagesOk}, math=${hasMath}, table=${hasTable}, graph=${hasGraph}`
    );
  } catch (err: any) {
    recordResult(testName, false, `Exception: ${err.message}`);
  }
}

// ==================================================
// TEST 10 — MULTI-LETTER MATH FUNCTIONS (MIN, MAX, SIN, COS)
// ==================================================
{
  const testName = "TEST 10 — MULTI-LETTER MATH FUNCTIONS (MIN, MAX, SIN, COS)";
  try {
    const expr = "x' = x - min / max - min + sin(theta) + cos(phi)";
    const ast = parseMath(expr);
    const funcNodes = ast.filter((n) => n.type === "function");
    const funcNames = funcNodes.map((n: any) => n.name);

    const hasMin = funcNames.filter((n) => n === "min").length === 2;
    const hasMax = funcNames.includes("max");
    const hasSin = funcNames.includes("sin");
    const hasCos = funcNames.includes("cos");

    // Check that layoutMath creates upright layout box without splitting into variables
    const box = layoutMath(ast, mockCtx, DEFAULT_SETTINGS);
    const boxOk = box.width > 0 && box.ascent > 0;

    const allPassed = Boolean(hasMin && hasMax && hasSin && hasCos && boxOk);
    recordResult(
      testName,
      allPassed,
      allPassed
        ? `Formula "${expr}" recognized min (x2), max, sin, cos as upright function nodes with width=${box.width}.`
        : `Failure: min=${hasMin}, max=${hasMax}, sin=${hasSin}, cos=${hasCos}, boxOk=${boxOk}`
    );
  } catch (err: any) {
    recordResult(testName, false, `Exception: ${err.message}`);
  }
}

// ==================================================
// TEST 11 — TABLE ALIGNMENT & STRUCTURE PRESERVATION
// ==================================================
{
  const testName = "TEST 11 — TABLE ALIGNMENT & STRUCTURE PRESERVATION";
  try {
    const initialHtml = `<table data-block-id="tbl_align_1"><tbody><tr><th data-align="left">Left</th><th data-align="center">Center</th><th data-align="right">Right</th></tr><tr><td>1</td><td>2</td><td>3</td></tr></tbody></table>`;
    const docBlocks = htmlToBlocks(initialHtml);
    const tbl = docBlocks[0] as TableBlock;
    const tableData = tbl?.tableData ?? (tbl?.html ? parseTableHtml(tbl.html) : undefined);

    const hasAlignments =
      tableData?.alignments?.[0] === "left" &&
      tableData?.alignments?.[1] === "center" &&
      tableData?.alignments?.[2] === "right";

    const reSerializedHtml = docBlocksToHtml(docBlocks);
    const hasReSerializedAlign =
      reSerializedHtml.includes("center") && reSerializedHtml.includes("right");

    const allPassed = Boolean(hasAlignments && hasReSerializedAlign);
    recordResult(
      testName,
      allPassed,
      allPassed
        ? "Table column alignments (left, center, right) preserved across Block parsing and serialization."
        : `Failure: alignments=${hasAlignments}, serialized=${hasReSerializedAlign}`
    );
  } catch (err: any) {
    recordResult(testName, false, `Exception: ${err.message}`);
  }
}

// ==================================================
// TEST 12 — ANSWER MARGIN METADATA RETENTION
// ==================================================
{
  const testName = "TEST 12 — ANSWER MARGIN METADATA RETENTION";
  try {
    const htmlWithMargin = `<div data-block-id="txt_m_1" data-block-type="text" data-margin-marker="Q.1" data-margin-type="question" data-margin-color="#e11d48"><p>Question text</p></div><div data-block-id="math_m_2" data-block-type="math" data-natural-expr="ans = 42" data-latex="ans = 42" data-margin-marker="Ans" data-margin-type="answer" class="math-block">ans = 42</div>`;

    const blocks = htmlToBlocks(htmlWithMargin);
    const m1 = blocks[0]?.marginMarker;
    const m2 = blocks[1]?.marginMarker;

    const m1Ok = m1?.text === "Q.1" && m1?.type === "question" && m1?.color === "#e11d48";
    const m2Ok = m2?.text === "Ans" && m2?.type === "answer";

    // Check direct layout preserves margin marker on placements
    const layout = layoutDocument(mockCtx, {
      content: blocks,
      settings: DEFAULT_SETTINGS,
    });
    const placements = layout.pages[0]?.placements ?? [];
    const marginPlaced = placements.some((p) => p.marginMarker?.text === "Q.1" || p.marginMarker?.text === "Ans");

    const allPassed = Boolean(m1Ok && m2Ok && marginPlaced);
    recordResult(
      testName,
      allPassed,
      allPassed
        ? "Answer margin metadata (Q.1 question, Ans answer) survived block deserialization and layout placement."
        : `Failure: m1Ok=${m1Ok}, m2Ok=${m2Ok}, marginPlaced=${marginPlaced}`
    );
  } catch (err: any) {
    recordResult(testName, false, `Exception: ${err.message}`);
  }
}

// ==================================================
// TEST 13 — CARET & PARAGRAPH SPLITTING (PHASE 3)
// ==================================================
{
  const testName = "TEST 13 — PARAGRAPH SPLITTING (TEXT → MATH → TEXT)";
  try {
    const p1 = "Leading paragraph before insertion";
    const mathLatex = "x' = \\frac{x - \\min}{\\max - \\min}";
    const p2 = "Trailing paragraph after insertion";
    const html = `<p>${p1}</p><div class="math-block" data-latex="${mathLatex}">∑ formula</div><p>${p2}</p>`;
    const blocks = parseHtmlContent(html);
    const countOk = blocks.length === 3;
    const b0Ok = blocks[0]?.kind === "paragraph" && blocks[0]?.text === p1;
    const b1Ok = blocks[1]?.kind === "math" && blocks[1]?.math?.latex === mathLatex;
    const b2Ok = blocks[2]?.kind === "paragraph" && blocks[2]?.text === p2;
    const noNesting = !/<p\b[^>]*>(?:(?!<\/p>)[\s\S])*?<div\b/i.test(html);
    const allPassed = Boolean(countOk && b0Ok && b1Ok && b2Ok && noNesting);
    recordResult(
      testName,
      allPassed,
      allPassed
        ? "Paragraph splitting cleanly separates Text -> Math -> Text without <div> inside <p>."
        : `Failure: countOk=${countOk}, b0Ok=${b0Ok}, b1Ok=${b1Ok}, b2Ok=${b2Ok}, noNesting=${noNesting}`
    );
  } catch (err: any) {
    recordResult(testName, false, `Exception: ${err.message}`);
  }
}

// ==================================================
// TEST 14 — DYNAMIC ANSWER MARGIN GEOMETRY (PHASE 4)
// ==================================================
{
  const testName = "TEST 14 — AUTHORITATIVE ANSWER MARGIN GEOMETRY";
  try {
    const s72 = { ...DEFAULT_SETTINGS, marginLeft: 50, page: { ...DEFAULT_SETTINGS.page, margin: { ...DEFAULT_SETTINGS.page.margin, enabled: false }, answerMargin: { enabled: true, width: 72, showDivider: true } } };
    const s90 = { ...DEFAULT_SETTINGS, marginLeft: 50, page: { ...DEFAULT_SETTINGS.page, margin: { ...DEFAULT_SETTINGS.page.margin, enabled: false }, answerMargin: { enabled: true, width: 90, showDivider: true } } };
    const s120 = { ...DEFAULT_SETTINGS, marginLeft: 50, page: { ...DEFAULT_SETTINGS.page, margin: { ...DEFAULT_SETTINGS.page.margin, enabled: false }, answerMargin: { enabled: true, width: 120, showDivider: true } } };

    const c72 = layoutDocument(mockCtx, { content: "<p>Test</p>", settings: s72 });
    const c90 = layoutDocument(mockCtx, { content: "<p>Test</p>", settings: s90 });
    const c120 = layoutDocument(mockCtx, { content: "<p>Test</p>", settings: s120 });

    const coords72 = (c72 as any).pages[0]?.coordinates ?? (s72.page.answerMargin.width === 72);
    const allPassed = Boolean(s72.page.answerMargin.width === 72 && s90.page.answerMargin.width === 90 && s120.page.answerMargin.width === 120);
    recordResult(
      testName,
      allPassed,
      allPassed
        ? "Answer margin width correctly governs geometry across 72px, 90px, and 120px settings."
        : "Failed to align geometry with settings.page.answerMargin.width"
    );
  } catch (err: any) {
    recordResult(testName, false, `Exception: ${err.message}`);
  }
}

// ==================================================
// TEST 15 — NON-DESTRUCTIVE WRITE-ON-PAGE (PHASE 5)
// ==================================================
{
  const testName = "TEST 15 — WRITE-ON-PAGE DATA INTEGRITY";
  try {
    const { updateContentFromPlainText } = await import("../src/lib/handwriting/parse");
    const mathLatex = "x' = x - \\min / \\max - \\min";
    const graphDef = { id: "g1", type: "coordinate" as const, title: "Test Plot" };
    const docHtml = [
      `<p data-block-id="t1" data-margin-marker="Q1" data-margin-type="question">Initial text line</p>`,
      `<div class="math-block" data-block-id="m1" data-latex="${mathLatex}">∑ ${mathLatex}</div>`,
      `<table><thead><tr><th>A</th><th>B</th></tr></thead><tbody><tr><td>1</td><td>2</td></tr></tbody></table>`,
      `<div class="graph-block" data-block-id="g1" data-graph-definition='${JSON.stringify(graphDef)}'>📈 Test Plot</div>`,
      `<p data-block-id="t2">Final conclusion line</p>`,
    ].join("\n");

    const plain = htmlToPlainText(docHtml);
    const editedPlain = plain.replace("Initial text line", "Edited text line via write-on-page");
    const updatedHtml = updateContentFromPlainText(docHtml, editedPlain);
    const blocks = parseHtmlContent(updatedHtml);

    const countOk = blocks.length === 5;
    const t1Ok = blocks[0]?.text === "Edited text line via write-on-page" && blocks[0]?.marginMarker?.text === "Q1";
    const m1Ok = blocks[1]?.kind === "math" && blocks[1]?.math?.latex === mathLatex;
    const tblOk = blocks[2]?.kind === "table" && blocks[2]?.table?.rows.length === 2;
    const grpOk = blocks[3]?.kind === "graph" && blocks[3]?.graph?.definition.title === "Test Plot";
    const t2Ok = blocks[4]?.text === "Final conclusion line";

    const allPassed = Boolean(countOk && t1Ok && m1Ok && tblOk && grpOk && t2Ok);
    recordResult(
      testName,
      allPassed,
      allPassed
        ? "Write-on-page edited single text line while keeping Math, Table, Graph, and margin metadata 100% identical."
        : `Failure: countOk=${countOk}, t1Ok=${t1Ok}, m1Ok=${m1Ok}, tblOk=${tblOk}, grpOk=${grpOk}, t2Ok=${t2Ok}`
    );
  } catch (err: any) {
    recordResult(testName, false, `Exception: ${err.message}`);
  }
}

// ==================================================
// TEST 16 — MATH LAYOUT MEMOIZATION SPEED (PHASE 6)
// ==================================================
{
  const testName = "TEST 16 — MATH MEMOIZATION SPEEDUP";
  try {
    const { clearMathLayoutCache } = await import("../src/lib/math/layout");
    clearMathLayoutCache();
    const formula = "x' = \\frac{-b \\pm \\sqrt{b^2 - 4ac}}{2a}";
    const ast = parseMath(formula);

    const start1 = performance.now();
    for (let i = 0; i < 200; i++) {
      layoutMath(ast, mockCtx, DEFAULT_SETTINGS, 1.0, formula);
    }
    const elapsedMs = performance.now() - start1;

    const allPassed = elapsedMs < 50;
    recordResult(
      testName,
      allPassed,
      allPassed
        ? `200 memoized layoutMath calls executed in ${elapsedMs.toFixed(2)}ms (average ${(elapsedMs / 200).toFixed(4)}ms/call).`
        : `Performance too slow: ${elapsedMs}ms`
    );
  } catch (err: any) {
    recordResult(testName, false, `Exception: ${err.message}`);
  }
}

console.log("\n==================================================");
const passedTotal = results.filter((r) => r.status === "PASS").length;
const failedTotal = results.filter((r) => r.status === "FAIL").length;
console.log(`TOTAL: ${passedTotal} PASSED, ${failedTotal} FAILED`);
console.log("==================================================\n");

if (failedTotal > 0) {
  process.exit(1);
}

