import React, { useState, useRef, useEffect } from "react";
import {
  Bold,
  Italic,
  Underline,
  Highlighter,
  Type,
  Table2,
  RotateCcw,
  Check,
  ChevronDown,
} from "lucide-react";
import { Button, Input } from "@/components/ui/primitives";
import { cn } from "@/lib/utils";
import type { FormatState, RichContentEditorHandle } from "./RichContentEditor";

export const STUDENT_INKS = [
  { id: "royal", label: "Royal Blue", hex: "#174ea6" },
  { id: "darkblue", label: "Dark Blue", hex: "#12235e" },
  { id: "blue", label: "Classic Blue", hex: "#1d3fb5" },
  { id: "black", label: "Black", hex: "#141821" },
  { id: "red", label: "Red", hex: "#b3231f" },
  { id: "green", label: "Green", hex: "#146b3a" },
];

export const HIGHLIGHT_COLORS = [
  { id: "yellow", label: "Yellow", hex: "#fef08a" },
  { id: "green", label: "Pastel Green", hex: "#bbf7d0" },
  { id: "cyan", label: "Sky Cyan", hex: "#bae6fd" },
  { id: "pink", label: "Soft Pink", hex: "#fbcfe8" },
  { id: "orange", label: "Light Orange", hex: "#fed7aa" },
];

export const FONT_SCALES = [
  { scale: 0.85, label: "Small (0.85x)" },
  { scale: 1.0, label: "Normal (1.0x)" },
  { scale: 1.2, label: "Medium (1.2x)" },
  { scale: 1.4, label: "Large (1.4x)" },
];

interface EditorToolbarProps {
  editorRef: React.RefObject<RichContentEditorHandle | null>;
  formatState: FormatState;
  className?: string;
}

