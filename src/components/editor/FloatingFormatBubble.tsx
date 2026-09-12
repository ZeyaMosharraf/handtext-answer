import React, { useState, useRef, useEffect } from "react";
import {
  Bold,
  Italic,
  Underline,
  Highlighter,
  Type,
  RotateCcw,
  Check,
} from "lucide-react";
import { Button } from "@/components/ui/primitives";
import { cn } from "@/lib/utils";
import type { FormatState, RichContentEditorHandle } from "./RichContentEditor";
import { STUDENT_INKS, HIGHLIGHT_COLORS, FONT_SCALES } from "./EditorToolbar";

interface FloatingFormatBubbleProps {
  editorRef: React.RefObject<RichContentEditorHandle | null>;
  formatState: FormatState;
}

export function FloatingFormatBubble({ editorRef, formatState }: FloatingFormatBubbleProps) {
  const [activePopover, setActivePopover] = useState<"scale" | "color" | "highlight" | null>(null);
  const bubbleRef = useRef<HTMLDivElement>(null);

  // Close popover when selection changes or is dismissed
  useEffect(() => {
    if (!formatState.hasSelection) {
      setActivePopover(null);
    }
  }, [formatState.hasSelection]);

  if (!formatState.hasSelection || !formatState.selectionRect) {
    return null;
  }

  const { top, left, width } = formatState.selectionRect;
  // Position above the selection
  const bubbleTop = Math.max(10, top - 44);
  const bubbleLeft = Math.max(10, left + width / 2);

  return (
    <div
      ref={bubbleRef}
      role="toolbar"
      aria-label="Floating text formatting"
      className="fixed z-50 flex -translate-x-1/2 items-center gap-0.5 rounded-lg border border-border/80 bg-popover/95 p-0.5 shadow-md backdrop-blur-md animate-in fade-in zoom-in-95 duration-100 select-none"
      style={{ top: `${bubbleTop}px`, left: `${bubbleLeft}px` }}
      onMouseDown={(e) => e.preventDefault()}
    >
      {/* Bold */}
      <Button
        type="button"
        variant={formatState.bold ? "primary" : "ghost"}
        size="sm"
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => editorRef.current?.toggleBold()}
        title="Bold (Ctrl+B)"
        className="size-7 p-0"
      >
        <Bold className="size-3.5" />
      </Button>

      {/* Italic */}
      <Button
        type="button"
        variant={formatState.italic ? "primary" : "ghost"}
        size="sm"
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => editorRef.current?.toggleItalic()}
        title="Italic (Ctrl+I)"
        className="size-7 p-0"
      >
        <Italic className="size-3.5" />
      </Button>

      {/* Underline */}
      <Button
        type="button"
        variant={formatState.underline ? "primary" : "ghost"}
        size="sm"
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => editorRef.current?.toggleUnderline()}
        title="Underline (Ctrl+U)"
        className="size-7 p-0"
      >
        <Underline className="size-3.5" />
      </Button>

      <div className="mx-0.5 h-3.5 w-px bg-border/60" />

      {/* Font scale popover trigger */}
      <div className="relative">
        <Button
          type="button"
          variant={formatState.scale ? "secondary" : "ghost"}
          size="sm"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => setActivePopover((p) => (p === "scale" ? null : "scale"))}
          title="Font scale"
          className="size-7 p-0 text-xs font-semibold"
        >
          <Type className="size-3.5" />
        </Button>

        {activePopover === "scale" && (
          <div className="absolute left-1/2 top-full z-50 mt-1 -translate-x-1/2 w-32 rounded-lg border border-border bg-popover p-1 shadow-lg backdrop-blur">
            {FONT_SCALES.map((s) => (
              <button
                key={s.scale}
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  editorRef.current?.setFontScale(s.scale);
                  setActivePopover(null);
                }}
                className={cn(
                  "flex w-full items-center justify-between rounded px-2 py-1 text-left text-xs transition-colors hover:bg-accent hover:text-accent-foreground",
                  formatState.scale === s.scale ? "bg-accent/70 font-semibold" : "text-popover-foreground",
                )}
              >
                <span>{s.label}</span>
                {formatState.scale === s.scale && <Check className="size-3 text-primary" />}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Ink color popover trigger */}
      <div className="relative">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => setActivePopover((p) => (p === "color" ? null : "color"))}
          title="Ink color"
          className="size-7 p-0"
        >
          <span
            className="size-3.5 rounded-full border border-black/20 shadow-xs"
            style={{ backgroundColor: formatState.color ?? "#1d3fb5" }}
          />
        </Button>

        {activePopover === "color" && (
          <div className="absolute left-1/2 top-full z-50 mt-1 -translate-x-1/2 w-36 rounded-lg border border-border bg-popover p-1.5 shadow-lg backdrop-blur">
            <div className="grid grid-cols-3 gap-1">
              {STUDENT_INKS.map((ink) => (
                <button
                  key={ink.id}
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => {
                    editorRef.current?.setTextColor(ink.hex);
                    setActivePopover(null);
                  }}
                  title={ink.label}
                  className="flex items-center justify-center p-1 rounded hover:bg-accent"
                >
                  <span
                    className={cn(
                      "size-4 rounded-full border border-black/20 shadow-xs transition-transform hover:scale-110",
                      formatState.color?.toLowerCase() === ink.hex.toLowerCase() && "ring-2 ring-primary ring-offset-1",
                    )}
                    style={{ backgroundColor: ink.hex }}
                  />
                </button>
              ))}
            </div>
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                editorRef.current?.setTextColor(null);
                setActivePopover(null);
              }}
              className="mt-1 w-full rounded px-1.5 py-0.5 text-center text-[10px] text-muted-foreground hover:bg-accent"
            >
              Default
            </button>
          </div>
        )}
      </div>

      {/* Highlighter popover trigger */}
      <div className="relative">
        <Button
          type="button"
          variant={formatState.highlight ? "secondary" : "ghost"}
          size="sm"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => setActivePopover((p) => (p === "highlight" ? null : "highlight"))}
          title="Highlighter wash"
          className="size-7 p-0"
        >
          <Highlighter className="size-3.5" />
        </Button>

        {activePopover === "highlight" && (
          <div className="absolute left-1/2 top-full z-50 mt-1 -translate-x-1/2 w-32 rounded-lg border border-border bg-popover p-1.5 shadow-lg backdrop-blur">
            <div className="grid grid-cols-5 gap-1">
              {HIGHLIGHT_COLORS.map((h) => (
                <button
                  key={h.id}
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => {
                    editorRef.current?.setHighlight(h.hex);
                    setActivePopover(null);
                  }}
                  title={h.label}
                  className="flex items-center justify-center p-0.5 rounded hover:bg-accent"
                >
                  <span
                    className={cn(
                      "size-4 rounded border border-black/15 shadow-xs transition-transform hover:scale-110",
                      formatState.highlight?.toLowerCase() === h.hex.toLowerCase() && "ring-2 ring-primary ring-offset-1",
                    )}
                    style={{ backgroundColor: h.hex }}
                  />
                </button>
              ))}
            </div>
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                editorRef.current?.setHighlight(null);
                setActivePopover(null);
              }}
              className="mt-1 w-full rounded px-1.5 py-0.5 text-center text-[10px] text-muted-foreground hover:bg-accent"
            >
              Remove
            </button>
          </div>
        )}
      </div>

      <div className="mx-0.5 h-3.5 w-px bg-border/60" />

      {/* Clear formatting */}
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => editorRef.current?.clearFormatting()}
        title="Clear formatting"
        className="size-7 p-0 text-muted-foreground hover:text-foreground"
      >
        <RotateCcw className="size-3.5" />
      </Button>
    </div>
  );
}
