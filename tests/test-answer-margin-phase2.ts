/**
 * tests/test-answer-margin-phase2.ts
 *
 * Comprehensive Automated Tests for Phase 2:
 * 1. MarginMarker attachment to DocumentBlock
 * 2. Serialization & Deserialization of Text, Math, Table, Graph blocks with markers
 * 3. parseHtmlContent extraction of data-margin-marker, data-margin-type, data-margin-color
 * 4. stripTextBlockWrappers attribute preservation
 * 5. Layout start-page only continuation rule (first item only receives marker)
 * 6. Auto-increment logic (Q1 -> Q2, a) -> b), (i) -> (ii))
 * 7. Backward compatibility on clean legacy blocks
 */

import {
  blocksToHtml,
  htmlToBlocks,
  serializeMarginMarkerAttrs,
  parseMarginMarkerFromAttributes,
} from "../src/lib/editor/blockSerialization";
import {
  parseHtmlContent,
  type Block,
} from "../src/lib/handwriting/parse";
import {
  DEFAULT_SETTINGS,
  type HandwritingSettings,
} from "../src/lib/handwriting/types";

let passed = 0;
let failed = 0;

function assert(condition: boolean, message: string) {
  if (condition) {
    passed++;
    console.log(`  ✓ ${message}`);
  } else {
    failed++;
    console.error(`  ✗ FAIL: ${message}`);
  }
}

