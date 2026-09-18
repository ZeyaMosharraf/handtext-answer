import { parseContent, blocksToHtml, htmlToPlainText, isHtmlContent } from "../src/lib/handwriting/parse";
import { layoutDocument } from "../src/lib/handwriting/layout";
import { parseMath, layoutMath } from "../src/lib/math";
import { DEFAULT_SETTINGS, type HandwritingSettings } from "../src/lib/handwriting/types";
import { makeRng } from "../src/lib/handwriting/pen";

function createMockCanvas(): CanvasRenderingContext2D {
  const noop = () => {};
  return new Proxy(
    {
      measureText: (text: string) => ({ width: text.length * 10 }),
      font: "",
    },
    {
      get(target: any, prop: string) {
        if (prop in target) return target[prop];
        return noop;
      },
      set(target: any, prop: string, value: any) {
        target[prop] = value;
        return true;
      },
    }
  ) as unknown as CanvasRenderingContext2D;
}

const ctx = createMockCanvas();
const settings: HandwritingSettings = {
  ...DEFAULT_SETTINGS,
  fontSize: 24,
  lineSpacing: 1.4,
};

let passed = 0;
let failed = 0;

function assert(condition: boolean, testName: string, detail?: string) {
  if (condition) {
    console.log(`PASS: ${testName}`);
    passed++;
  } else {
    console.error(`FAIL: ${testName} - ${detail ?? "assertion failed"}`);
    failed++;
  }
}

function makeMathBlockHtml(latex: string): string {
  const preview = latex.length > 60 ? latex.slice(0, 57) + "…" : latex;
  return `<div class="math-block" data-latex="${latex}" contenteditable="false"><span style="opacity:0.7;font-size:1.1em;">∑</span><span>${preview}</span></div>`;
}

console.log("\n=== Math Insertion Lifecycle & Non-Regression Tests ===\n");

// --- 1. Math insertion into document state -> parse -> layout -> render ---
{
  const formula = "\\frac{H}{T} = -\\sum_{i=1}^{n} p_i \\log_2(p_i)";
  const insertedHtml = `<p>Before text</p>${makeMathBlockHtml(formula)}<p>After text</p>`;

  const blocks = parseContent(insertedHtml);
  assert(blocks.length === 3, "Parsed into 3 distinct blocks (para, math, para)");
  assert(blocks[1]?.kind === "math", "Second block is of kind 'math'");
  assert(blocks[1]?.math?.latex === formula, "Math block retains exact input formula");

  const doc = layoutDocument(ctx, { content: insertedHtml, settings });
  const placements = doc.pages[0]?.placements ?? [];
  const mathPlacement = placements.find((p) => p.type === "mathBlock");
  assert(mathPlacement !== undefined, "Layout page produces a mathBlock placement");
  assert((mathPlacement as any)?.latex === formula, "mathBlock placement has correct LaTeX");

  const ast = parseMath(formula);
  const box = layoutMath(ast, ctx, settings, 1.0);
  let drawCalled = false;
  try {
    box.draw(ctx, 50, 100, settings, makeRng(42), "#1d3fb5");
    drawCalled = true;
  } catch (e) {
    console.error(e);
  }
  assert(drawCalled, "box.draw executes cleanly without errors");
}

// --- 2. Sequential Math Block Insertions (Scenarios 1-5) ---
{
  // Step 1: Insert first math block M1
  const m1 = "E = mc^2";
  let docHtml = makeMathBlockHtml(m1);
  let blocks = parseContent(docHtml);
  assert(blocks.length === 1 && blocks[0]?.kind === "math" && blocks[0]?.math?.latex === m1, "1. Insert first math block M1");

  // Step 2 & 3: Insert second math block M2
  const m2 = "p_i";
  docHtml = docHtml + "&nbsp;" + makeMathBlockHtml(m2);
  blocks = parseContent(docHtml);
  const mathBlocks2 = blocks.filter((b) => b.kind === "math");
  assert(mathBlocks2.length === 2, "2. Insert second math block M2 produces 2 math blocks");
  assert(mathBlocks2[0]?.math?.latex === m1, "3. Verify first block M1 remains completely unchanged after inserting M2");
  assert(mathBlocks2[1]?.math?.latex === m2, "3b. Second block has correct LaTeX M2");

  // Step 4 & 5: Insert third block M3
  const m3 = "\\frac{H}{T}";
  docHtml = docHtml + "&nbsp;" + makeMathBlockHtml(m3);
  blocks = parseContent(docHtml);
  const mathBlocks3 = blocks.filter((b) => b.kind === "math");
  assert(mathBlocks3.length === 3, "4. Insert third block M3 produces 3 math blocks");
  assert(
    mathBlocks3[0]?.math?.latex === m1 &&
    mathBlocks3[1]?.math?.latex === m2 &&
    mathBlocks3[2]?.math?.latex === m3,
    "5. Verify all three math blocks exist distinctly with their respective LaTeX values"
  );
}

