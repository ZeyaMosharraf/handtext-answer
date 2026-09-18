/**
 * src/lib/editor/mathClipboard.ts
 *
 * Dedicated clipboard serialization and deserialization for MathBlocks.
 *
 * Architectural Invariants:
 * 1. Content preservation: Preserves latex, naturalExpr, and displayMode.
 * 2. Identity decoupling: The clipboard format NEVER reuses or dictates the pasted block ID.
 * 3. MIME separation:
 *    - Custom MIME: application/x-handtext-math-block (stores structured JSON)
 *    - Fallback MIME: text/plain (stores readable formula string, NEVER raw internal JSON)
 * 4. Environment agnostic: Runs safely in browser environments and headless Node test runners.
 * 5. Robust in-memory fallback: Preserves last copied MathBlock within application session.
 */

import { generateBlockId, type MathBlock } from "@/types/document";

export const MATH_BLOCK_MIME_TYPE = "application/x-handtext-math-block";

export interface MathClipboardPayload {
  type: "math";
  version: 1;
  latex: string;
  naturalExpr: string;
  displayMode: "block" | "compact";
  sourceBlockId?: string | undefined;
}

// In-memory fallback for same-origin / restricted clipboard permissions
let lastCopiedMathBlock: MathClipboardPayload | null = null;

/**
 * Serializes a MathBlock into clipboard data and session memory.
 */
export function serializeMathBlockToClipboard(
  block: {
    id?: string | undefined;
    latex: string;
    naturalExpr?: string | undefined;
    displayMode?: "block" | "compact" | undefined;
  },
  clipboardData?: DataTransfer | null
): MathClipboardPayload {
  const payload: MathClipboardPayload = {
    type: "math",
    version: 1,
    latex: block.latex || block.naturalExpr || "",
    naturalExpr: block.naturalExpr || block.latex || "",
    displayMode: block.displayMode === "compact" ? "compact" : "block",
    sourceBlockId: block.id,
  };

  // Cache in session memory
  lastCopiedMathBlock = payload;

  if (clipboardData) {
    try {
      clipboardData.setData(MATH_BLOCK_MIME_TYPE, JSON.stringify(payload));
    } catch {
      // Ignore if browser restricts custom MIME types
    }

    try {
      // Sensible text/plain fallback: human-readable formula text, NEVER raw JSON
      const fallbackText = payload.naturalExpr || payload.latex;
      clipboardData.setData("text/plain", fallbackText);
    } catch {
      // Ignore
    }
  }

  return payload;
}

/**
 * Deserializes a MathBlock payload from clipboard data or session memory.
 * Returns null if the clipboard content is not a MathBlock.
 */
export function deserializeMathBlockFromClipboard(
  clipboardData?: DataTransfer | null
): MathClipboardPayload | null {
  // 1. Try custom application MIME type first
  if (clipboardData) {
    try {
      const customData = clipboardData.getData(MATH_BLOCK_MIME_TYPE);
      if (customData) {
        const parsed = JSON.parse(customData);
        if (parsed && parsed.type === "math" && typeof parsed.latex === "string" && parsed.latex.trim()) {
          return {
            type: "math",
            version: 1,
            latex: parsed.latex.trim(),
            naturalExpr: (parsed.naturalExpr || parsed.latex).trim(),
            displayMode: parsed.displayMode === "compact" ? "compact" : "block",
            sourceBlockId: parsed.sourceBlockId,
          };
        }
      }
    } catch {
      // Fall through to memory or plain text
    }

    // 2. Check if text/plain matches our active in-memory copied math block
    if (lastCopiedMathBlock) {
      try {
        const plainText = clipboardData.getData("text/plain")?.trim();
        const memoryFormula = (lastCopiedMathBlock.naturalExpr || lastCopiedMathBlock.latex).trim();
        const memoryLatex = lastCopiedMathBlock.latex.trim();
        if (plainText && (plainText === memoryFormula || plainText === memoryLatex)) {
          return { ...lastCopiedMathBlock };
        }
      } catch {
        // Fall through
      }
    }
  } else if (lastCopiedMathBlock) {
    return { ...lastCopiedMathBlock };
  }

  return null;
}

/**
 * Reconstructs an entirely new, independent MathBlock with a FRESH stable ID.
 * Invariant: NEVER reuses the original block's ID.
 */
export function createPastedMathBlock(payload: MathClipboardPayload): MathBlock {
  return {
    id: generateBlockId("math"),
    type: "math",
    latex: payload.latex,
    naturalExpr: payload.naturalExpr || payload.latex,
    displayMode: payload.displayMode || "block",
    createdAt: Date.now(),
  };
}

/**
 * Retrieves the currently active in-memory copied MathBlock (if any).
 */
export function getSessionCopiedMathBlock(): MathClipboardPayload | null {
  return lastCopiedMathBlock ? { ...lastCopiedMathBlock } : null;
}

/**
 * Clears the in-memory clipboard cache.
 */
export function clearSessionCopiedMathBlock(): void {
  lastCopiedMathBlock = null;
}
