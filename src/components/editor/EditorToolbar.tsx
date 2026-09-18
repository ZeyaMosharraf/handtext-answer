import React, { useState, useRef, useEffect, useCallback } from "react";
import {
  Bold,
  Italic,
  Underline,
  Highlighter,
  Type,
  Table2,
  Sigma,
  RotateCcw,
  Check,
  ChevronDown,
  AlignLeft,
  AlignCenter,
  AlignRight,
  TrendingUp,
} from "lucide-react";
import { Button, Input } from "@/components/ui/primitives";
import { cn } from "@/lib/utils";
import type { FormatState, RichContentEditorHandle } from "./RichContentEditor";
import { MathFormulaModal } from "./MathFormulaModal";
import { GraphInsertModal } from "./GraphInsertModal";
import type { GraphDefinition } from "@/lib/graph/types";

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
  mathModalOpen?: boolean;
  mathModalMode?: "insert" | "update" | "edit";
  mathInitialLatex?: string;
  mathTargetElement?: HTMLElement | null;
  onOpenInsertMath?: () => void;
  onCloseMathModal?: () => void;
  onMathModalOpenChange?: (open: boolean) => void;
  graphModalOpen?: boolean;
  graphModalMode?: "insert" | "edit";
  graphInitialDefinition?: GraphDefinition | undefined;
  graphTargetBlockId?: string | null | undefined;
  onOpenInsertGraph?: () => void;
  onCloseGraphModal?: () => void;
  onGraphModalOpenChange?: (open: boolean) => void;
}

