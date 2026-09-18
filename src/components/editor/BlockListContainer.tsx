/**
 * src/components/editor/BlockListContainer.tsx
 *
 * Primary container orchestrating the sequence of DocumentBlock views.
 *
 * Architectural Invariants:
 * 1. Coordinates discrete block rendering in vertical reading order.
 * 2. Manages programmatic focus transitions between blocks (without arbitrary timeout hacks).
 * 3. Guarantees text continuity: clicking empty space or finishing a non-text block
 *    automatically provides a writable TextBlock.
 * 4. Connects selection and editing events to the useDocumentBlocks state machine.
 */

import React, { useRef, useCallback, useEffect } from "react";
import type { DocumentBlock, TextBlock, MathBlock, TableBlock, GraphBlock } from "@/types/document";
import { TextBlockView, type TextBlockViewHandle } from "./TextBlockView";
import { MathBlockView } from "./MathBlockView";
import { TableBlockView } from "./TableBlockView";
import { GraphBlockView } from "./GraphBlockView";
import type { TableSelectionInfo } from "@/lib/table-dom";
import { cn } from "@/lib/utils";

export interface BlockListContainerProps {
  blocks: DocumentBlock[];
  selectedBlockId: string | null;
  onSelectBlock: (id: string | null) => void;
  onUpdateBlock: <T extends DocumentBlock>(id: string, updates: Partial<T>) => void;
  onDeleteBlock: (id: string) => void;
  onInsertBlockAfter: (block: DocumentBlock, afterId: string | null) => void;
  onEditMathBlock?: ((block: MathBlock) => void) | undefined;
  onEditGraphBlock?: ((block: GraphBlock) => void) | undefined;
  onTableSelectionChange?: ((info: TableSelectionInfo | null) => void) | undefined;
  focusTargetBlockId?: string | null | undefined;
  onFocusHandled?: (() => void) | undefined;
  placeholder?: string | undefined;
  className?: string | undefined;
}

export const BlockListContainer: React.FC<BlockListContainerProps> = ({
  blocks,
  selectedBlockId,
  onSelectBlock,
  onUpdateBlock,
  onDeleteBlock,
  onInsertBlockAfter,
  onEditMathBlock,
  onEditGraphBlock,
  onTableSelectionChange,
  focusTargetBlockId,
  onFocusHandled,
  placeholder,
  className,
}) => {
  const textBlockRefs = useRef<Map<string, TextBlockViewHandle>>(new Map());

  // Focus target block when requested
  useEffect(() => {
    if (focusTargetBlockId) {
      const handle = textBlockRefs.current.get(focusTargetBlockId);
      if (handle) {
        handle.focus(true);
        onFocusHandled?.();
      }
    }
  }, [focusTargetBlockId, onFocusHandled]);

  const handleEnterAtEnd = useCallback(
    (currentBlockId: string) => {
      const newBlock: TextBlock = {
        id: `txt_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
        type: "text",
        html: "<p><br></p>",
        createdAt: Date.now(),
      };
      onInsertBlockAfter(newBlock, currentBlockId);
    },
    [onInsertBlockAfter]
  );

  const handleBackspaceAtStart = useCallback(
    (currentBlockId: string) => {
      const idx = blocks.findIndex((b) => b.id === currentBlockId);
      if (idx > 0) {
        const prevBlock = blocks[idx - 1]!;
        onDeleteBlock(currentBlockId);
        if (prevBlock.type === "text") {
          setTimeout(() => {
            textBlockRefs.current.get(prevBlock.id)?.focus(true);
          }, 0);
        } else {
          onSelectBlock(prevBlock.id);
        }
      }
    },
    [blocks, onDeleteBlock, onSelectBlock]
  );

  const handleArrowUpAtStart = useCallback(
    (currentBlockId: string) => {
      const idx = blocks.findIndex((b) => b.id === currentBlockId);
      if (idx > 0) {
        const prevBlock = blocks[idx - 1]!;
        if (prevBlock.type === "text") {
          textBlockRefs.current.get(prevBlock.id)?.focus(true);
        } else {
          onSelectBlock(prevBlock.id);
        }
      }
    },
    [blocks, onSelectBlock]
  );

  const handleArrowDownAtEnd = useCallback(
    (currentBlockId: string) => {
      const idx = blocks.findIndex((b) => b.id === currentBlockId);
      if (idx < blocks.length - 1) {
        const nextBlock = blocks[idx + 1]!;
        if (nextBlock.type === "text") {
          textBlockRefs.current.get(nextBlock.id)?.focus(false);
        } else {
          onSelectBlock(nextBlock.id);
        }
      }
    },
    [blocks, onSelectBlock]
  );

  // Click on empty padding below blocks -> focus or append text block
  const handleContainerClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (e.target === e.currentTarget) {
        const lastBlock = blocks[blocks.length - 1];
        if (lastBlock && lastBlock.type === "text") {
          textBlockRefs.current.get(lastBlock.id)?.focus(true);
        } else {
          const newBlock: TextBlock = {
            id: `txt_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
            type: "text",
            html: "<p><br></p>",
            createdAt: Date.now(),
          };
          onInsertBlockAfter(newBlock, lastBlock ? lastBlock.id : null);
        }
      }
    },
    [blocks, onInsertBlockAfter]
  );

  return (
    <div
      onClick={handleContainerClick}
      className={cn("block-list-container flex flex-col min-h-full cursor-text pb-16", className)}
    >
      {blocks.map((block) => {
        const isSelected = selectedBlockId === block.id;

        switch (block.type) {
          case "text":
            return (
              <TextBlockView
                key={block.id}
                ref={(inst) => {
                  if (inst) {
                    textBlockRefs.current.set(block.id, inst);
                  } else {
                    textBlockRefs.current.delete(block.id);
                  }
                }}
                block={block as TextBlock}
                isSelected={isSelected}
                onSelect={() => onSelectBlock(block.id)}
                onChange={(html) => onUpdateBlock<TextBlock>(block.id, { html })}
                onEnterAtEnd={() => handleEnterAtEnd(block.id)}
                onBackspaceAtStart={() => handleBackspaceAtStart(block.id)}
                onArrowUpAtStart={() => handleArrowUpAtStart(block.id)}
                onArrowDownAtEnd={() => handleArrowDownAtEnd(block.id)}
                placeholder={blocks.length === 1 ? placeholder : undefined}
              />
            );

          case "math":
            return (
              <MathBlockView
                key={block.id}
                block={block as MathBlock}
                isSelected={isSelected}
                onSelect={() => onSelectBlock(block.id)}
                onEdit={() => onEditMathBlock?.(block as MathBlock)}
                onDelete={() => onDeleteBlock(block.id)}
              />
            );

          case "table":
            return (
              <TableBlockView
                key={block.id}
                block={block as TableBlock}
                isSelected={isSelected}
                onSelect={() => onSelectBlock(block.id)}
                onChange={(html) => onUpdateBlock<TableBlock>(block.id, { html })}
                onDelete={() => onDeleteBlock(block.id)}
                onTableSelectionChange={onTableSelectionChange}
              />
            );

          case "graph":
            return (
              <GraphBlockView
                key={block.id}
                block={block as GraphBlock}
                isSelected={isSelected}
                onSelect={() => onSelectBlock(block.id)}
                onEdit={() => onEditGraphBlock?.(block as GraphBlock)}
                onDelete={() => onDeleteBlock(block.id)}
              />
            );

          default:
            return null;
        }
      })}
    </div>
  );
};

BlockListContainer.displayName = "BlockListContainer";
