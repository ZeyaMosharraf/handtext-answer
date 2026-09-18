import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/primitives";
import { parseMath, layoutMath } from "@/lib/math";
import { DEFAULT_SETTINGS, type HandwritingSettings } from "@/lib/handwriting/types";
import { makeRng } from "@/lib/handwriting/pen";
import { cn } from "@/lib/utils";
import type { RichContentEditorHandle } from "./RichContentEditor";

export interface MathFormulaModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialLatex?: string;
  mode?: "insert" | "update" | "edit";
  targetElement?: HTMLElement | null;
  onConfirm?: (latex: string) => void;
  editorRef?: React.RefObject<RichContentEditorHandle | null>;
}

interface SymbolSnippet {
  label: string;
  tooltip: string;
  snippet: string;
  cursorOffset?: number; // Offset from insertion start for cursor
}

const STRUCTURE_SNIPPETS: SymbolSnippet[] = [
  { label: "a/b", tooltip: "Fraction", snippet: "\\frac{a}{b}", cursorOffset: 6 },
  { label: "x²", tooltip: "Superscript", snippet: "^{2}", cursorOffset: 2 },
  { label: "x₁", tooltip: "Subscript", snippet: "_{1}", cursorOffset: 2 },
  { label: "√x", tooltip: "Square root", snippet: "\\sqrt{x}", cursorOffset: 6 },
  { label: "ⁿ√x", tooltip: "n-th root", snippet: "\\sqrt[n]{x}", cursorOffset: 6 },
  { label: "( )", tooltip: "Parentheses", snippet: "\\left( x \\right)", cursorOffset: 7 },
  { label: "[ ]", tooltip: "Brackets", snippet: "\\left[ x \\right]", cursorOffset: 7 },
  { label: "|x|", tooltip: "Absolute value", snippet: "\\left| x \\right|", cursorOffset: 7 },
];

const GREEK_SNIPPETS: SymbolSnippet[] = [
  { label: "α", tooltip: "\\alpha", snippet: "\\alpha " },
  { label: "β", tooltip: "\\beta", snippet: "\\beta " },
  { label: "θ", tooltip: "\\theta", snippet: "\\theta " },
  { label: "λ", tooltip: "\\lambda", snippet: "\\lambda " },
  { label: "π", tooltip: "\\pi", snippet: "\\pi " },
  { label: "μ", tooltip: "\\mu", snippet: "\\mu " },
  { label: "σ", tooltip: "\\sigma", snippet: "\\sigma " },
  { label: "ω", tooltip: "\\omega", snippet: "\\omega " },
  { label: "Δ", tooltip: "\\Delta", snippet: "\\Delta " },
  { label: "Σ", tooltip: "\\Sigma", snippet: "\\Sigma " },
  { label: "∞", tooltip: "\\infty", snippet: "\\infty " },
];

const OPERATOR_SNIPPETS: SymbolSnippet[] = [
  { label: "±", tooltip: "\\pm", snippet: "\\pm " },
  { label: "≤", tooltip: "\\leq", snippet: "\\leq " },
  { label: "≥", tooltip: "\\geq", snippet: "\\geq " },
  { label: "≠", tooltip: "\\neq", snippet: "\\neq " },
  { label: "≈", tooltip: "\\approx", snippet: "\\approx " },
  { label: "·", tooltip: "\\cdot", snippet: "\\cdot " },
  { label: "×", tooltip: "\\times", snippet: "\\times " },
  { label: "∑", tooltip: "Summation", snippet: "\\sum_{i=1}^{n} ", cursorOffset: 8 },
  { label: "∫", tooltip: "Integral", snippet: "\\int_{a}^{b} ", cursorOffset: 8 },
  { label: "∂", tooltip: "\\partial", snippet: "\\partial " },
];

export interface MatrixState {
  prefix: string;
  suffix: string;
  bracket: "bmatrix" | "pmatrix" | "vmatrix";
  rows: number;
  cols: number;
  cells: string[][];
}

