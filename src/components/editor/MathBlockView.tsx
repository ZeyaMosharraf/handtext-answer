/**
 * src/components/editor/MathBlockView.tsx
 *
 * First-Class Discrete Document Object view for a MathBlock.
 *
 * Architectural Invariants:
 * 1. MathBlock is NEVER rendered inside a ContentEditable container.
 * 2. Two-tier selection model (PowerPoint/Figma inspired):
 *    - Single click: selects block as an atomic object (visible focus ring, action bar).
 *    - Double click or Enter: enters edit mode (calls onEdit for THIS block ID).
 *    - Delete / Backspace: deletes THIS block cleanly without cursor artifacts.
 *    - Escape: deselects block.
 * 3. Stable block ID is rendered as `data-block-id` and `class="math-block"`.
 */

import React, { useCallback, useRef } from "react";
import type { MathBlock } from "@/types/document";
import { cn } from "@/lib/utils";
import { Edit2, Trash2, Sigma } from "lucide-react";
import { Button } from "@/components/ui/primitives";

export interface MathBlockViewProps {
  block: MathBlock;
  isSelected?: boolean;
  onSelect?: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
  className?: string;
}

export const MathBlockView: React.FC<MathBlockViewProps> = ({
  block,
  isSelected,
  onSelect,
  onEdit,
  onDelete,
  className,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (!isSelected) return;

      if (e.key === "Enter") {
        e.preventDefault();
        onEdit?.();
      } else if (e.key === "Backspace" || e.key === "Delete") {
        e.preventDefault();
        onDelete?.();
      }
    },
    [isSelected, onEdit, onDelete]
  );

  const displayFormula = block.naturalExpr || block.latex || "Formula";
  const truncatedFormula =
    displayFormula.length > 70 ? `${displayFormula.slice(0, 67)}…` : displayFormula;

  return (
    <div
      ref={containerRef}
      tabIndex={0}
      data-block-id={block.id}
      data-block-type="math"
      data-latex={block.latex}
      data-natural-expr={block.naturalExpr}
      data-display-mode={block.displayMode}
      onClick={(e) => {
        e.stopPropagation();
        onSelect?.();
      }}
      onDoubleClick={(e) => {
        e.stopPropagation();
        onEdit?.();
      }}
      onKeyDown={handleKeyDown}
      className={cn(
        "math-block-view group relative my-2 flex cursor-pointer select-none items-center justify-between rounded-lg border px-3.5 py-2.5 transition-all outline-none",
        isSelected
          ? "border-primary bg-primary/8 shadow-xs ring-2 ring-primary ring-offset-1"
          : "border-border bg-card/60 hover:border-primary/40 hover:bg-accent/40",
        block.displayMode === "compact" ? "inline-flex max-w-fit" : "w-full",
        className
      )}
    >
      <div className="flex items-center gap-2.5 overflow-hidden">
        <span className="flex size-6 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
          <Sigma className="size-3.5" />
        </span>
        <span className="font-mono text-xs font-semibold text-foreground truncate">
          {truncatedFormula}
        </span>
        {block.displayMode === "compact" && (
          <span className="rounded bg-muted px-1.5 py-0.5 text-[9px] font-medium text-muted-foreground uppercase">
            Compact
          </span>
        )}
      </div>

      {/* Action Chips for Selected State or Hover */}
      <div
        className={cn(
          "ml-3 flex shrink-0 items-center gap-1 transition-opacity",
          isSelected ? "opacity-100" : "opacity-0 group-hover:opacity-80"
        )}
      >
        <Button
          type="button"
          size="sm"
          variant="secondary"
          onClick={(e) => {
            e.stopPropagation();
            onEdit?.();
          }}
          title="Edit formula (Enter / Double-click)"
          className="h-6 gap-1 px-2 text-[11px] font-medium cursor-pointer shadow-xs"
        >
          <Edit2 className="size-3" />
          <span>Edit</span>
        </Button>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          onClick={(e) => {
            e.stopPropagation();
            onDelete?.();
          }}
          title="Delete block (Backspace / Delete)"
          className="h-6 px-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive cursor-pointer"
        >
          <Trash2 className="size-3" />
        </Button>
      </div>
    </div>
  );
};

MathBlockView.displayName = "MathBlockView";