export function EditorToolbar({
  editorRef,
  formatState,
  className,
  mathModalOpen: controlledMathModalOpen,
  mathModalMode = "insert",
  mathInitialLatex = "",
  mathTargetElement,
  onOpenInsertMath,
  onCloseMathModal,
  onMathModalOpenChange,
  graphModalOpen: controlledGraphModalOpen,
  graphModalMode = "insert",
  graphInitialDefinition,
  graphTargetBlockId,
  onOpenInsertGraph,
  onCloseGraphModal,
  onGraphModalOpenChange,
}: EditorToolbarProps) {
  const [colorMenuOpen, setColorMenuOpen] = useState(false);
  const [highlightMenuOpen, setHighlightMenuOpen] = useState(false);
  const [scaleMenuOpen, setScaleMenuOpen] = useState(false);
  const [tablePopoverOpen, setTablePopoverOpen] = useState(false);

  const [tableRows, setTableRows] = useState(4);
  const [tableCols, setTableCols] = useState(3);
  const [internalMathModalOpen, setInternalMathModalOpen] = useState(false);
  const mathModalOpen = controlledMathModalOpen !== undefined ? controlledMathModalOpen : internalMathModalOpen;
  const setMathModalOpen = useCallback(
    (open: boolean) => {
      if (onMathModalOpenChange) {
        onMathModalOpenChange(open);
      } else {
        setInternalMathModalOpen(open);
      }
    },
    [onMathModalOpenChange],
  );

  const [internalGraphModalOpen, setInternalGraphModalOpen] = useState(false);
  const graphModalOpen = controlledGraphModalOpen !== undefined ? controlledGraphModalOpen : internalGraphModalOpen;
  const setGraphModalOpen = useCallback(
    (open: boolean) => {
      if (onGraphModalOpenChange) {
        onGraphModalOpenChange(open);
      } else {
        setInternalGraphModalOpen(open);
      }
    },
    [onGraphModalOpenChange],
  );

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
          <div className="absolute left-0 top-full z-50 mt-1.5 w-36 rounded-lg border border-border bg-popover p-1 shadow-lg backdrop-blur animate-in fade-in zoom-in-95 cursor-default">
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
                  "flex w-full items-center justify-between rounded px-2 py-1.5 text-left text-xs transition-colors hover:bg-accent hover:text-accent-foreground cursor-pointer",
                  formatState.scale === s.scale ? "bg-accent/70 font-semibold" : "text-popover-foreground",
                )}
              >
                <span>{s.label}</span>
                {formatState.scale === s.scale && <Check className="size-3.5 text-primary" />}
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
          <div className="absolute left-0 top-full z-50 mt-1.5 w-44 rounded-lg border border-border bg-popover p-2 shadow-lg backdrop-blur animate-in fade-in zoom-in-95 cursor-default">
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
                  className="flex flex-col items-center gap-1 rounded p-1 text-[10px] transition-colors hover:bg-accent cursor-pointer"
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
                className="w-full rounded px-2 py-1 text-left text-xs text-muted-foreground hover:bg-accent hover:text-foreground cursor-pointer"
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
          <div className="absolute left-0 top-full z-50 mt-1.5 w-40 rounded-lg border border-border bg-popover p-2 shadow-lg backdrop-blur animate-in fade-in zoom-in-95 cursor-default">
            <div className="mb-1.5 px-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Highlighter Wash
            </div>
            <div className="grid grid-cols-5 gap-1.5">
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
                  className="flex items-center justify-center p-1 rounded hover:bg-accent cursor-pointer"
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
                className="w-full rounded px-2 py-1 text-left text-xs text-muted-foreground hover:bg-accent hover:text-foreground cursor-pointer"
              >
                Remove highlight
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="mx-0.5 h-4 w-px bg-border" />

      {/* Contextual Table Alignment Controls */}
      {formatState.tableInfo && (
        <>
          <div className="mx-0.5 h-4 w-px bg-border" />
          <div className="flex items-center gap-0.5 rounded-md border border-border bg-muted/20 p-0.5">
            <Button
              type="button"
              variant={formatState.tableInfo.alignment === "left" ? "secondary" : "ghost"}
              size="sm"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => editorRef.current?.setTableColumnAlignment(formatState.tableInfo!.colIndex, "left")}
              title="Align column left"
              className="size-7 p-0 cursor-pointer"
            >
              <AlignLeft className="size-3.5" />
              <span className="sr-only">Align left</span>
            </Button>
            <Button
              type="button"
              variant={formatState.tableInfo.alignment === "center" ? "secondary" : "ghost"}
              size="sm"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => editorRef.current?.setTableColumnAlignment(formatState.tableInfo!.colIndex, "center")}
              title="Align column center"
              className="size-7 p-0 cursor-pointer"
            >
              <AlignCenter className="size-3.5" />
              <span className="sr-only">Align center</span>
            </Button>
            <Button
              type="button"
              variant={formatState.tableInfo.alignment === "right" ? "secondary" : "ghost"}
              size="sm"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => editorRef.current?.setTableColumnAlignment(formatState.tableInfo!.colIndex, "right")}
              title="Align column right"
              className="size-7 p-0 cursor-pointer"
            >
              <AlignRight className="size-3.5" />
              <span className="sr-only">Align right</span>
            </Button>
          </div>
        </>
      )}

      <div className="mx-0.5 h-4 w-px bg-border" />

      {/* Table Popover */}
      <div className="relative" ref={tableRef}>
        <Button
          type="button"
          variant={tablePopoverOpen || Boolean(formatState.tableInfo) ? "secondary" : "ghost"}
          size="sm"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => setTablePopoverOpen((v) => !v)}
          title={formatState.tableInfo ? "Table options" : "Insert table"}
          className="h-8 gap-1.5 px-2 text-xs cursor-pointer"
        >
          <Table2 className="size-3.5 text-muted-foreground" />
          <span className="hidden sm:inline text-xs font-medium">Table</span>
          <ChevronDown className="size-3 text-muted-foreground" />
        </Button>

        {tablePopoverOpen && formatState.tableInfo && (
          <div className="absolute left-0 top-full z-50 mt-1.5 w-60 rounded-lg border border-border bg-popover p-3 shadow-lg backdrop-blur animate-in fade-in zoom-in-95 cursor-default">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-foreground">Table Actions</span>
              <span className="text-[10px] font-mono text-muted-foreground">
                R{formatState.tableInfo.rowIndex + 1} / C{formatState.tableInfo.colIndex + 1}
              </span>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <div className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground mb-1">Rows</div>
                <div className="grid grid-cols-2 gap-1.5">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => {
                      editorRef.current?.insertTableRow("above");
                      setTablePopoverOpen(false);
                    }}
                    className="h-7 text-xs justify-start px-2 cursor-pointer"
                  >
                    + Row Above
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => {
                      editorRef.current?.insertTableRow("below");
                      setTablePopoverOpen(false);
                    }}
                    className="h-7 text-xs justify-start px-2 cursor-pointer"
                  >
                    + Row Below
                  </Button>
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => {
                    editorRef.current?.deleteTableRow();
                    setTablePopoverOpen(false);
                  }}
                  className="w-full mt-1.5 h-7 text-xs text-destructive hover:text-destructive hover:bg-destructive/10 justify-start px-2 cursor-pointer"
                >
                  Delete Current Row
                </Button>
              </div>

              <div className="border-t border-border pt-2">
                <div className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground mb-1">Columns</div>
                <div className="grid grid-cols-2 gap-1.5">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => {
                      editorRef.current?.insertTableColumn("left");
                      setTablePopoverOpen(false);
                    }}
                    className="h-7 text-xs justify-start px-2 cursor-pointer"
                  >
                    + Col Left
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => {
                      editorRef.current?.insertTableColumn("right");
                      setTablePopoverOpen(false);
                    }}
                    className="h-7 text-xs justify-start px-2 cursor-pointer"
                  >
                    + Col Right
                  </Button>
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => {
                    editorRef.current?.deleteTableColumn();
                    setTablePopoverOpen(false);
                  }}
                  className="w-full mt-1.5 h-7 text-xs text-destructive hover:text-destructive hover:bg-destructive/10 justify-start px-2 cursor-pointer"
                >
                  Delete Current Column
                </Button>
              </div>
            </div>
          </div>
        )}

        {tablePopoverOpen && !formatState.tableInfo && (
          <div className="absolute left-0 top-full z-50 mt-1.5 w-52 rounded-lg border border-border bg-popover p-3 shadow-lg backdrop-blur animate-in fade-in zoom-in-95 cursor-default">
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
              className="w-full h-8 text-xs font-medium cursor-pointer"
            >
              Insert {tableRows}×{tableCols} Table
            </Button>
          </div>
        )}
      </div>

      {/* Math Formula Button */}
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onMouseDown={(e) => e.preventDefault()}
        onClick={onOpenInsertMath ?? (() => setMathModalOpen(true))}
        title="Insert math formula (LaTeX)"
        className="h-8 gap-1.5 px-2 text-xs cursor-pointer"
      >
        <Sigma className="size-3.5" />
        <span className="hidden sm:inline text-xs font-medium">Math</span>
      </Button>

      {/* Graph Button */}
      <Button
        id="toolbar-graph"
        type="button"
        variant="ghost"
        size="sm"
        onMouseDown={(e) => e.preventDefault()}
        onClick={onOpenInsertGraph ?? (() => setGraphModalOpen(true))}
        title="Insert handwritten graph"
        className="h-8 gap-1.5 px-2 text-xs cursor-pointer"
      >
        <TrendingUp className="size-3.5" />
        <span className="hidden sm:inline text-xs font-medium">Graph</span>
      </Button>

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

      {/* Math Formula Modal */}
      <MathFormulaModal
        isOpen={mathModalOpen}
        onClose={onCloseMathModal ?? (() => setMathModalOpen(false))}
        initialLatex={mathInitialLatex || (formatState.mathInfo?.latex ?? "")}
        mode={mathModalMode}
        targetElement={mathTargetElement ?? null}
        editorRef={editorRef}
      />

      {/* Graph Insert Modal */}
      <GraphInsertModal
        isOpen={graphModalOpen}
        onClose={onCloseGraphModal ?? (() => setGraphModalOpen(false))}
        initialDefinition={graphInitialDefinition}
        onInsert={(definition) => {
          if (graphModalMode === "edit" && graphTargetBlockId) {
            editorRef.current?.updateGraphBlock(definition, graphTargetBlockId);
          } else {
            editorRef.current?.insertGraphBlock(definition);
          }
        }}
      />
    </div>
  );
}
