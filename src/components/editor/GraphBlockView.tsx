/**
 * src/components/editor/GraphBlockView.tsx
 *
 * Block wrapper for the Handwritten Graph subsystem.
 *
 * Architectural Invariants:
 * 1. Wraps existing GraphDefinition struct without altering graph plotting algorithms.
 * 2. Visual object selection (border highlight, action chips: Delete).
 * 3. Shows graph title, type, and expression summary.
 */

import React from "react";
import type { GraphBlock } from "@/types/document";
import { cn } from "@/lib/utils";
import { Trash2, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/primitives";

export interface GraphBlockViewProps {
  block: GraphBlock;
  isSelected?: boolean;
  onSelect?: () => void;
  onDelete?: () => void;
  className?: string;
}

export const GraphBlockView: React.FC<GraphBlockViewProps> = ({
  block,
  isSelected,
  onSelect,
  onDelete,
  className,
}) => {
  const { graphDef } = block;
  const title = graphDef.title || `${graphDef.type.toUpperCase()} Graph`;
  const functionsSummary = graphDef.functions?.map((f) => f.expression).join(", ");
  const pointsCount = graphDef.points?.length ?? 0;

  return (
    <div
      tabIndex={0}
      data-block-id={block.id}
      data-block-type="graph"
      data-graph-definition={JSON.stringify(graphDef)}
      onClick={(e) => {
        e.stopPropagation();
        onSelect?.();
      }}
      onKeyDown={(e) => {
        if (isSelected && (e.key === "Backspace" || e.key === "Delete")) {
          e.preventDefault();
          onDelete?.();
        }
      }}
      className={cn(
        "graph-block-view group relative my-3 rounded-lg border p-3 transition-all outline-none cursor-pointer",
        isSelected
          ? "border-primary bg-primary/5 ring-2 ring-primary ring-offset-1"
          : "border-border/80 bg-card/40 hover:border-primary/40 hover:bg-accent/30",
        className
      )}
    >
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="flex size-6 items-center justify-center rounded bg-primary/10 text-primary">
            <TrendingUp className="size-3.5" />
          </span>
          <span className="text-xs font-semibold text-foreground">{title}</span>
          <span className="rounded bg-muted px-1.5 py-0.5 text-[9px] font-medium uppercase text-muted-foreground">
            {graphDef.type}
          </span>
        </div>

        <Button
          type="button"
          size="sm"
          variant="ghost"
          onClick={(e) => {
            e.stopPropagation();
            onDelete?.();
          }}
          title="Delete graph"
          className="h-6 px-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive cursor-pointer opacity-80 group-hover:opacity-100"
        >
          <Trash2 className="size-3" />
        </Button>
      </div>

      <div className="rounded border border-dashed border-border/80 bg-background/50 p-3 text-center text-xs text-muted-foreground">
        {functionsSummary && (
          <p className="font-mono text-foreground/80 font-medium">y = {functionsSummary}</p>
        )}
        {pointsCount > 0 && <p>{pointsCount} plotted points</p>}
        <p className="mt-1 text-[11px] text-muted-foreground/70">
          Domain: [{graphDef.space.xMin}, {graphDef.space.xMax}], Range: [{graphDef.space.yMin},{" "}
          {graphDef.space.yMax}]
        </p>
      </div>
    </div>
  );
};

GraphBlockView.displayName = "GraphBlockView";
