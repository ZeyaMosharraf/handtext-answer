/**
 * src/components/editor/MathBlockView.tsx
 *
 * First-Class Discrete Document Object view for a MathBlock — LEFT EDITOR.
 *
 * ╔══════════════════════════════════════════════════════════╗
 * ║  EDITOR/PREVIEW RENDERING CONTRACT                       ║
 * ║                                                          ║
 * ║   MathBlock                                              ║
 * ║      │                                                   ║
 * ║      ├── EDITOR VIEW  (this file)                        ║
 * ║      │     • parseMath() → DigitalMath JSX               ║
 * ║      │     • clean computer-style math                   ║
 * ║      │     • NO canvas, NO handwriting glyphs            ║
 * ║      │                                                   ║
 * ║      └── PAGE VIEW  (handwriting pipeline)               ║
 * ║            • parseMath() → layoutMath() → box.draw()     ║
 * ║            • handwritten glyphs + selected personality   ║
 * ╚══════════════════════════════════════════════════════════╝
 *
 * Architectural Invariants:
 * 1. MathBlock is NEVER rendered inside a ContentEditable container.
 * 2. Editor view shows digital math (computer/document style), NOT handwriting.
 * 3. Raw LaTeX source is NEVER shown in the resting document view.
 * 4. Two-tier object interaction (PowerPoint/Figma inspired):
 *    - Single click: selects block (visible ring + action bar)
 *    - Double click or Enter: opens edit modal (onEdit)
 *    - Delete / Backspace: deletes this block
 *    - Escape: deselects
 * 5. Stable block ID rendered as data-block-id / class="math-block-view".
 * 6. Error resilience: invalid LaTeX shows a clear syntax error badge.
 * 7. React.memo: adjacent TextBlock typing causes zero re-renders here.
 */

import React, { useCallback, useMemo, useState, useEffect, useRef } from "react";
import type { MathBlock } from "@/types/document";
import { cn } from "@/lib/utils";
import { Edit2, Trash2, AlertCircle, Copy } from "lucide-react";
import { Button } from "@/components/ui/primitives";
import { parseMath } from "@/lib/math";
import { DigitalMath } from "@/lib/math/digitalRenderer";
import type { MathNode } from "@/lib/math";
import { serializeMathBlockToClipboard } from "@/lib/editor/mathClipboard";
import { MATH_INK_COLORS } from "./RichContentEditor";

export interface MathBlockViewProps {
  block: MathBlock;
  isSelected?: boolean;
  onSelect?: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
  onChangeColor?: (color: string | undefined) => void;
  className?: string;
}

