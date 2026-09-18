/**
 * src/components/editor/TableBlockView.tsx
 *
 * Block wrapper for the Table subsystem.
 *
 * Architectural Invariants:
 * 1. Wraps existing table HTML and DOM without rewriting table operations.
 * 2. Directly preserves compact row heights, column alignments, and cell rich text.
 * 3. Supports row/column operations and tab navigation via @/lib/table-dom.
 * 4. Exposes table selection info to update EditorToolbar formatState.
 */

import React, { useRef, useEffect, useCallback } from "react";
import type { TableBlock } from "@/types/document";
import { cn } from "@/lib/utils";
import { Trash2, Table as TableIcon } from "lucide-react";
import { Button } from "@/components/ui/primitives";
import {
  type TableSelectionInfo,
  getTableSelectionInfo,
  handleTableTabNavigation,
} from "@/lib/table-dom";

export interface TableBlockViewProps {
  block: TableBlock;
  isSelected?: boolean | undefined;
  onSelect?: (() => void) | undefined;
  onChange: (html: string) => void;
  onDelete?: (() => void) | undefined;
  onTableSelectionChange?: ((info: TableSelectionInfo | null) => void) | undefined;
  className?: string | undefined;
}

export const TableBlockView: React.FC<TableBlockViewProps> = ({
  block,
  isSelected,
  onSelect,
  onChange,
  onDelete,
  onTableSelectionChange,
  className,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const lastHtmlRef = useRef<string>(block.html);
  const isInternalChangeRef = useRef(false);

  // Sync external HTML if changed externally
  useEffect(() => {
    if (isInternalChangeRef.current) {
      isInternalChangeRef.current = false;
      return;
    }
    if (containerRef.current && containerRef.current.innerHTML !== block.html) {
      containerRef.current.innerHTML = block.html;
      lastHtmlRef.current = block.html;
    }
  }, [block.html]);

  const handleInput = useCallback(() => {
    if (!containerRef.current) return;
    const newHtml = containerRef.current.innerHTML;
    if (newHtml !== lastHtmlRef.current) {
      lastHtmlRef.current = newHtml;
      isInternalChangeRef.current = true;
      onChange(newHtml);
    }
  }, [onChange]);

  const handleSelectionCheck = useCallback(() => {
    if (!containerRef.current) return;
    const info = getTableSelectionInfo(containerRef.current);
    onTableSelectionChange?.(info);
  }, [onTableSelectionChange]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      // Handle Tab navigation inside table cells
      if (e.key === "Tab") {
        if (containerRef.current && handleTableTabNavigation(containerRef.current, e.shiftKey)) {
          e.preventDefault();
          handleInput();
          handleSelectionCheck();
          return;
        }
      }

      // If the block itself is selected (clicked on wrapper), Delete/Backspace removes it
      if (isSelected && (e.key === "Delete" || e.key === "Backspace")) {
        const target = e.target as HTMLElement;
        // Only delete whole block if not currently typing in a cell
        if (target === containerRef.current || !containerRef.current?.contains(target)) {
          e.preventDefault();
          onDelete?.();
        }
      }
    },
    [handleInput, handleSelectionCheck, isSelected, onDelete]
  );

  return (
    <div
      tabIndex={0}
      data-block-id={block.id}
      data-block-type="table"
      onClick={onSelect}
      onKeyUp={handleSelectionCheck}
      onMouseUp={handleSelectionCheck}
      onKeyDown={handleKeyDown}
      className={cn(
        "table-block-view group relative my-3 rounded-lg border transition-all outline-none",
        isSelected
          ? "border-primary/80 ring-2 ring-primary ring-offset-1 bg-primary/2"
          : "border-border/60 hover:border-border",
        className
      )}
    >
      {/* Header Bar with Action Chips */}
      <div className="flex items-center justify-between border-b border-border/40 bg-muted/30 px-3 py-1 text-xs text-muted-foreground">
        <div className="flex items-center gap-1.5 font-medium">
          <TableIcon className="size-3.5" />
          <span>Table</span>
        </div>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          onClick={(e) => {
            e.stopPropagation();
            onDelete?.();
          }}
          title="Delete table"
          className="h-5 px-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive cursor-pointer opacity-60 group-hover:opacity-100"
        >
          <Trash2 className="size-3" />
        </Button>
      </div>

      {/* Editable Table Container */}
      <div
        ref={containerRef}
        contentEditable
        suppressContentEditableWarning
        onInput={handleInput}
        className="overflow-x-auto p-2 outline-none"
        dangerouslySetInnerHTML={{ __html: block.html }}
      />
    </div>
  );
};

TableBlockView.displayName = "TableBlockView";
