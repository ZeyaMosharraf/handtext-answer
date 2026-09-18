/**
 * tests/test-mathblock-copy-paste.ts
 *
 * Verification suite for MathBlock Copy/Paste support.
 *
 * Tests:
 * 1. copy MathBlock: serializes semantic payload to custom MIME and text/plain fallback
 * 2. paste MathBlock: reconstructs valid MathBlock
 * 3. new unique ID: pasted block receives fresh stable ID, never reusing original ID
 * 4. multiple pastes: 3 pastes produce 3 distinct independent blocks with unique IDs
 * 5. edit pasted copy independently: modifying pasted formula does not touch original
 * 6. delete pasted copy independently: deleting pasted block keeps original intact
 * 7. paste at beginning: inserts before first block
 * 8. paste in middle: inserts between blocks
 * 9. paste at end: appends after last block
 * 10. multiple MathBlocks: multiple distinct formulas copied and pasted correctly
 * 11. serialization roundtrip: blocksToHtml -> htmlToBlocks preserves copied blocks and unique IDs
 * 12. persistence/restoration: simulates saving to draft/cloud and reloading
 * 13. normal text Ctrl+C/Ctrl+V regression: normal text clipboard data is never misidentified as math
 */

import {
  serializeMathBlockToClipboard,
  deserializeMathBlockFromClipboard,
  createPastedMathBlock,
  MATH_BLOCK_MIME_TYPE,
  type MathClipboardPayload,
} from "../src/lib/editor/mathClipboard";
import {
  createMathBlock,
  createEmptyTextBlock,
  type MathBlock,
  type DocumentBlock,
  type TextBlock,
} from "../src/types/document";
import {
  insertBlockOp,
  updateBlockOp,
  deleteBlockOp,
} from "../src/lib/editor/documentOperations";
import { blocksToHtml, htmlToBlocks } from "../src/lib/editor/blockSerialization";

let passed = 0;
let failed = 0;

function assert(condition: boolean, message: string) {
  if (condition) {
    console.log(`  ✓ ${message}`);
    passed++;
  } else {
    console.error(`  ✗ FAIL: ${message}`);
    failed++;
  }
}

function assertEquals<T>(actual: T, expected: T, message: string) {
  if (actual === expected) {
    console.log(`  ✓ ${message}`);
    passed++;
  } else {
    console.error(`  ✗ FAIL: ${message}`);
    console.error(`    Expected: ${JSON.stringify(expected)}`);
    console.error(`    Actual:   ${JSON.stringify(actual)}`);
    failed++;
  }
}

/** Mock DataTransfer implementation for Node environment */
class MockDataTransfer {
  private data: Map<string, string> = new Map();

  setData(format: string, data: string): void {
    this.data.set(format, data);
  }

  getData(format: string): string {
    return this.data.get(format) || "";
  }

  get types(): string[] {
    return Array.from(this.data.keys());
  }
}

console.log("\n=== 1. Copy MathBlock ===");
const originalBlock = createMathBlock("Z1 = X1 W11 + X2 W21", "Z_1 = X_1 W_{11} + X_2 W_{21}", "block");
const clipboard = new MockDataTransfer() as unknown as DataTransfer;

const payload = serializeMathBlockToClipboard(originalBlock, clipboard);
assert(payload.latex === "Z_1 = X_1 W_{11} + X_2 W_{21}", "Payload contains correct latex");
assert(payload.naturalExpr === "Z1 = X1 W11 + X2 W21", "Payload contains correct naturalExpr");
assert(clipboard.getData(MATH_BLOCK_MIME_TYPE).length > 0, "Custom MIME type is populated in clipboard");
assert(
  clipboard.getData("text/plain") === "Z1 = X1 W11 + X2 W21",
  "text/plain fallback contains human-readable formula, NOT raw JSON"
);

console.log("\n=== 2. Paste MathBlock ===");
const deserialized = deserializeMathBlockFromClipboard(clipboard);
assert(deserialized !== null, "Clipboard successfully deserialized into MathClipboardPayload");
assertEquals(deserialized?.type, "math", "Payload type is 'math'");
assertEquals(deserialized?.latex, "Z_1 = X_1 W_{11} + X_2 W_{21}", "Deserialized latex matches original");

