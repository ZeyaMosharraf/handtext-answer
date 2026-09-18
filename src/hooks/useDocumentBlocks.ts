/**
 * src/hooks/useDocumentBlocks.ts
 *
 * State management hook for the Hybrid Block-Document Model.
 *
 * Architectural Invariants:
 * 1. Document consists of an ordered sequence of typed DocumentBlock instances.
 * 2. Selection (selectedBlockId) and modal editing (activeEditingBlockId) are EPHEMERAL UI state,
 *    strictly separated from persisted document content.
 * 3. Stable block IDs remain unchanged across edits and serialization.
 * 4. Built-in undo/redo history stack for block operations.
 * 5. Automatic empty-state defense: Document is never left completely empty (always contains at least one TextBlock).
 */

import { useState, useCallback, useRef, useEffect } from "react";
import {
  type DocumentBlock,
  type TextBlock,
  createEmptyTextBlock,
} from "../types/document";
import { blocksToHtml, htmlToBlocks } from "../lib/editor/blockSerialization";
import {
  insertBlockOp,
  updateBlockOp,
  deleteBlockOp,
  moveBlockOp,
  splitTextBlockOp,
} from "../lib/editor/documentOperations";

export interface UseDocumentBlocksOptions {
  initialBlocks?: DocumentBlock[];
  initialHtml?: string;
  onChange?: (blocks: DocumentBlock[], html: string) => void;
  maxHistory?: number;
}

export interface UseDocumentBlocksReturn {
  blocks: DocumentBlock[];
  selectedBlockId: string | null;
  activeEditingBlockId: string | null;
  canUndo: boolean;
  canRedo: boolean;

  // Block Mutations
  setBlocks: (newBlocks: DocumentBlock[]) => void;
  insertBlock: (block: DocumentBlock, afterId?: string | null) => void;
  updateBlock: <T extends DocumentBlock>(id: string, updates: Partial<T>) => void;
  deleteBlock: (id: string) => void;
  moveBlock: (id: string, direction: "up" | "down") => void;
  splitTextBlock: (
    id: string,
    splitHtmlBefore: string,
    splitHtmlAfter: string
  ) => { beforeBlock: TextBlock; afterBlock: TextBlock } | null;

  // Selection & UI State
  selectBlock: (id: string | null) => void;
  setActiveEditingBlock: (id: string | null) => void;

  // History Navigation
  undo: () => void;
  redo: () => void;

  // Serialization Helpers
  toHtml: () => string;
  loadFromHtml: (html: string) => void;
}