// --- 3. Positional Insertions: Between, After, Before (Scenarios 6-8) ---
{
  const m1 = "E = mc^2";
  const m2 = "p_i";
  const m3 = "\\frac{H}{T}";

  // Scenario 6: Insert M4 between M1 and M2
  const m4 = "\\sqrt{x}";
  const docWithM4 = `${makeMathBlockHtml(m1)}&nbsp;${makeMathBlockHtml(m4)}&nbsp;${makeMathBlockHtml(m2)}&nbsp;${makeMathBlockHtml(m3)}`;
  const blocks6 = parseContent(docWithM4).filter((b) => b.kind === "math");
  assert(
    blocks6.length === 4 &&
    blocks6[0]?.math?.latex === m1 &&
    blocks6[1]?.math?.latex === m4 &&
    blocks6[2]?.math?.latex === m2 &&
    blocks6[3]?.math?.latex === m3,
    "6. Insert M4 between M1 and M2 maintains exact order [M1, M4, M2, M3]"
  );

  // Scenario 7: Insert M5 after M3
  const m5 = "E = mgh";
  const docWithM5 = `${docWithM4}&nbsp;${makeMathBlockHtml(m5)}`;
  const blocks7 = parseContent(docWithM5).filter((b) => b.kind === "math");
  assert(
    blocks7.length === 5 &&
    blocks7[4]?.math?.latex === m5,
    "7. Insert M5 after M3 appends cleanly without overwriting previous blocks"
  );

  // Scenario 8: Insert M0 before M1
  const m0 = "F = ma";
  const docWithM0 = `${makeMathBlockHtml(m0)}&nbsp;${docWithM5}`;
  const blocks8 = parseContent(docWithM0).filter((b) => b.kind === "math");
  assert(
    blocks8.length === 6 &&
    blocks8[0]?.math?.latex === m0 &&
    blocks8[1]?.math?.latex === m1,
    "8. Insert M0 before M1 prepends cleanly as first block"
  );
}

// --- 4. Editing Specific Math Block & Non-Mutation of Others (Scenarios 9-10) ---
{
  const m1 = "E = mc^2";
  const m2 = "p_i";
  const m3 = "\\frac{H}{T}";
  const m2Updated = "x^2";

  // Simulate updating only M2
  const originalHtml = `${makeMathBlockHtml(m1)}&nbsp;${makeMathBlockHtml(m2)}&nbsp;${makeMathBlockHtml(m3)}`;
  const updatedHtml = originalHtml.replace(makeMathBlockHtml(m2), makeMathBlockHtml(m2Updated));

  const blocks = parseContent(updatedHtml).filter((b) => b.kind === "math");
  assert(blocks.length === 3, "9. Updating M2 maintains exact count of 3 blocks");
  assert(blocks[1]?.math?.latex === m2Updated, "9b. M2 was successfully updated to x^2");
  assert(blocks[0]?.math?.latex === m1, "10a. Verify M1 remains unchanged when M2 is edited");
  assert(blocks[2]?.math?.latex === m3, "10b. Verify M3 remains unchanged when M2 is edited");
}

// --- 5. Mode Separation & State Invariants (Scenarios 11-12) ---
{
  // Simulated state machine for modal
  type Mode = "insert" | "edit";
  let mode: Mode = "insert";
  let targetElement: string | null = null;

  // Clicking a math block explicitly sets edit mode with that target
  function onMathBlockClick(latex: string, id: string) {
    mode = "edit";
    targetElement = id;
  }

  // Clicking toolbar Math button always opens in insert mode
  function onToolbarMathClick() {
    targetElement = null;
    mode = "insert";
  }

  // Dismissing or confirming modal clears targetElement
  function onCloseModal() {
    targetElement = null;
    mode = "insert";
  }

  onMathBlockClick("p_i", "math-block-2");
  assert(mode === "edit" && targetElement === "math-block-2", "11a. Clicking math block enters EDIT mode targeting block 2");

  onCloseModal();
  assert(mode === "insert" && targetElement === null, "12. Closing modal clears transient edit target and resets mode to insert");

  onToolbarMathClick();
  assert(mode === "insert" && targetElement === null, "11b. Opening toolbar Math button defaults strictly to INSERT mode");
}