export const MathBlockView: React.FC<MathBlockViewProps> = React.memo(
  ({
    block,
    isSelected,
    onSelect,
    onEdit,
    onDelete,
    onChangeColor,
    className,
  }) => {
    const formula = (block.latex || block.naturalExpr || "").trim();

    // Parse the AST once per formula change.
    // parseMath() is the shared source of mathematical truth between
    // the editor's digital representation and the page's handwritten rendering.
    const [parsedNodes, parseError] = useMemo<[MathNode[] | null, string | null]>(() => {
      if (!formula) return [null, null];
      try {
        const nodes = parseMath(formula);
        return [nodes, null];
      } catch (err: unknown) {
        return [null, err instanceof Error ? err.message : "Formula error"];
      }
    }, [formula]);

    // Escape to deselect
    const [escDeselect, setEscDeselect] = useState(false);
    useEffect(() => {
      if (!isSelected || !escDeselect) return;
      setEscDeselect(false);
    }, [isSelected, escDeselect]);

    const [copied, setCopied] = useState(false);
    const [colorMenuOpen, setColorMenuOpen] = useState(false);
    const colorMenuRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
      if (!colorMenuOpen) return;
      const handleClickOutside = (e: MouseEvent) => {
        if (colorMenuRef.current && !colorMenuRef.current.contains(e.target as Node)) {
          setColorMenuOpen(false);
        }
      };
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }, [colorMenuOpen]);
    const handleCopy = useCallback(
      (e?: React.SyntheticEvent) => {
        e?.stopPropagation();
        serializeMathBlockToClipboard(block);
        if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
          navigator.clipboard.writeText(block.naturalExpr || block.latex).catch(() => {});
        }
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      },
      [block]
    );

    const handleKeyDown = useCallback(
      (e: React.KeyboardEvent<HTMLDivElement>) => {
        if (!isSelected) return;

        if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "c") {
          e.preventDefault();
          handleCopy();
        } else if (e.key === "Enter") {
          e.preventDefault();
          onEdit?.();
        } else if (e.key === "Backspace" || e.key === "Delete") {
          e.preventDefault();
          onDelete?.();
        } else if (e.key === "Escape") {
          e.preventDefault();
          // Blur to deselect — parent handles selectBlock(null)
          (e.currentTarget as HTMLElement).blur();
        }
      },
      [isSelected, handleCopy, onEdit, onDelete]
    );

    return (
      <div
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
        {/* ── Digital Math Content ────────────────────────────────────── */}
        <div
          className="flex flex-1 items-center gap-3 overflow-x-auto py-0.5 min-w-0"
          style={block.color ? { color: block.color } : undefined}
        >
          {!formula ? (
            <span className="text-xs italic text-muted-foreground">
              Empty formula — double-click to edit
            </span>
          ) : parseError ? (
            <div className="flex items-center gap-2 text-destructive">
              <AlertCircle className="size-3.5 shrink-0" />
              <span
                className="font-mono text-xs font-medium text-destructive truncate max-w-[320px]"
                title={parseError}
              >
                {formula}
              </span>
              <span className="rounded bg-destructive/10 px-1.5 py-0.5 text-[10px] text-destructive">
                Syntax error
              </span>
            </div>
          ) : (
            // Digital computer-style math — clean, readable, no handwriting
            <DigitalMath
              nodes={parsedNodes!}
              className="text-base leading-none"
              style={block.color ? { color: block.color } : undefined}
            />
          )}

          {block.displayMode === "compact" && (
            <span className="rounded bg-muted px-1.5 py-0.5 text-[9px] font-medium text-muted-foreground uppercase">
              Compact
            </span>
          )}
        </div>

        {/* ── Action Bar (Select / Hover) ─────────────────────────────── */}
        <div
          className={cn(
            "ml-3 flex shrink-0 items-center gap-1 transition-opacity",
            isSelected ? "opacity-100" : "opacity-0 group-hover:opacity-80"
          )}
        >
          {/* Color control */}
          <div className="relative">
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={(e) => {
                e.stopPropagation();
                setColorMenuOpen((v) => !v);
              }}
              title="Math ink color"
              className="h-6 gap-1 px-1.5 text-muted-foreground hover:bg-primary/10 hover:text-primary cursor-pointer"
            >
              <span
                className="size-2.5 rounded-full border border-black/20"
                style={{ backgroundColor: block.color || "#1d3fb5" }}
              />
              <span className="text-[11px]">Color</span>
            </Button>
            {colorMenuOpen && (
              <div
                ref={colorMenuRef}
                className="absolute right-0 top-full z-50 mt-1 w-44 rounded-lg border border-border bg-popover p-2 shadow-lg backdrop-blur cursor-default select-none text-popover-foreground animate-in fade-in zoom-in-95"
                onClick={(e) => e.stopPropagation()}
                onMouseDown={(e) => e.stopPropagation()}
              >
                <div className="mb-1.5 px-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Math Ink Color
                </div>
                <div className="grid grid-cols-3 gap-1.5">
                  {MATH_INK_COLORS.map((ink) => (
                    <button
                      key={ink.id}
                      type="button"
                      onClick={() => {
                        onChangeColor?.(ink.hex);
                        setColorMenuOpen(false);
                      }}
                      title={ink.label}
                      className="flex flex-col items-center gap-1 rounded p-1 text-[10px] transition-colors hover:bg-accent cursor-pointer"
                    >
                      <span
                        className={cn(
                          "size-5 rounded-full border border-black/20 shadow-xs transition-transform hover:scale-110",
                          block.color?.toLowerCase() === ink.hex.toLowerCase() &&
                            "ring-2 ring-primary ring-offset-1",
                        )}
                        style={{ backgroundColor: ink.hex }}
                      />
                      <span className="truncate max-w-full text-center text-muted-foreground">
                        {ink.label.split(" ")[0]}
                      </span>
                    </button>
                  ))}
                </div>
                <div className="mt-2 border-t border-border pt-1.5 flex items-center justify-between text-xs">
                  <button
                    type="button"
                    onClick={() => {
                      onChangeColor?.(undefined);
                      setColorMenuOpen(false);
                    }}
                    className="rounded px-1 text-muted-foreground hover:bg-accent hover:text-foreground cursor-pointer"
                  >
                    Default
                  </button>
                  <label className="flex items-center gap-1 text-muted-foreground hover:text-foreground cursor-pointer px-1 rounded hover:bg-accent">
                    <span>Custom</span>
                    <input
                      type="color"
                      value={block.color || "#1d3fb5"}
                      onChange={(e) => onChangeColor?.(e.target.value)}
                      className="size-4 p-0 border-0 rounded cursor-pointer"
                    />
                  </label>
                </div>
              </div>
            )}
          </div>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={handleCopy}
            title="Copy formula (Ctrl+C)"
            className="h-6 gap-1 px-1.5 text-muted-foreground hover:bg-primary/10 hover:text-primary cursor-pointer"
          >
            <Copy className="size-3" />
            <span className="text-[11px]">{copied ? "Copied" : "Copy"}</span>
          </Button>
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
  }
);

MathBlockView.displayName = "MathBlockView";