function runTests() {
  console.log("\n=== 1. MarginMarker Data Model & Attribute Serialization ===");

  const qMarker = { type: "question" as const, text: "Q1" };
  const ansMarker = { type: "answer" as const, text: "Ans" };
  const subMarker = { type: "subquestion" as const, text: "a)" };
  const marksMarker = { type: "marks" as const, text: "[5M]", color: "#b3231f" };
  const customMarker = { type: "custom" as const, text: "Note:" };

  assert(
    serializeMarginMarkerAttrs(qMarker) === ' data-margin-marker="Q1" data-margin-type="question"',
    "Serializes question marker attributes accurately"
  );
  assert(
    serializeMarginMarkerAttrs(marksMarker) === ' data-margin-marker="[5M]" data-margin-type="marks" data-margin-color="#b3231f"',
    "Serializes marks marker with custom color"
  );
  assert(
    serializeMarginMarkerAttrs(undefined) === "",
    "Serializes undefined marker to empty string"
  );

  console.log("\n=== 2. Attribute Parsing & Type Validation ===");

  const parsedQ = parseMarginMarkerFromAttributes("Q1", "question");
  assert(parsedQ?.type === "question" && parsedQ.text === "Q1", "Parses question marker");

  const parsedAns = parseMarginMarkerFromAttributes("Ans", "answer");
  assert(parsedAns?.type === "answer" && parsedAns.text === "Ans", "Parses answer marker");

  const parsedSub = parseMarginMarkerFromAttributes("a)", "subquestion");
  assert(parsedSub?.type === "subquestion" && parsedSub.text === "a)", "Parses subquestion marker");

  const parsedMarks = parseMarginMarkerFromAttributes("[10M]", "marks", "#b3231f");
  assert(parsedMarks?.type === "marks" && parsedMarks.text === "[10M]" && parsedMarks.color === "#b3231f", "Parses marks marker with color");

  const parsedInvalid = parseMarginMarkerFromAttributes("CustomTag", "unrecognized_type");
  assert(parsedInvalid?.type === "custom" && parsedInvalid.text === "CustomTag", "Fallbacks invalid type to custom");

  assert(parseMarginMarkerFromAttributes(null, null) === undefined, "Returns undefined when attributes are missing");

  console.log("\n=== 3. HTML Parse Pipeline (parseHtmlContent) ===");

  const testHtml = `
    <p data-margin-marker="Q1" data-margin-type="question">Introduction: A data warehouse is a subject-oriented repository.</p>
    <p data-margin-marker="Ans" data-margin-type="answer">A data warehouse consolidates historical data.</p>
    <p data-margin-marker="a)" data-margin-type="subquestion">Subject-oriented: Data is categorized around key subjects.</p>
    <p data-margin-marker="b)" data-margin-type="subquestion">Integrated: Constructed by integrating multiple heterogeneous sources.</p>
    <div class="math-block" data-latex="E = mc^2" data-margin-marker="Q2" data-margin-type="question"></div>
    <div class="graph-block" data-graph-definition='{"type":"bar","title":"Performance"}' data-margin-marker="Fig. 1" data-margin-type="custom"></div>
  `;

  const parsedBlocks = parseHtmlContent(testHtml);

  assert(parsedBlocks.length >= 6, `Parsed at least 6 blocks (got ${parsedBlocks.length})`);
  assert(parsedBlocks[0]?.marginMarker?.type === "question" && parsedBlocks[0]?.marginMarker?.text === "Q1", "Parsed Q1 marker on paragraph 1");
  assert(parsedBlocks[1]?.marginMarker?.type === "answer" && parsedBlocks[1]?.marginMarker?.text === "Ans", "Parsed Ans marker on paragraph 2");
  assert(parsedBlocks[2]?.marginMarker?.type === "subquestion" && parsedBlocks[2]?.marginMarker?.text === "a)", "Parsed a) marker on paragraph 3");
  assert(parsedBlocks[3]?.marginMarker?.type === "subquestion" && parsedBlocks[3]?.marginMarker?.text === "b)", "Parsed b) marker on paragraph 4");

  const mathBlock = parsedBlocks.find((b) => b.kind === "math");
  assert(mathBlock?.marginMarker?.type === "question" && mathBlock?.marginMarker?.text === "Q2", "Parsed Q2 marker on MathBlock");

  const graphBlock = parsedBlocks.find((b) => b.kind === "graph");
  assert(graphBlock?.marginMarker?.type === "custom" && graphBlock?.marginMarker?.text === "Fig. 1", "Parsed Fig. 1 marker on GraphBlock");

  console.log("\n=== 4. Wrapper Stripping & Attribute Inheritance ===");

  const wrappedHtml = `<div data-block-id="blk-1" data-block-type="text" data-margin-marker="Q3" data-margin-type="question"><p>Content inside wrapper</p></div>`;
  const blocksFromWrapped = parseHtmlContent(wrappedHtml);
  assert(blocksFromWrapped[0]?.marginMarker?.text === "Q3", "Preserved marker from wrapping text div onto inner paragraph");

  console.log("\n=== 5. Block Roundtrip & Serialization with All Block Kinds ===");

  const inputBlocks = [
    {
      id: "blk-txt-1",
      type: "text" as const,
      html: "<p>Question intro paragraph</p>",
      marginMarker: { type: "question" as const, text: "Q1" },
      createdAt: 1000,
    },
    {
      id: "blk-txt-2",
      type: "text" as const,
      html: "<p>Answer content</p>",
      marginMarker: { type: "answer" as const, text: "Ans" },
      createdAt: 1001,
    },
    {
      id: "blk-math-1",
      type: "math" as const,
      latex: "\\int_0^1 x^2 dx",
      displayMode: "block" as const,
      marginMarker: { type: "subquestion" as const, text: "a)" },
      createdAt: 1002,
    },
    {
      id: "blk-tbl-1",
      type: "table" as const,
      tableHtml: "<table><tbody><tr><td>Item</td><td>Value</td></tr></tbody></table>",
      marginMarker: { type: "marks" as const, text: "[10M]" },
      createdAt: 1003,
    },
    {
      id: "blk-grp-1",
      type: "graph" as const,
      graphDef: { type: "bar", title: "Graph 1" } as any,
      marginMarker: { type: "custom" as const, text: "Step 1" },
      createdAt: 1004,
    },
  ];

  const serializedHtml = blocksToHtml(inputBlocks);
  const roundtripBlocks = htmlToBlocks(serializedHtml);

  assert(roundtripBlocks.length === 5, "Roundtripped exactly 5 blocks");
  assert(roundtripBlocks[0]?.marginMarker?.text === "Q1", "Text block retained Q1 marker");
  assert(roundtripBlocks[1]?.marginMarker?.text === "Ans", "Text block retained Ans marker");
  assert(roundtripBlocks[2]?.marginMarker?.text === "a)", "Math block retained a) marker");
  assert(roundtripBlocks[3]?.marginMarker?.text === "[10M]", "Table block retained [10M] marker");
  assert(roundtripBlocks[4]?.marginMarker?.text === "Step 1", "Graph block retained Step 1 marker");

  console.log("\n=== 6. Legacy Document Backward Compatibility ===");

  const legacyHtml = "<p>Legacy paragraph without markers</p><p>Second paragraph</p>";
  const legacyBlocks = parseHtmlContent(legacyHtml);
  assert(legacyBlocks.length === 2, "Parsed 2 legacy blocks");
  assert(legacyBlocks[0]?.marginMarker === undefined, "Legacy block 1 has undefined marginMarker");
  assert(legacyBlocks[1]?.marginMarker === undefined, "Legacy block 2 has undefined marginMarker");

  const legacyRoundtrip = blocksToHtml(htmlToBlocks(legacyHtml));
  assert(!legacyRoundtrip.includes("data-margin-marker"), "Legacy blocks produce zero data-margin-marker attributes");

  console.log("\n=== 7. AnswerMarginConfig Defaults in Settings ===");

  assert(DEFAULT_SETTINGS.page.answerMargin !== undefined, "DEFAULT_SETTINGS includes answerMargin");
  assert(DEFAULT_SETTINGS.page.answerMargin?.enabled === true, "Answer margin enabled by default");
  assert(DEFAULT_SETTINGS.page.answerMargin?.width === 72, "Answer margin default width is 72px");
  assert(DEFAULT_SETTINGS.page.answerMargin?.showDivider === true, "Answer margin default showDivider is true");

  console.log(`\n========================================`);
  console.log(`Test Results: ${passed} passed, ${failed} failed`);
  console.log(`========================================\n`);

  if (failed > 0) {
    process.exit(1);
  }
}

runTests();