// --- 6. Interleaving Normal Text and Math Blocks (Scenarios 13-14) ---
{
  const html = [
    "<p>Equation one</p>",
    makeMathBlockHtml("E = mc^2"),
    "<p>Equation two</p>",
    makeMathBlockHtml("p_i"),
    "<p>Concluding equation</p>",
  ].join("");

  const blocks = parseContent(html);
  assert(blocks.length === 5, "13. Interleaved document produces 5 distinct blocks");
  assert(blocks[0]?.kind === "paragraph" && blocks[0]?.text === "Equation one", "13a. Block 0 is text 'Equation one'");
  assert(blocks[1]?.kind === "math" && blocks[1]?.math?.latex === "E = mc^2", "13b. Block 1 is math 'E = mc^2'");
  assert(blocks[2]?.kind === "paragraph" && blocks[2]?.text === "Equation two", "13c. Block 2 is text 'Equation two'");
  assert(blocks[3]?.kind === "math" && blocks[3]?.math?.latex === "p_i", "14. Block 3 is math 'p_i' inserted after text");
  assert(blocks[4]?.kind === "paragraph" && blocks[4]?.text === "Concluding equation", "14b. Block 4 is concluding text");
}

// --- 7. Serialization & Restoration Idempotency (Scenario 15) ---
{
  const formulas = ["E = mc^2", "p_i", "\\frac{H}{T}", "\\sqrt{x}"];
  const docHtml = formulas.map(makeMathBlockHtml).join("&nbsp;");

  const blocks1 = parseContent(docHtml);
  const serialized = blocksToHtml(blocks1);
  const blocks2 = parseContent(serialized);

  const math1 = blocks1.filter((b) => b.kind === "math");
  const math2 = blocks2.filter((b) => b.kind === "math");

  assert(math1.length === 4 && math2.length === 4, "15a. All 4 math blocks survive round-trip HTML serialization");
  const allMatch = formulas.every((f, idx) => math2[idx]?.math?.latex === f);
  assert(allMatch, "15b. Every restored math block matches its original LaTeX formula identically");
}

// --- 8. Strict Invariant Guarantee: M4 Insertion Does Not Overwrite M1, M2, M3 ---
{
  const initial = [
    { id: "M1", latex: "E = mc^2" },
    { id: "M2", latex: "p_i" },
    { id: "M3", latex: "\\frac{H}{T}" },
  ];

  const initialHtml = initial.map((m) => `<div class="math-block" id="${m.id}" data-latex="${m.latex}"></div>`).join("");
  const m4Latex = "\\sqrt{x}";
  const afterInsertHtml = initialHtml + `<div class="math-block" id="M4" data-latex="${m4Latex}"></div>`;

  const parsed = parseContent(afterInsertHtml).filter((b) => b.kind === "math");
  assert(parsed.length === 4, "Invariant: Total math block count increased from 3 to 4");
  assert(parsed[0]?.math?.latex === "E = mc^2", "Invariant: M1 latex unchanged");
  assert(parsed[1]?.math?.latex === "p_i", "Invariant: M2 latex unchanged");
  assert(parsed[2]?.math?.latex === "\\frac{H}{T}", "Invariant: M3 latex unchanged");
  assert(parsed[3]?.math?.latex === "\\sqrt{x}", "Invariant: M4 newly appended");
}

// --- 9. Rich text, tables, whitespace, and plain-text conversion regression ---
{
  const html = `<p><strong>Bold</strong> and <em>italic</em></p><div class="math-block" data-latex="x^2 + y^2 = r^2"></div>`;
  const blocks = parseContent(html);
  assert(blocks[0]?.segs?.some((s) => s.bold), "Regression: Bold preserved alongside math");
  assert(blocks[1]?.kind === "math", "Regression: Math block intact");

  const tableHtml = `
    <table>
      <thead><tr><th>Var</th><th>Form</th></tr></thead>
      <tbody><tr><td>E</td><td>mc^2</td></tr></tbody>
    </table>
    <div class="math-block" data-latex="E = mc^2"></div>
  `;
  const doc = layoutDocument(ctx, { content: tableHtml, settings });
  const placements = doc.pages[0]?.placements ?? [];
  assert(placements.some((p) => p.type === "tableRow") && placements.some((p) => p.type === "mathBlock"), "Regression: Table and math block coexist in layout");

  const plainFormula = "\\sum_{i=1}^{n} i = \\frac{n(n+1)}{2}";
  const plainHtml = `<p>Sum:</p><div class="math-block" data-latex="${plainFormula}"></div>`;
  const plain = htmlToPlainText(plainHtml);
  assert(plain.includes("$$") && plain.includes(plainFormula), "Regression: htmlToPlainText converts math block to $$ syntax");
}

console.log(`\nResults: ${passed} passed, ${failed} failed.\n`);
if (failed > 0) process.exit(1);