export function extractMatrixFromLatex(latex: string): MatrixState | null {
  const match = latex.match(/\\begin\{((?:b|p|v|B|V)?matrix)\}([\s\S]*?)\\end\{\1\}/);
  if (!match) return null;

  const rawEnv = match[1] || "bmatrix";
  const bracket: "bmatrix" | "pmatrix" | "vmatrix" =
    rawEnv === "pmatrix" ? "pmatrix" : rawEnv === "vmatrix" ? "vmatrix" : "bmatrix";
  const body = match[2] || "";
  const prefix = latex.slice(0, match.index);
  const suffix = latex.slice((match.index ?? 0) + match[0].length);

  const rowStrings = body.split(/\\\\/);
  if (rowStrings.length > 1 && rowStrings[rowStrings.length - 1]!.trim() === "") {
    rowStrings.pop();
  }

  const rawCells = rowStrings.map((rStr) =>
    rStr.split("&").map((cStr) => cStr.trim())
  );

  const rows = Math.max(1, Math.min(6, rawCells.length));
  const cols = Math.max(1, Math.min(6, Math.max(...rawCells.map((r) => r.length))));

  const cells: string[][] = [];
  for (let r = 0; r < rows; r++) {
    cells[r] = [];
    for (let c = 0; c < cols; c++) {
      cells[r]![c] = rawCells[r]?.[c] ?? "";
    }
  }

  return { prefix, suffix, bracket, rows, cols, cells };
}

export function buildMatrixLatex(
  prefix: string,
  bracket: string,
  cells: string[][],
  suffix: string,
): string {
  const rowStrings = cells.map((row) => row.join(" & "));
  const matrixBody = rowStrings.join(" \\\\ ");
  const matrixLatex = `\\begin{${bracket}} ${matrixBody} \\end{${bracket}}`;
  const cleanPrefix = prefix ? `${prefix.trimEnd()} ` : "";
  const cleanSuffix = suffix ? ` ${suffix.trimStart()}` : "";
  return `${cleanPrefix}${matrixLatex}${cleanSuffix}`.trim();
}