export function EditorToolbar({ editorRef, formatState, className }: EditorToolbarProps) {
  const [colorMenuOpen, setColorMenuOpen] = useState(false);
  const [highlightMenuOpen, setHighlightMenuOpen] = useState(false);
  const [scaleMenuOpen, setScaleMenuOpen] = useState(false);
  const [tablePopoverOpen, setTablePopoverOpen] = useState(false);

  const [tableRows, setTableRows] = useState(4);
  const [tableCols, setTableCols] = useState(3);

  const colorRef = useRef<HTMLDivElement>(null);
  const highlightRef = useRef<HTMLDivElement>(null);
  const scaleRef = useRef<HTMLDivElement>(null);
  const tableRef = useRef<HTMLDivElement>(null);

  // Close menus on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (colorRef.current && !colorRef.current.contains(e.target as Node)) {
        setColorMenuOpen(false);
      }
      if (highlightRef.current && !highlightRef.current.contains(e.target as Node)) {
        setHighlightMenuOpen(false);
      }
      if (scaleRef.current && !scaleRef.current.contains(e.target as Node)) {
        setScaleMenuOpen(false);
      }
      if (tableRef.current && !tableRef.current.contains(e.target as Node)) {
        setTablePopoverOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleStepScale = (direction: "up" | "down") => {
    const scales = [0.85, 1.0, 1.2, 1.4];
    const current = formatState.scale ?? 1.0;
    let idx = scales.indexOf(current);
    if (idx === -1) idx = 1;
    const nextIdx = direction === "up" ? Math.min(scales.length - 1, idx + 1) : Math.max(0, idx - 1);
    const targetScale = scales[nextIdx] ?? 1.0;
    editorRef.current?.setFontScale(targetScale);
  };

  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-1 rounded-lg border border-border bg-card p-1 shadow-sm select-none",
        className,
      )}
      role="toolbar"
      aria-label="Rich text formatting"
    >
      {/* Bold */}
      <Button
        type="button"
        variant={formatState.bold ? "primary" : "ghost"}
        size="sm"
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => editorRef.current?.toggleBold()}
        title="Bold (Ctrl+B)"
        className="size-8 p-0"
      >
        <Bold className="size-4" />
        <span className="sr-only">Bold</span>
      </Button>

      {/* Italic */}
      <Button
        type="button"
        variant={formatState.italic ? "primary" : "ghost"}
        size="sm"
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => editorRef.current?.toggleItalic()}
        title="Italic (Ctrl+I)"
        className="size-8 p-0"
      >
        <Italic className="size-4" />
        <span className="sr-only">Italic</span>
      </Button>

      {/* Underline */}
      <Button
        type="button"
        variant={formatState.underline ? "primary" : "ghost"}
        size="sm"
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => editorRef.current?.toggleUnderline()}
        title="Underline (Ctrl+U)"
        className="size-8 p-0"
      >
        <Underline className="size-4" />
        <span className="sr-only">Underline</span>
      </Button>

      <div className="mx-0.5 h-4 w-px bg-border" />

      {/* Font Scale Popover */}
      <div className="relative" ref={scaleRef}>
        <div className="flex items-center gap-0.5">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => handleStepScale("down")}
            title="Decrease font size"
            className="h-8 px-1 text-xs font-semibold"
          >
            A-
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => setScaleMenuOpen((v) => !v)}
            title="Font scale"
            className="h-8 gap-1 px-1.5 text-xs font-medium"
          >
            <Type className="size-3.5" />
            <span className="hidden sm:inline-block">{formatState.scale ? `${formatState.scale}x` : "1.0x"}</span>
            <ChevronDown className="size-3 text-muted-foreground" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => handleStepScale("up")}
            title="Increase font size"
            className="h-8 px-1 text-xs font-semibold"
          >
            A+
          </Button>
        </div>

        {scaleMenuOpen && (
          <div className="absolute left-0 top-full z-50 mt-1.5 w-36 rounded-lg border border-border bg-popover p-1 shadow-lg backdrop-blur animate-in fade-in zoom-in-95">
            {FONT_SCALES.map((s) => (
              <button
                key={s.scale}
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  editorRef.current?.setFontScale(s.scale);
                  setScaleMenuOpen(false);
                }}
                className={cn(
                  "flex w-full items-center justify-between rounded px-2 py-1.5 text-left text-xs transition-colors hover:bg-accent hover:text-accent-foreground",
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

      <div className="mx-0.5 h-4 w-px bg-border" />

      {/* Ink Color Dropdown */}
      <div className="relative" ref={colorRef}>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => setColorMenuOpen((v) => !v)}
          title="Ink color"
          className="h-8 gap-1.5 px-2 text-xs"
        >
          <span
            className="size-3.5 rounded-full border border-black/20 shadow-xs"
            style={{ backgroundColor: formatState.color ?? "#1d3fb5" }}
          />
          <span className="hidden md:inline text-xs font-medium">Ink</span>
          <ChevronDown className="size-3 text-muted-foreground" />
        </Button>

        {colorMenuOpen && (
          <div className="absolute left-0 top-full z-50 mt-1.5 w-44 rounded-lg border border-border bg-popover p-2 shadow-lg backdrop-blur animate-in fade-in zoom-in-95">
            <div className="mb-1.5 px-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Student Inks
            </div>
            <div className="grid grid-cols-3 gap-1.5">
              {STUDENT_INKS.map((ink) => (
                <button
                  key={ink.id}
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => {
                    editorRef.current?.setTextColor(ink.hex);
                    setColorMenuOpen(false);
                  }}
                  title={ink.label}
                  className="flex flex-col items-center gap-1 rounded p-1 text-[10px] transition-colors hover:bg-accent"
                >
                  <span
                    className={cn(
                      "size-5 rounded-full border border-black/20 shadow-xs transition-transform hover:scale-110",
                      formatState.color?.toLowerCase() === ink.hex.toLowerCase() && "ring-2 ring-primary ring-offset-1",
                    )}
                    style={{ backgroundColor: ink.hex }}
                  />
                  <span className="truncate max-w-full text-center text-muted-foreground">{ink.label.split(" ")[0]}</span>
                </button>
              ))}
            </div>
            <div className="mt-2 border-t border-border pt-1.5">
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  editorRef.current?.setTextColor(null);
                  setColorMenuOpen(false);
                }}
                className="w-full rounded px-2 py-1 text-left text-xs text-muted-foreground hover:bg-accent hover:text-foreground"
              >
                Default ink
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Highlighter Wash Dropdown */}
      <div className="relative" ref={highlightRef}>
        <Button
          type="button"
          variant={formatState.highlight ? "secondary" : "ghost"}
          size="sm"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => setHighlightMenuOpen((v) => !v)}
          title="Highlight text"
          className="h-8 gap-1.5 px-2 text-xs"
        >
          <Highlighter
            className="size-3.5"
            style={{ color: formatState.highlight ? "#000" : undefined }}
          />
          {formatState.highlight && (
            <span
              className="size-2 rounded-full"
              style={{ backgroundColor: formatState.highlight }}
            />
          )}
          <span className="hidden md:inline text-xs font-medium">Highlight</span>
          <ChevronDown className="size-3 text-muted-foreground" />
        </Button>

        {highlightMenuOpen && (
          <div className="absolute left-0 top-full z-50 mt-1.5 w-40 rounded-lg border border-border bg-popover p-2 shadow-lg backdrop-blur animate-in fade-in zoom-in-95">
            <div className="mb-1.5 px-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Highlighter Wash
            </div>
            <div className="grid grid-cols-5 gap-1">
              {HIGHLIGHT_COLORS.map((h) => (
                <button
                  key={h.id}
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => {
                    editorRef.current?.setHighlight(h.hex);
                    setHighlightMenuOpen(false);
                  }}
                  title={h.label}
                  className="flex items-center justify-center p-1 rounded hover:bg-accent"
                >
                  <span
                    className={cn(
                      "size-5 rounded border border-black/15 shadow-xs transition-transform hover:scale-110",
                      formatState.highlight?.toLowerCase() === h.hex.toLowerCase() && "ring-2 ring-primary ring-offset-1",
                    )}
                    style={{ backgroundColor: h.hex }}
                  />
                </button>
              ))}
            </div>
            <div className="mt-2 border-t border-border pt-1.5">
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  editorRef.current?.setHighlight(null);
                  setHighlightMenuOpen(false);
                }}
                className="w-full rounded px-2 py-1 text-left text-xs text-muted-foreground hover:bg-accent hover:text-foreground"
              >
                Remove highlight
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="mx-0.5 h-4 w-px bg-border" />

      {/* Table Popover */}
      <div className="relative" ref={tableRef}>
        <Button
          type="button"
          variant={tablePopoverOpen ? "secondary" : "ghost"}
          size="sm"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => setTablePopoverOpen((v) => !v)}
          title="Insert table"
          className="h-8 gap-1.5 px-2 text-xs"
        >
          <Table2 className="size-3.5 text-muted-foreground" />
          <span className="hidden sm:inline text-xs font-medium">Table</span>
          <ChevronDown className="size-3 text-muted-foreground" />
        </Button>

        {tablePopoverOpen && (
          <div className="absolute left-0 top-full z-50 mt-1.5 w-52 rounded-lg border border-border bg-popover p-3 shadow-lg backdrop-blur animate-in fade-in zoom-in-95">
            <div className="mb-2 text-xs font-semibold text-foreground">Insert Table</div>
            <div className="flex items-center gap-2 mb-3">
              <div className="space-y-1">
                <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Rows</label>
                <Input
                  type="number"
                  min={1}
                  max={20}
                  value={tableRows}
                  onChange={(e) => setTableRows(Math.max(1, Number(e.target.value)))}
                  className="h-8 w-18 text-xs"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Columns</label>
                <Input
                  type="number"
                  min={1}
                  max={8}
                  value={tableCols}
                  onChange={(e) => setTableCols(Math.max(1, Number(e.target.value)))}
                  className="h-8 w-18 text-xs"
                />
              </div>
            </div>
            <Button
              type="button"
              size="sm"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                editorRef.current?.insertTable(tableRows, tableCols);
                setTablePopoverOpen(false);
              }}
              className="w-full h-8 text-xs font-medium"
            >
              Insert {tableRows}×{tableCols} Table
            </Button>
          </div>
        )}
      </div>

      {/* Clear formatting */}
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => editorRef.current?.clearFormatting()}
        title="Clear formatting"
        className="size-8 p-0 text-muted-foreground hover:text-foreground"
      >
        <RotateCcw className="size-3.5" />
        <span className="sr-only">Clear formatting</span>
      </Button>
    </div>
  );
}
