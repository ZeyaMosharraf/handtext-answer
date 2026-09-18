/**
 * src/lib/editor/documentOperations.ts
 *
 * Pure, functional state machine operations for DocumentBlock[].
 * Used by useDocumentBlocks hook and testable in pure TypeScript.
 *
 * Architectural Invariants:
 * 1. Immutable transformations — always returns new array instances without mutating inputs.
 * 2. Stable block IDs are preserved through all transformations.
 * 3. Empty document defense: deleting the last block returns a single empty TextBlock.
 * 4. Zero DOM or browser dependencies.
 */

import {
  type DocumentBlock,
  type TextBlock,
  createEmptyTextBlock,
  generateBlockId,
} from "../../types/document";

/**
 * Inserts a block immediately after `afterId`, or before `beforeId`, or at the end of the array if neither is specified.
 */
export function insertBlockOp(
  blocks: DocumentBlock[],
  newBlock: DocumentBlock,
  afterId?: string | null,
  beforeId?: string | null
): DocumentBlock[] {
  let insertIndex = blocks.length;

  if (beforeId) {
    const foundIdx = blocks.findIndex((b) => b.id === beforeId);
    if (foundIdx !== -1) {
      insertIndex = foundIdx;
    }
  } else if (afterId) {
    const foundIdx = blocks.findIndex((b) => b.id === afterId);
    if (foundIdx !== -1) {
      insertIndex = foundIdx + 1;
    }
  }

  return [
    ...blocks.slice(0, insertIndex),
    newBlock,
    ...blocks.slice(insertIndex),
  ];
}

/**
 * Updates a block by ID immutably.
 */
export function updateBlockOp<T extends DocumentBlock>(
  blocks: DocumentBlock[],
  id: string,
  updates: Partial<T>
): DocumentBlock[] {
  const idx = blocks.findIndex((b) => b.id === id);
  if (idx === -1) return blocks;

  const updated = {
    ...blocks[idx],
    ...updates,
  } as DocumentBlock;

  return [...blocks.slice(0, idx), updated, ...blocks.slice(idx + 1)];
}

export interface DeleteBlockResult {
  blocks: DocumentBlock[];
  nextSelectedId: string | null;
}

/**
 * Deletes a block by ID immutably and computes the next selected block ID.
 */
export function deleteBlockOp(
  blocks: DocumentBlock[],
  id: string,
  currentSelectedId?: string | null
): DeleteBlockResult {
  const idx = blocks.findIndex((b) => b.id === id);
  if (idx === -1) {
    return { blocks, nextSelectedId: currentSelectedId ?? null };
  }

  let nextBlocks = blocks.filter((b) => b.id !== id);
  if (nextBlocks.length === 0) {
    nextBlocks = [createEmptyTextBlock()];
  }

  let nextSelectedId: string | null = currentSelectedId ?? null;
  if (currentSelectedId === id) {
    if (idx > 0 && blocks[idx - 1]) {
      nextSelectedId = blocks[idx - 1]!.id;
    } else if (nextBlocks.length > 0) {
      nextSelectedId = nextBlocks[0]!.id;
    } else {
      nextSelectedId = null;
    }
  }

  return { blocks: nextBlocks, nextSelectedId };
}

/**
 * Moves a block up or down by one index position.
 */
export function moveBlockOp(
  blocks: DocumentBlock[],
  id: string,
  direction: "up" | "down"
): DocumentBlock[] {
  const idx = blocks.findIndex((b) => b.id === id);
  if (idx === -1) return blocks;

  const targetIdx = direction === "up" ? idx - 1 : idx + 1;
  if (targetIdx < 0 || targetIdx >= blocks.length) return blocks;

  const nextBlocks = [...blocks];
  const [movedBlock] = nextBlocks.splice(idx, 1);
  if (!movedBlock) return blocks;

  nextBlocks.splice(targetIdx, 0, movedBlock);
  return nextBlocks;
}

export interface SplitTextBlockResult {
  blocks: DocumentBlock[];
  beforeBlock: TextBlock;
  afterBlock: TextBlock;
}

/**
 * Splits a TextBlock into two consecutive TextBlocks.
 */
export function splitTextBlockOp(
  blocks: DocumentBlock[],
  id: string,
  splitHtmlBefore: string,
  splitHtmlAfter: string
): SplitTextBlockResult | null {
  const idx = blocks.findIndex((b) => b.id === id);
  if (idx === -1) return null;

  const original = blocks[idx];
  if (!original || original.type !== "text") return null;

  const beforeBlock: TextBlock = {
    ...original,
    html: splitHtmlBefore || "<p><br></p>",
  };

  const afterBlock: TextBlock = {
    id: generateBlockId("txt"),
    type: "text",
    html: splitHtmlAfter || "<p><br></p>",
    createdAt: Date.now(),
  };

  const nextBlocks = [
    ...blocks.slice(0, idx),
    beforeBlock,
    afterBlock,
    ...blocks.slice(idx + 1),
  ];

  return { blocks: nextBlocks, beforeBlock, afterBlock };
}
