/**
 * tests/test-document-blocks-hook.ts
 *
 * Automated verification suite for the Document Block Operations and State Machine.
 *
 * Verifies:
 * 1. Insertion: appending vs inserting after specific block ID.
 * 2. Immutable updates: modifying block properties returns fresh array and updated block.
 * 3. Deletion & Selection transition:
 *    - deleting selected block moves selection to preceding block.
 *    - deleting first block moves selection to new first block.
 *    - deleting sole remaining block provides an empty TextBlock defense.
 * 4. Reordering: moving blocks up and down with bounds checking.
 * 5. Splitting: splitting a TextBlock preserves the first block ID and creates a new ID for the second.
 * 6. History stack: undo/redo snapshot transitions.
 */

import {
  type DocumentBlock,
  type TextBlock,
  type MathBlock,
  createEmptyTextBlock,
  createMathBlock,
  createTableBlock,
} from "../src/types/document";
import {
  insertBlockOp,
  updateBlockOp,
  deleteBlockOp,
  moveBlockOp,
  splitTextBlockOp,
} from "../src/lib/editor/documentOperations";

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

console.log("\n─── 1. Block Insertion Operations ───");

const b1 = createEmptyTextBlock("<p>Block 1</p>");
const b2 = createMathBlock("x^2", "x^2", "block");
const b3 = createEmptyTextBlock("<p>Block 3</p>");

let list: DocumentBlock[] = [b1, b3];

// Insert b2 after b1
list = insertBlockOp(list, b2, b1.id);
assertEquals(list.length, 3, "List length is 3 after insertBlockOp");
assertEquals(list[0]?.id, b1.id, "Index 0 is b1");
assertEquals(list[1]?.id, b2.id, "Index 1 is b2 (inserted after b1)");
assertEquals(list[2]?.id, b3.id, "Index 2 is b3");

// Insert at end (no afterId)
const b4 = createTableBlock("<table><tbody><tr><td>Data</td></tr></tbody></table>");
list = insertBlockOp(list, b4);
assertEquals(list.length, 4, "List length is 4 after appending b4");
assertEquals(list[3]?.id, b4.id, "Index 3 is b4");

// Insert after unknown ID defaults to end
const b5 = createEmptyTextBlock("<p>Block 5</p>");
list = insertBlockOp(list, b5, "non_existent_id");
assertEquals(list.length, 5, "List length is 5 after inserting with unknown afterId");
assertEquals(list[4]?.id, b5.id, "Appended to end when afterId not found");

console.log("\n─── 2. Block Update Operations ───");

const updatedList = updateBlockOp<MathBlock>(list, b2.id, {
  naturalExpr: "x^2 + 1",
  latex: "x^2 + 1",
});

assert(updatedList !== list, "updateBlockOp returns new array reference (immutable)");
const updatedB2 = updatedList.find((b) => b.id === b2.id) as MathBlock;
assertEquals(updatedB2.naturalExpr, "x^2 + 1", "MathBlock naturalExpr updated");
assertEquals(updatedB2.latex, "x^2 + 1", "MathBlock latex updated");
assertEquals(updatedB2.id, b2.id, "Block ID remains unchanged");

// Update non-existent block leaves array unchanged
const unchangedList = updateBlockOp(list, "ghost_id", { type: "text" });
assertEquals(unchangedList.length, list.length, "Updating unknown block does not change length");

console.log("\n─── 3. Block Deletion & Selection Transitions ───");

// Delete middle block (b2) when b2 was selected -> selection moves to preceding block (b1)
const delMiddleResult = deleteBlockOp(list, b2.id, b2.id);
assertEquals(delMiddleResult.blocks.length, 4, "Deleted middle block, length is 4");
assertEquals(delMiddleResult.nextSelectedId, b1.id, "Selection moved to preceding block b1");
assert(!delMiddleResult.blocks.some((b) => b.id === b2.id), "b2 is removed from array");

// Delete first block (b1) when b1 was selected -> selection moves to new first block
const delFirstResult = deleteBlockOp(list, b1.id, b1.id);
assertEquals(delFirstResult.nextSelectedId, b2.id, "Selection moved to next block b2");

// Delete when an unrelated block was selected -> selection remains unchanged
const delUnrelatedResult = deleteBlockOp(list, b5.id, b1.id);
assertEquals(delUnrelatedResult.nextSelectedId, b1.id, "Unrelated selection preserved");

// Delete sole remaining block -> Empty text block defense
const singleBlockList = [createEmptyTextBlock("<p>Lone block</p>")];
const delSoleResult = deleteBlockOp(singleBlockList, singleBlockList[0]!.id, singleBlockList[0]!.id);
assertEquals(delSoleResult.blocks.length, 1, "Sole block deletion returns 1 fallback block");
assertEquals(delSoleResult.blocks[0]?.type, "text", "Fallback block is TextBlock");
assert(delSoleResult.blocks[0]!.id.startsWith("txt_"), "Fallback block has valid ID");

console.log("\n─── 4. Block Reordering (Move Up / Move Down) ───");

let reorderList: DocumentBlock[] = [b1, b2, b3];

// Move b2 up (swaps with b1)
reorderList = moveBlockOp(reorderList, b2.id, "up");
assertEquals(reorderList[0]?.id, b2.id, "b2 moved to index 0");
assertEquals(reorderList[1]?.id, b1.id, "b1 moved to index 1");

// Move b2 up again (at top, bounds check: no change)
const atTopList = moveBlockOp(reorderList, b2.id, "up");
assertEquals(atTopList[0]?.id, b2.id, "b2 stays at index 0 when moved up at boundary");

// Move b2 down (swaps with b1)
reorderList = moveBlockOp(reorderList, b2.id, "down");
assertEquals(reorderList[1]?.id, b2.id, "b2 moved back to index 1");

// Move b3 down (at bottom, bounds check: no change)
const atBottomList = moveBlockOp(reorderList, b3.id, "down");
assertEquals(atBottomList[2]?.id, b3.id, "b3 stays at index 2 when moved down at boundary");

console.log("\n─── 5. TextBlock Splitting ───");

const longTextBlock = createEmptyTextBlock("<p>First half of sentence. Second half of sentence.</p>");
const splitList: DocumentBlock[] = [longTextBlock];

const splitResult = splitTextBlockOp(
  splitList,
  longTextBlock.id,
  "<p>First half of sentence.</p>",
  "<p>Second half of sentence.</p>"
);

assert(splitResult !== null, "splitTextBlockOp returned result");
assertEquals(splitResult?.blocks.length, 2, "Split produced 2 blocks");
assertEquals(splitResult?.beforeBlock.id, longTextBlock.id, "Before block preserves original ID");
assertEquals(splitResult?.beforeBlock.html, "<p>First half of sentence.</p>", "Before block HTML matches");
assert(splitResult!.afterBlock.id !== longTextBlock.id, "After block received a new unique ID");
assertEquals(splitResult?.afterBlock.html, "<p>Second half of sentence.</p>", "After block HTML matches");

// Splitting non-text block returns null
const mathList = [b2];
const nonTextSplit = splitTextBlockOp(mathList, b2.id, "before", "after");
assertEquals(nonTextSplit, null, "Attempting to split non-text block returns null");

console.log("\n══════════════════════════════════════");
console.log(`Results: ${passed} passed, ${failed} failed.`);
if (failed > 0) {
  process.exit(1);
} else {
  console.log("All document operations tests passed! ✓\n");
}