console.log("\n=== 3. New Unique ID ===");
const pastedBlock = createPastedMathBlock(deserialized!);
assert(pastedBlock.id !== originalBlock.id, "Pasted block ID is DIFFERENT from original block ID");
assert(pastedBlock.id.startsWith("math_"), "Pasted block ID has 'math_' prefix");
assertEquals(pastedBlock.latex, originalBlock.latex, "Pasted block content is identical to original");
assertEquals(pastedBlock.naturalExpr, originalBlock.naturalExpr, "Pasted block naturalExpr is identical");

console.log("\n=== 4. Multiple Pastes ===");
const copy1 = createPastedMathBlock(deserialized!);
const copy2 = createPastedMathBlock(deserialized!);
const copy3 = createPastedMathBlock(deserialized!);

const allIds = new Set([originalBlock.id, copy1.id, copy2.id, copy3.id]);
assertEquals(allIds.size, 4, "All 4 blocks (Original, Copy-1, Copy-2, Copy-3) have globally unique IDs");

console.log("\n=== 5. Edit Pasted Copy Independently ===");
let doc: DocumentBlock[] = [originalBlock, copy1, copy2, copy3];

// Edit copy2 formula to "Z1 = -X1 + X2"
doc = updateBlockOp<MathBlock>(doc, copy2.id, {
  latex: "Z_1 = -X_1 + X_2",
  naturalExpr: "Z1 = -X1 + X2",
});

assertEquals((doc[0] as MathBlock).naturalExpr, "Z1 = X1 W11 + X2 W21", "Original formula remains unchanged");
assertEquals((doc[1] as MathBlock).naturalExpr, "Z1 = X1 W11 + X2 W21", "Copy-1 remains unchanged");
assertEquals((doc[2] as MathBlock).naturalExpr, "Z1 = -X1 + X2", "Copy-2 is updated to new formula");
assertEquals((doc[3] as MathBlock).naturalExpr, "Z1 = X1 W11 + X2 W21", "Copy-3 remains unchanged");

console.log("\n=== 6. Delete Pasted Copy Independently ===");
const deleteResult = deleteBlockOp(doc, copy2.id, null);
doc = deleteResult.blocks;
assertEquals(doc.length, 3, "Document has 3 blocks after deleting Copy-2");
assert(!doc.some((b) => b.id === copy2.id), "Copy-2 is completely removed");
assert(doc.some((b) => b.id === originalBlock.id), "Original block is preserved");
assert(doc.some((b) => b.id === copy1.id), "Copy-1 is preserved");
assert(doc.some((b) => b.id === copy3.id), "Copy-3 is preserved");

console.log("\n=== 7. Paste at Beginning of Document ===");
const t1: TextBlock = { id: "t1", type: "text", html: "<p>Paragraph 1</p>", createdAt: Date.now() };
const t2: TextBlock = { id: "t2", type: "text", html: "<p>Paragraph 2</p>", createdAt: Date.now() };
let mixedDoc: DocumentBlock[] = [t1, t2];

const pastedAtBeginning = createPastedMathBlock(deserialized!);
mixedDoc = insertBlockOp(mixedDoc, pastedAtBeginning, undefined, t1.id);
assertEquals(mixedDoc[0]?.id, pastedAtBeginning.id, "Pasted math block is at index 0 (beginning)");
assertEquals(mixedDoc[1]?.id, t1.id, "Paragraph 1 is now at index 1");
assertEquals(mixedDoc[2]?.id, t2.id, "Paragraph 2 is now at index 2");

console.log("\n=== 8. Paste in Middle of Document (between TextBlocks) ===");
const pastedInMiddle = createPastedMathBlock(deserialized!);
mixedDoc = insertBlockOp(mixedDoc, pastedInMiddle, t1.id);
assertEquals(mixedDoc[0]?.id, pastedAtBeginning.id, "Index 0 is first math block");
assertEquals(mixedDoc[1]?.id, t1.id, "Index 1 is Paragraph 1");
assertEquals(mixedDoc[2]?.id, pastedInMiddle.id, "Index 2 is pasted math block in middle");
assertEquals(mixedDoc[3]?.id, t2.id, "Index 3 is Paragraph 2");

console.log("\n=== 9. Paste at End of Document ===");
const pastedAtEnd = createPastedMathBlock(deserialized!);
mixedDoc = insertBlockOp(mixedDoc, pastedAtEnd, t2.id);
assertEquals(mixedDoc[mixedDoc.length - 1]?.id, pastedAtEnd.id, "Pasted math block is at the end of document");