export function MathFormulaModal({
  isOpen,
  onClose,
  initialLatex = "",
  mode = "insert",
  targetElement,
  onConfirm,
  editorRef,
}: MathFormulaModalProps) {
  const [latex, setLatex] = useState(initialLatex);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [isMatrixOpen, setIsMatrixOpen] = useState(false);
  const [matrixState, setMatrixState] = useState<MatrixState>({
    prefix: "",
    suffix: "",
    bracket: "bmatrix",
    rows: 2,
    cols: 2,
    cells: [
      ["", ""],
      ["", ""],
    ],
  });
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Sync initialLatex when modal opens or initialLatex changes
  useEffect(() => {
    if (isOpen) {
      setLatex(initialLatex);
      setPreviewError(null);
      const extracted = extractMatrixFromLatex(initialLatex);
      if (extracted) {
        setMatrixState(extracted);
        setIsMatrixOpen(true);
      } else {
        setIsMatrixOpen(false);
      }
      // Focus textarea on open
      setTimeout(() => {
        if (textareaRef.current) {
          textareaRef.current.focus();
          textareaRef.current.select();
        }
      }, 50);
    }
  }, [isOpen, initialLatex]);

  const handleToggleMatrix = () => {
    if (isMatrixOpen) {
      setIsMatrixOpen(false);
      return;
    }

    const extracted = extractMatrixFromLatex(latex);
    if (extracted) {
      setMatrixState(extracted);
      setIsMatrixOpen(true);
      return;
    }

    const newPrefix = latex.trim();
    const defaultCells = [
      ["", ""],
      ["", ""],
    ];
    const newState: MatrixState = {
      prefix: newPrefix ? `${newPrefix} ` : "",
      suffix: "",
      bracket: "bmatrix",
      rows: 2,
      cols: 2,
      cells: defaultCells,
    };
    setMatrixState(newState);
    setIsMatrixOpen(true);
    const updatedLatex = buildMatrixLatex(newState.prefix, newState.bracket, newState.cells, newState.suffix);
    setLatex(updatedLatex);
  };

  const handleCellChange = (r: number, c: number, val: string) => {
    setMatrixState((prev) => {
      const updatedCells = prev.cells.map((row, rIdx) =>
        rIdx === r ? row.map((cellVal, cIdx) => (cIdx === c ? val : cellVal)) : row
      );
      const updatedState = { ...prev, cells: updatedCells };
      const updatedLatex = buildMatrixLatex(
        updatedState.prefix,
        updatedState.bracket,
        updatedState.cells,
        updatedState.suffix
      );
      setLatex(updatedLatex);
      return updatedState;
    });
  };

  const handlePrefixChange = (newPrefix: string) => {
    setMatrixState((prev) => {
      const updatedState = { ...prev, prefix: newPrefix };
      const updatedLatex = buildMatrixLatex(
        updatedState.prefix,
        updatedState.bracket,
        updatedState.cells,
        updatedState.suffix
      );
      setLatex(updatedLatex);
      return updatedState;
    });
  };

  const handleDimensionsChange = (newRows: number, newCols: number) => {
    const clampedRows = Math.max(1, Math.min(6, newRows));
    const clampedCols = Math.max(1, Math.min(6, newCols));

    setMatrixState((prev) => {
      const newCells: string[][] = [];
      for (let r = 0; r < clampedRows; r++) {
        newCells[r] = [];
        for (let c = 0; c < clampedCols; c++) {
          newCells[r]![c] = prev.cells[r]?.[c] ?? "";
        }
      }
      const updatedState = {
        ...prev,
        rows: clampedRows,
        cols: clampedCols,
        cells: newCells,
      };
      const updatedLatex = buildMatrixLatex(
        updatedState.prefix,
        updatedState.bracket,
        updatedState.cells,
        updatedState.suffix
      );
      setLatex(updatedLatex);
      return updatedState;
    });
  };

  const handleBracketChange = (bracket: "bmatrix" | "pmatrix" | "vmatrix") => {
    setMatrixState((prev) => {
      const updatedState = { ...prev, bracket };
      const updatedLatex = buildMatrixLatex(
        updatedState.prefix,
        updatedState.bracket,
        updatedState.cells,
        updatedState.suffix
      );
      setLatex(updatedLatex);
      return updatedState;
    });
  };

  const handleCellKeyDown = (
    e: React.KeyboardEvent<HTMLInputElement>,
    r: number,
    c: number,
  ) => {
    if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
      e.preventDefault();
      handleSubmit();
      return;
    }
    if (e.key === "Enter") {
      e.preventDefault();
      let nextR = r;
      let nextC = c + 1;
      if (nextC >= matrixState.cols) {
        nextC = 0;
        nextR = r + 1;
      }
      if (nextR < matrixState.rows) {
        const nextInput = document.getElementById(`matrix-cell-${nextR}-${nextC}`);
        nextInput?.focus();
      }
    }
  };

  // Insert a symbol/structure snippet at the current textarea cursor position
  const handleInsertSnippet = useCallback((snippet: string, cursorOffset?: number) => {
    const textarea = textareaRef.current;
    if (!textarea) {
      setLatex((prev) => prev + snippet);
      return;
    }

    const start = textarea.selectionStart ?? latex.length;
    const end = textarea.selectionEnd ?? latex.length;
    const before = latex.substring(0, start);
    const after = latex.substring(end);
    const updated = before + snippet + after;
    setLatex(updated);

    const newPos = cursorOffset !== undefined ? start + cursorOffset : start + snippet.length;
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(newPos, newPos);
    }, 0);
  }, [latex]);

  // Live Canvas Preview with debouncing
  useEffect(() => {
    if (!isOpen) return;

    const timer = setTimeout(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      const trimmed = latex.trim();
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      // Handle high-DPI crisp rendering
      const dpr = window.devicePixelRatio || 1;
      const cssWidth = canvas.clientWidth || 460;
      const cssHeight = Math.max(124, canvas.clientHeight || 124);

      if (canvas.width !== cssWidth * dpr || canvas.height !== cssHeight * dpr) {
        canvas.width = cssWidth * dpr;
        canvas.height = cssHeight * dpr;
      }

      ctx.save();
      ctx.scale(dpr, dpr);
      ctx.clearRect(0, 0, cssWidth, cssHeight);

      if (!latex.trim()) {
        ctx.fillStyle = "#9ca3af";
        ctx.font = "13px ui-sans-serif, system-ui, sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText("Type a LaTeX formula to see handwritten preview", cssWidth / 2, cssHeight / 2);
        ctx.restore();
        setPreviewError(null);
        return;
      }

      try {
        const settings: HandwritingSettings = {
          ...DEFAULT_SETTINGS,
          fontSize: 22,
          lineSpacing: 1.4,
        };

        const ast = parseMath(latex.trimStart());
        const box = layoutMath(ast, ctx, settings, 1.0);

        // Center vertically so multi-row matrices never clip
        const centerY = (box.descent - box.ascent) / 2;
        const baselineY = Math.round(cssHeight / 2 - centerY);

        // Draw light ruled background line to indicate math baseline alignment
        ctx.strokeStyle = "rgba(59, 130, 246, 0.18)";
        ctx.lineWidth = 1;
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ctx.moveTo(12, baselineY);
        ctx.lineTo(cssWidth - 12, baselineY);
        ctx.stroke();
        ctx.setLineDash([]);

        // Center horizontally if fits, otherwise align left with padding
        const originX = box.width < cssWidth - 40
          ? Math.round((cssWidth - box.width) / 2)
          : 20;

        // Use fixed RNG seed for preview stability while typing
        const previewRng = makeRng(42);
        const inkColor = "#1d3fb5"; // Classic blue

        box.draw(ctx, originX, baselineY, settings, previewRng, inkColor);
        setPreviewError(null);
      } catch (err: unknown) {
        setPreviewError(err instanceof Error ? err.message : "Math preview error");
      } finally {
        ctx.restore();
      }
    }, 60);

    return () => clearTimeout(timer);
  }, [isOpen, latex]);

  const handleClose = useCallback(() => {
    editorRef?.current?.clearActiveMathElement?.();
    onClose();
  }, [editorRef, onClose]);

  const handleSubmit = useCallback(() => {
    const trimmed = latex.trim();
    if (!trimmed) return;

    if (onConfirm) {
      onConfirm(trimmed);
    } else if (editorRef?.current) {
      if (mode === "update" || mode === "edit") {
        editorRef.current.updateMathBlock(trimmed, targetElement);
      } else {
        editorRef.current.insertMathBlock(trimmed);
      }
    }
    handleClose();
  }, [latex, onConfirm, editorRef, mode, targetElement, handleClose]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
      e.preventDefault();
      handleSubmit();
    }
  };

  const isEditMode = mode === "update" || mode === "edit";

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="max-w-xl p-5 sm:max-w-2xl">
        <DialogHeader className="space-y-1">
          <DialogTitle className="text-base font-semibold flex items-center gap-2">
            <span className="flex size-6 items-center justify-center rounded bg-primary/10 text-xs font-serif text-primary">
              ∑
            </span>
            {isEditMode ? "Edit Math Formula" : "Insert Math Formula"}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3 py-1">
          {/* Quick-insert toolbar */}
          <div className="space-y-2 rounded-lg border border-border/70 bg-muted/30 p-2 text-xs">
            {/* Structures */}
            <div className="flex flex-wrap items-center gap-1">
              <span className="mr-1 text-[11px] font-medium text-muted-foreground">Structures:</span>
              {STRUCTURE_SNIPPETS.map((s) => (
                <button
                  key={s.label}
                  type="button"
                  title={s.tooltip}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => handleInsertSnippet(s.snippet, s.cursorOffset)}
                  className="rounded border border-border/80 bg-background px-2 py-0.5 font-mono text-[11px] font-medium text-foreground shadow-2xs hover:bg-accent hover:text-accent-foreground cursor-pointer"
                >
                  {s.label}
                </button>
              ))}
              <button
                type="button"
                title="Matrix structure & grid editor"
                onMouseDown={(e) => e.preventDefault()}
                onClick={handleToggleMatrix}
                className={cn(
                  "rounded border px-2 py-0.5 font-mono text-[11px] font-medium shadow-2xs cursor-pointer transition-colors",
                  isMatrixOpen
                    ? "border-primary bg-primary text-primary-foreground font-semibold"
                    : "border-border/80 bg-background text-foreground hover:bg-accent hover:text-accent-foreground"
                )}
              >
                [⬚] Matrix
              </button>
            </div>

            {/* Greek Letters */}
            <div className="flex flex-wrap items-center gap-1">
              <span className="mr-1 text-[11px] font-medium text-muted-foreground">Greek:</span>
              {GREEK_SNIPPETS.map((s) => (
                <button
                  key={s.label}
                  type="button"
                  title={s.tooltip}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => handleInsertSnippet(s.snippet, s.cursorOffset)}
                  className="rounded border border-border/80 bg-background px-1.5 py-0.5 text-[12px] text-foreground shadow-2xs hover:bg-accent hover:text-accent-foreground cursor-pointer"
                >
                  {s.label}
                </button>
              ))}
            </div>

            {/* Operators */}
            <div className="flex flex-wrap items-center gap-1">
              <span className="mr-1 text-[11px] font-medium text-muted-foreground">Operators:</span>
              {OPERATOR_SNIPPETS.map((s) => (
                <button
                  key={s.label}
                  type="button"
                  title={s.tooltip}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => handleInsertSnippet(s.snippet, s.cursorOffset)}
                  className="rounded border border-border/80 bg-background px-1.5 py-0.5 text-[12px] text-foreground shadow-2xs hover:bg-accent hover:text-accent-foreground cursor-pointer"
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          {/* Interactive Matrix Editor Grid */}
          {isMatrixOpen && (
            <div className="space-y-2.5 rounded-lg border border-primary/40 bg-primary/5 p-3 text-xs">
              {/* Header with Title, Bracket, Dimensions & Presets */}
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/50 pb-2">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-foreground flex items-center gap-1.5 text-[12px]">
                    <span className="flex size-4 items-center justify-center rounded bg-primary/20 text-[10px] font-mono text-primary font-bold">
                      M
                    </span>
                    Matrix Editor
                  </span>
                  {/* Bracket style selector */}
                  <div className="flex items-center gap-1 ml-2">
                    {(
                      [
                        { id: "bmatrix", label: "[ ]", title: "Square brackets" },
                        { id: "pmatrix", label: "( )", title: "Parentheses" },
                        { id: "vmatrix", label: "| |", title: "Vertical bars (determinant)" },
                      ] as const
                    ).map((b) => (
                      <button
                        key={b.id}
                        type="button"
                        title={b.title}
                        onClick={() => handleBracketChange(b.id)}
                        className={cn(
                          "rounded px-1.5 py-0.5 font-mono text-[11px] font-medium border cursor-pointer",
                          matrixState.bracket === b.id
                            ? "border-primary bg-primary text-primary-foreground"
                            : "border-border/80 bg-background text-foreground hover:bg-accent"
                        )}
                      >
                        {b.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Dimension controls */}
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-1">
                    <span className="text-[11px] text-muted-foreground font-medium">Rows:</span>
                    <button
                      type="button"
                      onClick={() => handleDimensionsChange(matrixState.rows - 1, matrixState.cols)}
                      disabled={matrixState.rows <= 1}
                      className="flex size-5 items-center justify-center rounded border border-border bg-background text-foreground disabled:opacity-40 hover:bg-accent cursor-pointer"
                    >
                      -
                    </button>
                    <span className="font-mono text-xs w-3 text-center">{matrixState.rows}</span>
                    <button
                      type="button"
                      onClick={() => handleDimensionsChange(matrixState.rows + 1, matrixState.cols)}
                      disabled={matrixState.rows >= 6}
                      className="flex size-5 items-center justify-center rounded border border-border bg-background text-foreground disabled:opacity-40 hover:bg-accent cursor-pointer"
                    >
                      +
                    </button>
                  </div>

                  <div className="flex items-center gap-1">
                    <span className="text-[11px] text-muted-foreground font-medium">Cols:</span>
                    <button
                      type="button"
                      onClick={() => handleDimensionsChange(matrixState.rows, matrixState.cols - 1)}
                      disabled={matrixState.cols <= 1}
                      className="flex size-5 items-center justify-center rounded border border-border bg-background text-foreground disabled:opacity-40 hover:bg-accent cursor-pointer"
                    >
                      -
                    </button>
                    <span className="font-mono text-xs w-3 text-center">{matrixState.cols}</span>
                    <button
                      type="button"
                      onClick={() => handleDimensionsChange(matrixState.rows, matrixState.cols + 1)}
                      disabled={matrixState.cols >= 6}
                      className="flex size-5 items-center justify-center rounded border border-border bg-background text-foreground disabled:opacity-40 hover:bg-accent cursor-pointer"
                    >
                      +
                    </button>
                  </div>

                  {/* Dimension presets */}
                  <div className="hidden sm:flex items-center gap-1 border-l border-border/50 pl-2">
                    {["1×1", "1×2", "2×1", "2×2", "2×3", "3×2", "3×3"].map((preset) => {
                      const [r, c] = preset.split("×").map(Number);
                      const isActive = matrixState.rows === r && matrixState.cols === c;
                      return (
                        <button
                          key={preset}
                          type="button"
                          onClick={() => handleDimensionsChange(r!, c!)}
                          className={cn(
                            "rounded px-1 py-0.5 text-[10px] font-mono border cursor-pointer",
                            isActive
                              ? "border-primary bg-primary text-primary-foreground font-bold"
                              : "border-border/70 bg-background text-muted-foreground hover:text-foreground"
                          )}
                        >
                          {preset}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Optional prefix input */}
              <div className="flex items-center gap-2">
                <label htmlFor="matrix-prefix" className="text-[11px] font-medium text-muted-foreground whitespace-nowrap">
                  Formula Prefix:
                </label>
                <input
                  id="matrix-prefix"
                  type="text"
                  value={matrixState.prefix}
                  onChange={(e) => handlePrefixChange(e.target.value)}
                  placeholder="e.g. C = or A + "
                  className="h-6 w-32 rounded border border-input bg-background px-2 font-mono text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                />
                <span className="text-[10px] text-muted-foreground ml-auto">
                  Tab/Enter to navigate cells
                </span>
              </div>

              {/* Interactive Matrix Grid with bracket styling */}
              <div className="flex items-center justify-center py-1">
                <div className="flex items-center">
                  {/* Left bracket border */}
                  <div
                    className={cn(
                      "w-1.5 self-stretch border-t-2 border-b-2",
                      matrixState.bracket === "pmatrix"
                        ? "border-l-2 rounded-l-md border-foreground/60"
                        : matrixState.bracket === "vmatrix"
                        ? "border-l-2 border-t-0 border-b-0 border-foreground/60"
                        : "border-l-2 rounded-l-xs border-foreground/60"
                    )}
                  />

                  {/* Cells grid */}
                  <div
                    className="grid gap-1.5 p-2 bg-background/50 rounded"
                    style={{
                      gridTemplateColumns: `repeat(${matrixState.cols}, minmax(54px, 1fr))`,
                    }}
                  >
                    {matrixState.cells.map((row, r) =>
                      row.map((val, c) => (
                        <input
                          key={`cell_${r}_${c}`}
                          id={`matrix-cell-${r}-${c}`}
                          type="text"
                          value={val}
                          onChange={(e) => handleCellChange(r, c, e.target.value)}
                          onKeyDown={(e) => handleCellKeyDown(e, r, c)}
                          placeholder={`r${r + 1}c${c + 1}`}
                          className="h-7 w-full rounded border border-border bg-background px-1.5 text-center font-mono text-xs text-foreground placeholder:text-muted-foreground/40 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                        />
                      ))
                    )}
                  </div>

                  {/* Right bracket border */}
                  <div
                    className={cn(
                      "w-1.5 self-stretch border-t-2 border-b-2",
                      matrixState.bracket === "pmatrix"
                        ? "border-r-2 rounded-r-md border-foreground/60"
                        : matrixState.bracket === "vmatrix"
                        ? "border-r-2 border-t-0 border-b-0 border-foreground/60"
                        : "border-r-2 rounded-r-xs border-foreground/60"
                    )}
                  />
                </div>
              </div>
            </div>
          )}

          {/* LaTeX Input Textarea */}
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <label htmlFor="math-latex-input" className="text-xs font-medium text-muted-foreground">
                LaTeX Expression
              </label>
              <span className="text-[10px] text-muted-foreground">Ctrl+Enter to insert</span>
            </div>
            <textarea
              id="math-latex-input"
              ref={textareaRef}
              rows={3}
              value={latex}
              onChange={(e) => {
                setLatex(e.target.value);
                const extracted = extractMatrixFromLatex(e.target.value);
                if (extracted) {
                  setMatrixState(extracted);
                }
              }}
              onKeyDown={handleKeyDown}
              placeholder="e.g. \frac{-b \pm \sqrt{b^2 - 4ac}}{2a}"
              className="w-full resize-y rounded-md border border-input bg-background px-3 py-2 font-mono text-xs text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              spellCheck={false}
            />
          </div>

          {/* Live Preview Canvas */}
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground">Handwritten Preview</span>
              {previewError && <span className="text-[11px] text-destructive">{previewError}</span>}
            </div>
            <div className="flex min-h-[126px] max-h-[160px] w-full items-center justify-center overflow-x-auto rounded-md border border-border bg-card/60 p-1">
              <canvas
                ref={canvasRef}
                className="h-[124px] w-full rounded"
                style={{ imageRendering: "crisp-edges" }}
              />
            </div>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button type="button" variant="outline" size="sm" onClick={handleClose} className="cursor-pointer">
            Cancel
          </Button>
          <Button
            type="button"
            variant="primary"
            size="sm"
            disabled={!latex.trim()}
            onClick={handleSubmit}
            className="cursor-pointer"
          >
            {isEditMode ? "Update Formula" : "Insert Formula"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
