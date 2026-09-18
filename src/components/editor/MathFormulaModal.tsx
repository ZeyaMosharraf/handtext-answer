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
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Sync initialLatex when modal opens or initialLatex changes
  useEffect(() => {
    if (isOpen) {
      setLatex(initialLatex);
      setPreviewError(null);
      // Focus textarea on open
      setTimeout(() => {
        if (textareaRef.current) {
          textareaRef.current.focus();
          textareaRef.current.select();
        }
      }, 50);
    }
  }, [isOpen, initialLatex]);

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
      const cssHeight = 110;

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

        // Draw light ruled background line to indicate math baseline alignment
        const baselineY = Math.round(cssHeight * 0.58);
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
              onChange={(e) => setLatex(e.target.value)}
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
            <div className="flex h-[112px] w-full items-center justify-center overflow-x-auto rounded-md border border-border bg-card/60 p-1">
              <canvas
                ref={canvasRef}
                className="h-[110px] w-full rounded"
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