console.log("\n=== 10. Multiple MathBlocks Copy/Paste ===");
const mb1 = createMathBlock("E = mc^2", "E = mc^{2}", "block");
const mb2 = createMathBlock("F = ma", "F = ma", "block");

const clip1 = new MockDataTransfer() as unknown as DataTransfer;
serializeMathBlockToClipboard(mb1, clip1);
const parsed1 = deserializeMathBlockFromClipboard(clip1)!;
const copyMb1 = createPastedMathBlock(parsed1);

const clip2 = new MockDataTransfer() as unknown as DataTransfer;
serializeMathBlockToClipboard(mb2, clip2);
const parsed2 = deserializeMathBlockFromClipboard(clip2)!;
const copyMb2 = createPastedMathBlock(parsed2);

assertEquals(copyMb1.naturalExpr, "E = mc^2", "Copy of mb1 preserved content");
assertEquals(copyMb2.naturalExpr, "F = ma", "Copy of mb2 preserved content");
assert(copyMb1.id !== mb1.id && copyMb2.id !== mb2.id, "Both copies have distinct new IDs");

console.log("\n=== 11. Serialization Roundtrip ===");
const roundtripDoc: DocumentBlock[] = [
  t1,
  originalBlock,
  t2,
  pastedBlock,
];

const htmlOutput = blocksToHtml(roundtripDoc);
assert(htmlOutput.includes(`data-block-id="${originalBlock.id}"`), "HTML includes originalBlock ID");
assert(htmlOutput.includes(`data-block-id="${pastedBlock.id}"`), "HTML includes pastedBlock ID");

const restoredBlocks = htmlToBlocks(htmlOutput);
assertEquals(restoredBlocks.length, 4, "4 blocks restored from HTML");
assertEquals(restoredBlocks[0]?.id, t1.id, "Block 0 ID restored");
assertEquals(restoredBlocks[1]?.id, originalBlock.id, "Block 1 ID restored");
assertEquals(restoredBlocks[2]?.id, t2.id, "Block 2 ID restored");
assertEquals(restoredBlocks[3]?.id, pastedBlock.id, "Block 3 ID restored");
assertEquals((restoredBlocks[1] as MathBlock).latex, (roundtripDoc[1] as MathBlock).latex, "Original latex restored");
assertEquals((restoredBlocks[3] as MathBlock).latex, (roundtripDoc[3] as MathBlock).latex, "Pasted latex restored");

console.log("\n=== 12. Persistence / Restoration Simulation ===");
// Simulate updating one block, serializing, and restoring
const editedDoc = updateBlockOp<MathBlock>(restoredBlocks, pastedBlock.id, {
  latex: "\\alpha + \\beta",
  naturalExpr: "alpha + beta",
});
const savedHtml = blocksToHtml(editedDoc);
const reloadedDoc = htmlToBlocks(savedHtml);

assertEquals((reloadedDoc[1] as MathBlock).naturalExpr, "Z1 = X1 W11 + X2 W21", "Original persisted intact");
assertEquals((reloadedDoc[3] as MathBlock).naturalExpr, "alpha + beta", "Pasted edit persisted intact");

console.log("\n=== 13. Normal Text Ctrl+C/Ctrl+V Regression ===");
const normalTextClipboard = new MockDataTransfer() as unknown as DataTransfer;
normalTextClipboard.setData("text/plain", "This is just a normal sentence copied by the user.");

const mathFromNormalText = deserializeMathBlockFromClipboard(normalTextClipboard);
assert(mathFromNormalText === null, "Normal plain text is NOT misidentified as a MathBlock");

const richTextClipboard = new MockDataTransfer() as unknown as DataTransfer;
richTextClipboard.setData("text/plain", "Hello world");
richTextClipboard.setData("text/html", "<p>Hello <strong>world</strong></p>");

const mathFromRichText = deserializeMathBlockFromClipboard(richTextClipboard);
assert(mathFromRichText === null, "Normal rich text HTML is NOT misidentified as a MathBlock");

console.log("\n══════════════════════════════════════════════════");
console.log(`Results: ${passed} passed, ${failed} failed.`);
if (failed > 0) {
  process.exit(1);
} else {
  console.log("All 13 MathBlock Copy/Paste Test Suites Passed! ✓\n");
}