export function useDocumentBlocks({
  initialBlocks,
  initialHtml,
  onChange,
  maxHistory = 50,
}: UseDocumentBlocksOptions = {}): UseDocumentBlocksReturn {
  // Initialize blocks from initialBlocks, initialHtml, or default empty text block
  const [blocks, setBlocksState] = useState<DocumentBlock[]>(() => {
    if (initialBlocks && initialBlocks.length > 0) {
      return initialBlocks;
    }
    if (initialHtml && initialHtml.trim()) {
      return htmlToBlocks(initialHtml);
    }
    return [createEmptyTextBlock()];
  });

  // Ephemeral UI selection state
  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null);
  const [activeEditingBlockId, setActiveEditingBlockId] = useState<string | null>(null);

  // Undo / Redo history stacks (stores DocumentBlock[] snapshots)
  const historyRef = useRef<{
    past: DocumentBlock[][];
    future: DocumentBlock[][];
  }>({
    past: [],
    future: [],
  });

  const [, setHistoryVersion] = useState(0);

  // Notify onChange callback when blocks change
  const onChangeRef = useRef(onChange);
  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  // Synchronized ref to always access latest blocks in callbacks
  const blocksRef = useRef<DocumentBlock[]>(blocks);
  blocksRef.current = blocks;

  // Single mutation helper to record history and emit changes cleanly outside setState updaters
  const applyMutation = useCallback(
    (
      getNextBlocks: (current: DocumentBlock[]) => DocumentBlock[],
      addToHistory = true
    ): DocumentBlock[] => {
      const current = blocksRef.current;
      const next = getNextBlocks(current);
      const sanitized = next.length === 0 ? [createEmptyTextBlock()] : next;

      if (addToHistory) {
        historyRef.current.past.push(current);
        if (historyRef.current.past.length > maxHistory) {
          historyRef.current.past.shift();
        }
        historyRef.current.future = [];
        setHistoryVersion((v) => v + 1);
      }

      blocksRef.current = sanitized;
      setBlocksState(sanitized);

      if (onChangeRef.current) {
        onChangeRef.current(sanitized, blocksToHtml(sanitized));
      }

      return sanitized;
    },
    [maxHistory]
  );

  // ─── Block Mutations ────────────────────────────────────────────────────────

  const setBlocks = useCallback(
    (newBlocks: DocumentBlock[]) => {
      applyMutation(() => newBlocks, true);
    },
    [applyMutation]
  );

  const insertBlock = useCallback(
    (block: DocumentBlock, afterId?: string | null) => {
      applyMutation((current) => insertBlockOp(current, block, afterId), true);
      setSelectedBlockId(block.id);
    },
    [applyMutation]
  );

  const updateBlock = useCallback(
    <T extends DocumentBlock>(id: string, updates: Partial<T>) => {
      applyMutation((current) => updateBlockOp(current, id, updates), true);
    },
    [applyMutation]
  );

  const deleteBlock = useCallback(
    (id: string) => {
      let nextSelectedId: string | null = null;
      applyMutation((current) => {
        const op = deleteBlockOp(current, id, selectedBlockId);
        nextSelectedId = op.nextSelectedId;
        return op.blocks;
      }, true);
      setSelectedBlockId(nextSelectedId);
    },
    [applyMutation, selectedBlockId]
  );

  const moveBlock = useCallback(
    (id: string, direction: "up" | "down") => {
      applyMutation((current) => moveBlockOp(current, id, direction), true);
    },
    [applyMutation]
  );

  const splitTextBlock = useCallback(
    (
      id: string,
      splitHtmlBefore: string,
      splitHtmlAfter: string
    ): { beforeBlock: TextBlock; afterBlock: TextBlock } | null => {
      let result: { beforeBlock: TextBlock; afterBlock: TextBlock } | null = null;

      applyMutation((current) => {
        const opResult = splitTextBlockOp(
          current,
          id,
          splitHtmlBefore,
          splitHtmlAfter
        );
        if (!opResult) return current;

        result = {
          beforeBlock: opResult.beforeBlock,
          afterBlock: opResult.afterBlock,
        };

        return opResult.blocks;
      }, true);

      return result;
    },
    [applyMutation]
  );

  // ─── Selection ──────────────────────────────────────────────────────────────

  const selectBlock = useCallback((id: string | null) => {
    setSelectedBlockId(id);
  }, []);

  const setActiveEditingBlock = useCallback((id: string | null) => {
    setActiveEditingBlockId(id);
  }, []);

  // ─── History (Undo / Redo) ──────────────────────────────────────────────────

  const canUndo = historyRef.current.past.length > 0;
  const canRedo = historyRef.current.future.length > 0;

  const undo = useCallback(() => {
    if (historyRef.current.past.length === 0) return;

    const previousBlocks = historyRef.current.past.pop()!;
    historyRef.current.future.push(blocksRef.current);
    setHistoryVersion((v) => v + 1);

    blocksRef.current = previousBlocks;
    setBlocksState(previousBlocks);
    setSelectedBlockId(null);

    if (onChangeRef.current) {
      onChangeRef.current(previousBlocks, blocksToHtml(previousBlocks));
    }
  }, []);

  const redo = useCallback(() => {
    if (historyRef.current.future.length === 0) return;

    const nextBlocks = historyRef.current.future.pop()!;
    historyRef.current.past.push(blocksRef.current);
    setHistoryVersion((v) => v + 1);

    blocksRef.current = nextBlocks;
    setBlocksState(nextBlocks);
    setSelectedBlockId(null);

    if (onChangeRef.current) {
      onChangeRef.current(nextBlocks, blocksToHtml(nextBlocks));
    }
  }, []);

  // ─── Serialization Helpers ──────────────────────────────────────────────────

  const toHtml = useCallback(() => {
    return blocksToHtml(blocksRef.current);
  }, []);

  const loadFromHtml = useCallback(
    (html: string) => {
      const parsedBlocks = htmlToBlocks(html);
      applyMutation(() => parsedBlocks, false);
    },
    [applyMutation]
  );

  return {
    blocks,
    selectedBlockId,
    activeEditingBlockId,
    canUndo,
    canRedo,

    setBlocks,
    insertBlock,
    updateBlock,
    deleteBlock,
    moveBlock,
    splitTextBlock,

    selectBlock,
    setActiveEditingBlock,

    undo,
    redo,

    toHtml,
    loadFromHtml,
  };
}
