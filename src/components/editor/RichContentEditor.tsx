/**
 * src/components/editor/RichContentEditor.tsx
 *
 * Monolithic ContentEditable Document Editor with Computer-Style Digital Math & Graphs.
 *
 * Core Product Invariants:
 * 1. Monolithic ContentEditable: A single continuous editing surface with 100% native browser
 *    contenteditable behavior — guaranteeing that typing text, pressing spaces, consecutive spaces,
 *    indentation, blank lines, Enter, Backspace, and text selections work without bugs or regressions.
 * 2. Left = Digital / Computer Typography:
 *    - Math blocks display clean computer-style mathematical typography via renderDigitalMathToHtml (STIX Two Math, stacked fractions, radicals, superscripts).
 *    - Graph blocks display clean digital preview cards with metadata.
 *    - Tables display interactive digital cells with keyboard Tab navigation and alignment.
 * 3. Right = Handwritten Preview:
 *    - The handwriting renderer consumes the emitted HTML, rendering handwritten math,
 *      ruled notebook lines, handwritten text, and plotted graphs.
 */

import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from "react";
import { HIGHLIGHT_COLOR, isHtmlContent, migrateLegacyContentToHtml } from "@/lib/handwriting/parse";
import {
  type TableSelectionInfo,
  getTableSelectionInfo,
  insertTableRow as domInsertTableRow,
  deleteTableRow as domDeleteTableRow,
  insertTableColumn as domInsertTableColumn,
  deleteTableColumn as domDeleteTableColumn,
  setTableColumnAlignment as domSetTableColumnAlignment,
  handleTableTabNavigation,
} from "@/lib/table-dom";
import type { GraphDefinition } from "@/lib/graph/types";
import { renderDigitalMathToHtml } from "@/lib/math/digitalRenderer";
import { cn } from "@/lib/utils";
import { generateBlockId } from "@/types/document";
import {
  serializeMathBlockToClipboard,
  deserializeMathBlockFromClipboard,
  type MathClipboardPayload,
} from "@/lib/editor/mathClipboard";

export interface FormatState {
  bold: boolean;
  italic: boolean;
  underline: boolean;
  blackInk: boolean;
  color?: string | undefined;
  scale?: number | undefined;
  highlight?: string | undefined;
  hasSelection: boolean;
  selectionRect?: { top: number; left: number; width: number; height: number } | undefined;
  tableInfo?: TableSelectionInfo | undefined;
  /** Present when the cursor is inside or adjacent to a math-block element */
  mathInfo?: { latex: string; element: HTMLElement } | undefined;
}

export interface RichContentEditorHandle {
  toggleBold: () => void;
  toggleItalic: () => void;
  toggleUnderline: () => void;
  toggleBlackInk: () => void;
  setFontScale: (scale: number | null) => void;
  setTextColor: (color: string | null) => void;
  setHighlight: (color: string | null) => void;
  clearFormatting: () => void;
  insertTable: (rows: number, cols: number) => void;
  insertTableRow: (relative: "above" | "below") => void;
  deleteTableRow: () => void;
  insertTableColumn: (relative: "left" | "right") => void;
  deleteTableColumn: () => void;
  setTableColumnAlignment: (colIndex: number, alignment: "left" | "center" | "right") => void;
  getTableInfo: () => TableSelectionInfo | null;
  /** Insert a new math block at the current cursor position */
  insertMathBlock: (latex: string) => void;
  /** Update the latex of the specified or focused math-block element */
  updateMathBlock: (latex: string, targetEl?: HTMLElement | null) => void;
  /** Clear any active math element reference */
  clearActiveMathElement: () => void;
  /** Return the latex of the math-block the cursor is currently in/adjacent to */
  getMathInfo: () => { latex: string } | null;
  /** Insert a new handwritten graph block at the current cursor position */
  insertGraphBlock: (definition: GraphDefinition) => void;
  /** Update the definition of the specified or focused graph-block */
  updateGraphBlock: (definition: GraphDefinition, targetBlockId?: string | null) => void;
  focus: () => void;
  getFormatState: () => FormatState;
}

interface RichContentEditorProps {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string | undefined;
  className?: string | undefined;
  onFormatChange?: ((state: FormatState) => void) | undefined;
  onMathBlockClick?: ((latex: string, element: HTMLElement) => void) | undefined;
  onGraphBlockClick?: ((definition: GraphDefinition, blockId: string) => void) | undefined;
}

function rgbToHex(rgbStr: string): string | null {
  const m = rgbStr.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/i);
  if (!m || !m[1] || !m[2] || !m[3]) return null;
  const r = parseInt(m[1], 10).toString(16).padStart(2, "0");
  const g = parseInt(m[2], 10).toString(16).padStart(2, "0");
  const b = parseInt(m[3], 10).toString(16).padStart(2, "0");
  return `#${r}${g}${b}`;
}

function sanitizeForEditor(rawHtml: string): string {
  if (!rawHtml) return "<p><br></p>";
  // Strip top-level text block wrappers if present from hybrid serialization
  let clean = rawHtml.replace(/<div\s+[^>]*data-block-type=["']text["'][^>]*>([\s\S]*?)<\/div>/gi, "$1");
  while (/^<div[^>]*data-block-type=["']text["'][^>]*>([\s\S]*)<\/div>$/i.test(clean.trim())) {
    clean = clean.trim().replace(/^<div[^>]*data-block-type=["']text["'][^>]*>/i, "").replace(/<\/div>$/i, "");
  }
  return clean || "<p><br></p>";
}

export const MATH_INK_COLORS = [
  { id: "blue", label: "Classic Blue", hex: "#1d3fb5" },
  { id: "royal", label: "Royal Blue", hex: "#174ea6" },
  { id: "black", label: "Black", hex: "#141821" },
  { id: "red", label: "Red", hex: "#b3231f" },
  { id: "green", label: "Green", hex: "#146b3a" },
  { id: "purple", label: "Purple", hex: "#7e22ce" },
];

function formatMathBlockInner(latex: string, color?: string): string {
  const digitalHtml = renderDigitalMathToHtml(latex);
  const colorStyle = color ? `color:${color};` : "";
  const swatchBg = color || "#1d3fb5";
  return `<span class="math-digital-content" style="display:inline-flex;align-items:center;vertical-align:middle;${colorStyle}">${digitalHtml}</span><span class="math-chip-actions" style="display:inline-flex;align-items:center;gap:3px;margin-left:6px;opacity:0.8;font-size:11px;font-family:sans-serif;"><span class="math-chip-color" title="Math ink color" style="cursor:pointer;display:inline-flex;align-items:center;gap:3px;padding:1px 5px;border-radius:4px;background:rgba(0,0,0,0.06);font-weight:500;"><span class="math-color-swatch" style="display:inline-block;width:7px;height:7px;border-radius:50%;background-color:${swatchBg};border:1px solid rgba(0,0,0,0.25);"></span>Color</span><span class="math-chip-copy" title="Copy formula (Ctrl+C)" style="cursor:pointer;padding:1px 5px;border-radius:4px;background:rgba(0,0,0,0.06);font-weight:500;">Copy</span><span class="math-chip-edit" title="Edit formula" style="cursor:pointer;padding:1px 5px;border-radius:4px;background:rgba(0,0,0,0.06);font-weight:500;">Edit</span></span>`;
}

function formatGraphBlockInner(definition: GraphDefinition): string {
  const title = definition.title || `${definition.type} graph`;
  const escTitle = title.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  return `<span style="display:inline-flex;align-items:center;gap:6px;"><span style="font-size:1.1em;">📊</span><span style="font-family:sans-serif;font-weight:600;font-size:12px;">${escTitle}</span></span><span class="graph-chip-actions" style="display:inline-flex;align-items:center;gap:3px;margin-left:6px;opacity:0.65;font-size:11px;font-family:sans-serif;"><span class="graph-chip-edit" style="cursor:pointer;padding:1px 5px;border-radius:4px;background:rgba(0,0,0,0.06);font-weight:500;">Edit</span></span>`;
}

export const RichContentEditor = forwardRef<RichContentEditorHandle, RichContentEditorProps>(
  ({ value, onChange, placeholder, className, onFormatChange, onMathBlockClick, onGraphBlockClick }, ref) => {
    const editorRef = useRef<HTMLDivElement>(null);
    const lastValueRef = useRef<string>("");
    const isInternalChangeRef = useRef(false);
    const savedRangeRef = useRef<Range | null>(null);

    const [formatState, setFormatState] = useState<FormatState>({
      bold: false,
      italic: false,
      underline: false,
      blackInk: false,
      hasSelection: false,
    });

    const [mathColorMenu, setMathColorMenu] = useState<{
      mathBlock: HTMLElement;
      top: number;
      left: number;
      currentColor: string | undefined;
    } | null>(null);

    useEffect(() => {
      if (!mathColorMenu) return;
      const handleClickOutside = (e: MouseEvent) => {
        const popover = document.getElementById("math-block-color-popover");
        if (popover && !popover.contains(e.target as Node)) {
          setMathColorMenu(null);
        }
      };
      const handleScroll = () => setMathColorMenu(null);
      const handleKey = (e: KeyboardEvent) => {
        if (e.key === "Escape") setMathColorMenu(null);
      };
      document.addEventListener("mousedown", handleClickOutside);
      window.addEventListener("scroll", handleScroll, true);
      window.addEventListener("keydown", handleKey);
      return () => {
        document.removeEventListener("mousedown", handleClickOutside);
        window.removeEventListener("scroll", handleScroll, true);
        window.removeEventListener("keydown", handleKey);
      };
    }, [mathColorMenu]);

    const queryActiveFormats = useCallback((): FormatState => {
      if (typeof document === "undefined" || !editorRef.current) {
        return { bold: false, italic: false, underline: false, blackInk: false, hasSelection: false };
      }
      const bold = document.queryCommandState("bold");
      const italic = document.queryCommandState("italic");
      const underline = document.queryCommandState("underline");

      const sel = window.getSelection();
      let hasSelection = false;
      let selectionRect: { top: number; left: number; width: number; height: number } | undefined = undefined;

      let color: string | undefined = undefined;
      let scale: number | undefined = undefined;
      let highlight: string | undefined = undefined;
      let blackInk = false;

      if (sel && sel.rangeCount > 0) {
        if (!sel.isCollapsed && editorRef.current.contains(sel.anchorNode)) {
          const range = sel.getRangeAt(0);
          const rect = range.getBoundingClientRect();
          if (rect.width > 0 && rect.height > 0) {
            hasSelection = true;
            selectionRect = {
              top: rect.top,
              left: rect.left,
              width: rect.width,
              height: rect.height,
            };
          }
        }

        let node: Node | null = sel.anchorNode;
        while (node && node !== editorRef.current && node !== document.body) {
          if (node.nodeType === 1) {
            const el = node as HTMLElement;
            // Detect scale
            if (!scale) {
              const dataScale = el.getAttribute("data-scale");
              if (dataScale) {
                const s = parseFloat(dataScale);
                if (!isNaN(s)) scale = s;
              } else if (el.style?.fontSize) {
                const fs = el.style.fontSize;
                if (fs.includes("em")) {
                  const s = parseFloat(fs);
                  if (!isNaN(s)) scale = s;
                }
              }
            }

            // Detect color
            if (!color) {
              const fontColor = el.getAttribute("color");
              const styleColor = el.style?.color;
              const rawColor = fontColor || styleColor;
              if (rawColor && rawColor !== "inherit") {
                color = rawColor.startsWith("rgb") ? (rgbToHex(rawColor) ?? rawColor) : rawColor;
              }
            }

            // Detect highlight
            if (!highlight) {
              const dataHigh = el.getAttribute("data-highlight");
              const bg = el.style?.backgroundColor;
              if (dataHigh && dataHigh !== "transparent") {
                highlight = dataHigh;
              } else if (bg && bg !== "transparent" && bg !== "inherit") {
                highlight = bg.startsWith("rgb") ? (rgbToHex(bg) ?? bg) : bg;
              } else if (el.tagName === "MARK") {
                highlight = "#fef08a";
              }
            }
          }
          node = node.parentNode;
        }
      }

      if (
        color === HIGHLIGHT_COLOR ||
        color?.toLowerCase() === "#141821" ||
        color?.includes("141821") ||
        color?.includes("20, 24, 33") ||
        color?.includes("20,24,33")
      ) {
        blackInk = true;
      }

      const tableInfo = getTableSelectionInfo(editorRef.current);

      // Detect math block ancestry
      let mathInfo: { latex: string; element: HTMLElement } | undefined = undefined;
      if (sel && sel.rangeCount > 0) {
        let checkNode: Node | null = sel.anchorNode;
        while (checkNode && checkNode !== editorRef.current) {
          if (checkNode.nodeType === 1) {
            const el = checkNode as HTMLElement;
            if (el.classList.contains("math-block")) {
              const latex = el.getAttribute("data-latex") ?? "";
              if (latex) {
                mathInfo = { latex, element: el };
                break;
              }
            }
          }
          checkNode = checkNode.parentNode;
        }
      }

      return {
        bold,
        italic,
        underline,
        blackInk,
        color,
        scale,
        highlight,
        hasSelection,
        selectionRect,
        tableInfo: tableInfo ?? undefined,
        mathInfo,
      };
    }, []);

    const updateFormatState = useCallback(() => {
      const state = queryActiveFormats();
      setFormatState(state);
      onFormatChange?.(state);
    }, [queryActiveFormats, onFormatChange]);

    // Selection change tracking & range preservation
    const saveSelection = useCallback(() => {
      if (typeof window === "undefined" || !editorRef.current) return;
      const sel = window.getSelection();
      if (sel && sel.rangeCount > 0 && editorRef.current.contains(sel.anchorNode)) {
        savedRangeRef.current = sel.getRangeAt(0).cloneRange();
      }
    }, []);

    useEffect(() => {
      const handleSelectionChange = () => {
        if (!editorRef.current) return;
        const sel = window.getSelection();
        if (sel && sel.anchorNode && editorRef.current.contains(sel.anchorNode)) {
          savedRangeRef.current = sel.getRangeAt(0).cloneRange();
          updateFormatState();
        }
      };
      document.addEventListener("selectionchange", handleSelectionChange);
      return () => document.removeEventListener("selectionchange", handleSelectionChange);
    }, [updateFormatState]);

    const triggerChange = useCallback(() => {
      const el = editorRef.current;
      if (!el) return;
      const html = el.innerHTML;
      lastValueRef.current = html;
      isInternalChangeRef.current = true;
      onChange(html);
      updateFormatState();
    }, [onChange, updateFormatState]);

    // Hydrate digital representations for any resting math/graph blocks
    const hydrateBlockPresentations = useCallback((container: HTMLElement) => {
      const mathElements = container.querySelectorAll<HTMLElement>(".math-block[data-latex]");
      mathElements.forEach((mEl) => {
        const latex = mEl.getAttribute("data-latex") ?? "";
        const color = mEl.getAttribute("data-color") || undefined;
        if (latex && (!mEl.querySelector(".math-digital-content") || !mEl.querySelector(".math-chip-color"))) {
          mEl.innerHTML = formatMathBlockInner(latex, color);
        }
      });
      const graphElements = container.querySelectorAll<HTMLElement>(".graph-block[data-graph-definition]");
      graphElements.forEach((gEl) => {
        const defStr = gEl.getAttribute("data-graph-definition") ?? "";
        if (defStr && !gEl.querySelector(".graph-chip-actions")) {
          try {
            const def = JSON.parse(defStr) as GraphDefinition;
            gEl.innerHTML = formatGraphBlockInner(def);
          } catch {}
        }
      });
    }, []);

    // Initial mount and external changes (e.g. undo/redo, template load, AI suggestions)
    useEffect(() => {
      const el = editorRef.current;
      if (!el) return;

      const sanitized = sanitizeForEditor(value);
      const normalized = migrateLegacyContentToHtml(sanitized);

      if (isInternalChangeRef.current) {
        isInternalChangeRef.current = false;
        lastValueRef.current = normalized;
        return;
      }

      if (el.innerHTML !== normalized) {
        el.innerHTML = normalized;
        hydrateBlockPresentations(el);
        lastValueRef.current = normalized;
        updateFormatState();
      }
    }, [value, updateFormatState, hydrateBlockPresentations]);

    const toggleBold = useCallback(() => {
      const el = editorRef.current;
      if (!el) return;
      el.focus();
      document.execCommand("bold", false);
      triggerChange();
    }, [triggerChange]);

    const toggleItalic = useCallback(() => {
      const el = editorRef.current;
      if (!el) return;
      el.focus();
      document.execCommand("italic", false);
      triggerChange();
    }, [triggerChange]);

    const toggleUnderline = useCallback(() => {
      const el = editorRef.current;
      if (!el) return;
      el.focus();
      document.execCommand("underline", false);
      triggerChange();
    }, [triggerChange]);

    const toggleBlackInk = useCallback(() => {
      const el = editorRef.current;
      if (!el) return;
      el.focus();
      if (formatState.blackInk) {
        document.execCommand("foreColor", false, "inherit");
      } else {
        document.execCommand("foreColor", false, HIGHLIGHT_COLOR);
      }
      triggerChange();
    }, [formatState.blackInk, triggerChange]);

    const setFontScale = useCallback(
      (scale: number | null) => {
        const el = editorRef.current;
        if (!el) return;
        el.focus();

        if (!scale || scale === 1.0) {
          document.execCommand("fontSize", false, "3");
          const fonts = el.querySelectorAll('font[size="3"]');
          fonts.forEach((f) => {
            const span = document.createElement("span");
            span.innerHTML = f.innerHTML;
            f.replaceWith(span);
          });
        } else {
          document.execCommand("fontSize", false, "7");
          const fonts = el.querySelectorAll('font[size="7"]');
          fonts.forEach((f) => {
            const span = document.createElement("span");
            span.setAttribute("data-scale", String(scale));
            span.style.fontSize = `${scale}em`;
            span.innerHTML = f.innerHTML;
            f.replaceWith(span);
          });
        }
        triggerChange();
      },
      [triggerChange],
    );

    const setTextColor = useCallback(
      (color: string | null) => {
        const el = editorRef.current;
        if (!el) return;
        el.focus();
        if (!color || color === "inherit") {
          document.execCommand("foreColor", false, "inherit");
        } else {
          document.execCommand("foreColor", false, color);
        }
        triggerChange();
      },
      [triggerChange],
    );

    const setHighlight = useCallback(
      (color: string | null) => {
        const el = editorRef.current;
        if (!el) return;
        el.focus();
        if (!color || color === "transparent") {
          document.execCommand("hiliteColor", false, "transparent");
          document.execCommand("backColor", false, "transparent");
        } else {
          const success = document.execCommand("hiliteColor", false, color);
          if (!success) {
            document.execCommand("backColor", false, color);
          }
        }
        triggerChange();
      },
      [triggerChange],
    );

    const clearFormatting = useCallback(() => {
      const el = editorRef.current;
      if (!el) return;
      el.focus();
      document.execCommand("removeFormat", false);
      document.execCommand("foreColor", false, "inherit");
      document.execCommand("hiliteColor", false, "transparent");
      document.execCommand("backColor", false, "transparent");

      const sel = window.getSelection();
      if (sel && sel.rangeCount > 0) {
        let node: Node | null = sel.anchorNode;
        while (node && node !== el) {
          if (node.nodeType === 1) {
            const elem = node as HTMLElement;
            if (elem.hasAttribute("data-scale") || elem.hasAttribute("data-highlight") || elem.tagName === "MARK") {
              const text = elem.innerText;
              elem.replaceWith(document.createTextNode(text));
              break;
            }
          }
          node = node.parentNode;
        }
      }
      triggerChange();
    }, [triggerChange]);

    const insertTable = useCallback(
      (rows: number, cols: number) => {
        const el = editorRef.current;
        if (!el) return;
        el.focus();

        const safeRows = Math.max(1, Math.min(20, rows));
        const safeCols = Math.max(1, Math.min(8, cols));

        const headerCells = Array.from(
          { length: safeCols },
          (_, c) => `<th class="border border-border p-2 bg-muted/40 font-semibold text-left">Column ${c + 1}</th>`,
        ).join("");

        const bodyRows = Array.from({ length: safeRows - 1 }, () => {
          const cells = Array.from(
            { length: safeCols },
            () => `<td class="border border-border p-2">Cell</td>`,
          ).join("");
          return `<tr>${cells}</tr>`;
        }).join("");

        const tableHtml = `
<table class="my-3 w-full border-collapse border border-border text-sm">
  <thead><tr>${headerCells}</tr></thead>
  <tbody>${bodyRows}</tbody>
</table>
<p><br></p>`;

        document.execCommand("insertHTML", false, tableHtml);
        triggerChange();
      },
      [triggerChange],
    );

    const getTableInfo = useCallback((): TableSelectionInfo | null => {
      return getTableSelectionInfo(editorRef.current);
    }, []);

    const insertTableRow = useCallback(
      (relative: "above" | "below") => {
        const info = getTableSelectionInfo(editorRef.current);
        if (!info) return;
        domInsertTableRow(info.table, info.rowIndex, relative);
        triggerChange();
      },
      [triggerChange],
    );

    const deleteTableRow = useCallback(() => {
      const info = getTableSelectionInfo(editorRef.current);
      if (!info) return;
      domDeleteTableRow(info.table, info.rowIndex);
      triggerChange();
    }, [triggerChange]);

    const insertTableColumn = useCallback(
      (relative: "left" | "right") => {
        const info = getTableSelectionInfo(editorRef.current);
        if (!info) return;
        domInsertTableColumn(info.table, info.colIndex, relative);
        triggerChange();
      },
      [triggerChange],
    );

    const deleteTableColumn = useCallback(() => {
      const info = getTableSelectionInfo(editorRef.current);
      if (!info) return;
      domDeleteTableColumn(info.table, info.colIndex);
      triggerChange();
    }, [triggerChange]);

    const setTableColumnAlignment = useCallback(
      (colIndex: number, alignment: "left" | "center" | "right") => {
        const el = editorRef.current;
        if (!el) return;

        const info = getTableSelectionInfo(el);
        if (info) {
          domSetTableColumnAlignment(info.table, colIndex, alignment);
          triggerChange();
          return;
        }

        const tables = el.querySelectorAll("table");
        if (tables.length > 0) {
          tables.forEach((table) => {
            domSetTableColumnAlignment(table, colIndex, alignment);
          });
          triggerChange();
          return;
        }
      },
      [triggerChange],
    );

    const currentMathElementRef = useRef<HTMLElement | null>(null);
    const selectedMathElementRef = useRef<HTMLElement | null>(null);

    const selectMathElement = useCallback(
      (mathBlock: HTMLElement | null) => {
        const el = editorRef.current;
        if (!el) return;
        const allMathBlocks = el.querySelectorAll<HTMLElement>(".math-block");
        allMathBlocks.forEach((m) => {
          m.classList.remove("math-block-selected");
          m.style.borderColor = "rgba(99,102,241,0.25)";
          m.style.boxShadow = "none";
          m.style.background = "rgba(99,102,241,0.08)";
        });

        selectedMathElementRef.current = mathBlock;
        currentMathElementRef.current = mathBlock;

        if (mathBlock) {
          mathBlock.classList.add("math-block-selected");
          mathBlock.style.borderColor = "#4f46e5";
          mathBlock.style.boxShadow = "0 0 0 2px rgba(99, 102, 241, 0.4)";
          mathBlock.style.background = "rgba(99,102,241,0.14)";
          mathBlock.focus();

          const latex = mathBlock.getAttribute("data-latex") ?? "";
          const baseState = queryActiveFormats();
          const updated = {
            ...baseState,
            mathInfo: { latex, element: mathBlock },
          };
          setFormatState(updated);
          onFormatChange?.(updated);
        }
      },
      [queryActiveFormats, onFormatChange],
    );

    const copyMathBlockFromElement = useCallback(
      (mathBlock: HTMLElement, clipboardData?: DataTransfer | null) => {
        const latex = mathBlock.getAttribute("data-latex") ?? "";
        const naturalExpr = mathBlock.getAttribute("data-natural-expr") || latex;
        const blockId = mathBlock.getAttribute("data-block-id") || undefined;
        const color = mathBlock.getAttribute("data-color") || undefined;
        const displayMode =
          (mathBlock.getAttribute("data-display-mode") as "block" | "compact") || "block";

        serializeMathBlockToClipboard(
          {
            id: blockId,
            latex,
            naturalExpr,
            displayMode,
            color,
          },
          clipboardData,
        );

        if (!clipboardData && typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
          navigator.clipboard.writeText(naturalExpr || latex).catch(() => {});
        }

        const copyBtn = mathBlock.querySelector<HTMLElement>(".math-chip-copy");
        if (copyBtn) {
          const orig = copyBtn.textContent;
          copyBtn.textContent = "Copied!";
          copyBtn.style.color = "#4f46e5";
          copyBtn.style.fontWeight = "600";
          setTimeout(() => {
            if (copyBtn) {
              copyBtn.textContent = orig || "Copy";
              copyBtn.style.color = "";
              copyBtn.style.fontWeight = "";
            }
          }, 1200);
        }
      },
      [],
    );

    const pasteMathBlock = useCallback(
      (payload: MathClipboardPayload) => {
        const el = editorRef.current;
        if (!el) return;
        el.focus();

        const newId = generateBlockId("math");
        const trimmed = payload.latex.trim();
        const naturalExpr = (payload.naturalExpr || payload.latex).trim();
        const displayMode = payload.displayMode || "block";

        const mathDiv = document.createElement("div");
        mathDiv.className = "math-block";
        mathDiv.setAttribute("data-block-id", newId);
        mathDiv.setAttribute("data-block-type", "math");
        mathDiv.setAttribute("data-latex", trimmed);
        mathDiv.setAttribute("data-natural-expr", naturalExpr);
        mathDiv.setAttribute("data-display-mode", displayMode);
        if (payload.color) {
          mathDiv.setAttribute("data-color", payload.color);
        }
        mathDiv.setAttribute("contenteditable", "false");
        mathDiv.setAttribute("tabindex", "0");
        mathDiv.style.cssText =
          "display:inline-flex;align-items:center;gap:6px;padding:3px 10px;" +
          "margin:4px 0;border-radius:6px;background:rgba(99,102,241,0.08);" +
          "border:1px solid rgba(99,102,241,0.25);cursor:pointer;user-select:none;" +
          "font-size:1em;color:#1e1b4b;vertical-align:middle;";
        mathDiv.innerHTML = formatMathBlockInner(trimmed, payload.color);

        const createTrailingParagraph = () => {
          const p = document.createElement("p");
          p.innerHTML = "<br>";
          return p;
        };

        const setCaretInParagraph = (p: HTMLElement) => {
          const sel = window.getSelection();
          if (sel) {
            const range = document.createRange();
            range.setStart(p, 0);
            range.collapse(true);
            sel.removeAllRanges();
            sel.addRange(range);
            savedRangeRef.current = range.cloneRange();
          }
        };

        let inserted = false;

        // 1. If a math block was explicitly selected by the user, paste directly after it
        if (selectedMathElementRef.current && el.contains(selectedMathElementRef.current)) {
          const target = selectedMathElementRef.current;
          const trailingP = createTrailingParagraph();
          if (target.nextSibling) {
            target.parentNode?.insertBefore(mathDiv, target.nextSibling);
            target.parentNode?.insertBefore(trailingP, mathDiv.nextSibling);
          } else {
            target.parentNode?.appendChild(mathDiv);
            target.parentNode?.appendChild(trailingP);
          }
          setCaretInParagraph(trailingP);
          selectMathElement(mathDiv);
          inserted = true;
        }

        // 2. Otherwise inspect caret position from current or saved selection
        if (!inserted) {
          const sel = window.getSelection();
          const activeRange =
            (sel && sel.rangeCount > 0 && el.contains(sel.getRangeAt(0).commonAncestorContainer)
              ? sel.getRangeAt(0)
              : null) ??
            (savedRangeRef.current && el.contains(savedRangeRef.current.commonAncestorContainer)
              ? savedRangeRef.current
              : null);

          if (activeRange) {
            try {
              let targetNode: Node | null = activeRange.startContainer;
              if (targetNode.nodeType === 3) targetNode = targetNode.parentNode;
              const parentBlock = (targetNode as HTMLElement)?.closest?.("p, div, .math-block");

              if (parentBlock && parentBlock.classList.contains("math-block")) {
                const trailingP = createTrailingParagraph();
                if (parentBlock.nextSibling) {
                  parentBlock.parentNode?.insertBefore(mathDiv, parentBlock.nextSibling);
                  parentBlock.parentNode?.insertBefore(trailingP, mathDiv.nextSibling);
                } else {
                  parentBlock.parentNode?.appendChild(mathDiv);
                  parentBlock.parentNode?.appendChild(trailingP);
                }
                setCaretInParagraph(trailingP);
                selectMathElement(mathDiv);
                inserted = true;
              } else if (
                parentBlock &&
                parentBlock !== el &&
                (!parentBlock.textContent?.trim() || parentBlock.innerHTML === "<br>")
              ) {
                const trailingP = createTrailingParagraph();
                parentBlock.replaceWith(mathDiv);
                if (mathDiv.nextSibling) {
                  mathDiv.parentNode?.insertBefore(trailingP, mathDiv.nextSibling);
                } else {
                  mathDiv.parentNode?.appendChild(trailingP);
                }
                setCaretInParagraph(trailingP);
                selectMathElement(mathDiv);
                inserted = true;
              } else if (parentBlock && parentBlock !== el && parentBlock.parentNode === el) {
                const trailingP = createTrailingParagraph();
                if (activeRange.startOffset === 0 && activeRange.collapsed) {
                  el.insertBefore(mathDiv, parentBlock);
                  setCaretInParagraph(parentBlock as HTMLElement);
                } else {
                  if (parentBlock.nextSibling) {
                    el.insertBefore(mathDiv, parentBlock.nextSibling);
                    el.insertBefore(trailingP, mathDiv.nextSibling);
                  } else {
                    el.appendChild(mathDiv);
                    el.appendChild(trailingP);
                  }
                  setCaretInParagraph(trailingP);
                }
                selectMathElement(mathDiv);
                inserted = true;
              } else {
                activeRange.deleteContents();
                activeRange.insertNode(mathDiv);
                const trailingP = createTrailingParagraph();
                if (mathDiv.nextSibling) {
                  mathDiv.parentNode?.insertBefore(trailingP, mathDiv.nextSibling);
                } else {
                  el.appendChild(trailingP);
                }
                setCaretInParagraph(trailingP);
                selectMathElement(mathDiv);
                inserted = true;
              }
            } catch {
              inserted = false;
            }
          }
        }

        // 3. Fallback: append inside editor
        if (!inserted) {
          const lastChild = el.lastElementChild;
          const trailingP = createTrailingParagraph();
          if (
            lastChild &&
            (lastChild.tagName === "P" || lastChild.tagName === "DIV") &&
            (!lastChild.textContent?.trim() || lastChild.innerHTML === "<br>")
          ) {
            lastChild.replaceWith(mathDiv);
            el.appendChild(trailingP);
          } else {
            el.appendChild(mathDiv);
            el.appendChild(trailingP);
          }
          setCaretInParagraph(trailingP);
          selectMathElement(mathDiv);
          inserted = true;
        }

        triggerChange();
        updateFormatState();
      },
      [triggerChange, updateFormatState, selectMathElement],
    );

    const insertMathBlock = useCallback(
      (latex: string) => {
        const el = editorRef.current;
        if (!el) return;
        el.focus();

        const trimmed = latex.trim();
        if (!trimmed) return;

        // Build the math-block DOM node
        const blockId = generateBlockId("math");
        const mathDiv = document.createElement("div");
        mathDiv.className = "math-block";
        mathDiv.setAttribute("data-block-id", blockId);
        mathDiv.setAttribute("data-block-type", "math");
        mathDiv.setAttribute("data-latex", trimmed);
        mathDiv.setAttribute("data-natural-expr", trimmed);
        mathDiv.setAttribute("data-display-mode", "block");
        mathDiv.setAttribute("contenteditable", "false");
        mathDiv.setAttribute("tabindex", "0");
        mathDiv.style.cssText =
          "display:inline-flex;align-items:center;gap:6px;padding:3px 10px;" +
          "margin:4px 0;border-radius:6px;background:rgba(99,102,241,0.08);" +
          "border:1px solid rgba(99,102,241,0.25);cursor:pointer;user-select:none;" +
          "font-size:1em;color:#1e1b4b;vertical-align:middle;";
        mathDiv.innerHTML = formatMathBlockInner(trimmed);

        const createTrailingParagraph = () => {
          const p = document.createElement("p");
          p.innerHTML = "<br>";
          return p;
        };

        const setCaretInParagraph = (p: HTMLElement) => {
          const sel = window.getSelection();
          if (sel) {
            const range = document.createRange();
            range.setStart(p, 0);
            range.collapse(true);
            sel.removeAllRanges();
            sel.addRange(range);
            savedRangeRef.current = range.cloneRange();
          }
        };

        let inserted = false;

        const getEnclosingMathBlock = (node: Node | null): HTMLElement | null => {
          let curr: Node | null = node;
          while (curr && curr !== el) {
            if (curr.nodeType === 1 && (curr as HTMLElement).classList.contains("math-block")) {
              return curr as HTMLElement;
            }
            curr = curr.parentNode;
          }
          return null;
        };

        const insertAfterElement = (target: HTMLElement) => {
          if (target.parentNode) {
            const trailingP = createTrailingParagraph();
            if (target.nextSibling) {
              target.parentNode.insertBefore(mathDiv, target.nextSibling);
              target.parentNode.insertBefore(trailingP, mathDiv.nextSibling);
            } else {
              target.parentNode.appendChild(mathDiv);
              target.parentNode.appendChild(trailingP);
            }
            setCaretInParagraph(trailingP);
            return true;
          }
          return false;
        };

        // Try saved selection first
        if (savedRangeRef.current && el.contains(savedRangeRef.current.commonAncestorContainer)) {
          try {
            const range = savedRangeRef.current;
            const enclosing =
              getEnclosingMathBlock(range.commonAncestorContainer) ??
              getEnclosingMathBlock(range.startContainer);
            if (enclosing) {
              inserted = insertAfterElement(enclosing);
            } else {
              let targetNode = range.startContainer;
              if (targetNode.nodeType === 3) targetNode = targetNode.parentNode as Node;
              const parentBlock = (targetNode as HTMLElement)?.closest?.("p, div");
              if (
                parentBlock &&
                parentBlock !== el &&
                (!parentBlock.textContent?.trim() || parentBlock.innerHTML === "<br>")
              ) {
                const trailingP = createTrailingParagraph();
                parentBlock.replaceWith(mathDiv);
                if (mathDiv.nextSibling) {
                  mathDiv.parentNode?.insertBefore(trailingP, mathDiv.nextSibling);
                } else {
                  mathDiv.parentNode?.appendChild(trailingP);
                }
                setCaretInParagraph(trailingP);
                inserted = true;
              } else if (parentBlock && parentBlock !== el && parentBlock.parentNode === el) {
                const trailingP = createTrailingParagraph();
                if (parentBlock.nextSibling) {
                  el.insertBefore(mathDiv, parentBlock.nextSibling);
                  el.insertBefore(trailingP, mathDiv.nextSibling);
                } else {
                  el.appendChild(mathDiv);
                  el.appendChild(trailingP);
                }
                setCaretInParagraph(trailingP);
                inserted = true;
              } else {
                if (range.cloneContents().querySelector(".math-block")) {
                  range.collapse(false);
                }
                range.deleteContents();
                range.insertNode(mathDiv);
                const trailingP = createTrailingParagraph();
                if (mathDiv.nextSibling) {
                  mathDiv.parentNode?.insertBefore(trailingP, mathDiv.nextSibling);
                } else {
                  el.appendChild(trailingP);
                }
                setCaretInParagraph(trailingP);
                inserted = true;
              }
            }
          } catch {
            inserted = false;
          }
        }

        // Fallback: append inside editor
        if (!inserted) {
          const lastChild = el.lastElementChild;
          const trailingP = createTrailingParagraph();
          if (
            lastChild &&
            (lastChild.tagName === "P" || lastChild.tagName === "DIV") &&
            (!lastChild.textContent?.trim() || lastChild.innerHTML === "<br>")
          ) {
            lastChild.replaceWith(mathDiv);
            el.appendChild(trailingP);
          } else {
            el.appendChild(mathDiv);
            el.appendChild(trailingP);
          }
          setCaretInParagraph(trailingP);
          inserted = true;
        }

        currentMathElementRef.current = null;
        triggerChange();
        updateFormatState();
      },
      [triggerChange, updateFormatState],
    );

    const updateMathBlock = useCallback(
      (latex: string, targetEl?: HTMLElement | null) => {
        const mathEl = targetEl ?? currentMathElementRef.current;
        if (!mathEl || !editorRef.current?.contains(mathEl)) {
          insertMathBlock(latex);
          return;
        }
        const trimmed = latex.trim();
        mathEl.setAttribute("data-latex", trimmed);
        const existingColor = mathEl.getAttribute("data-color") || undefined;
        mathEl.innerHTML = formatMathBlockInner(trimmed, existingColor);
        currentMathElementRef.current = null;
        triggerChange();
        updateFormatState();
      },
      [insertMathBlock, triggerChange, updateFormatState],
    );

    const clearActiveMathElement = useCallback(() => {
      currentMathElementRef.current = null;
      updateFormatState();
    }, [updateFormatState]);

    const getMathInfo = useCallback((): { latex: string } | null => {
      const mathEl = currentMathElementRef.current;
      if (!mathEl) return null;
      const latex = mathEl.getAttribute("data-latex") ?? "";
      return latex ? { latex } : null;
    }, []);

    const insertGraphBlock = useCallback(
      (definition: GraphDefinition) => {
        const el = editorRef.current;
        if (!el) return;
        el.focus();

        const graphDiv = document.createElement("div");
        graphDiv.className = "graph-block";
        const defJson = JSON.stringify(definition);
        graphDiv.setAttribute("data-graph-definition", defJson);
        graphDiv.setAttribute("contenteditable", "false");
        graphDiv.style.cssText =
          "display:inline-flex;align-items:center;gap:6px;padding:4px 10px;" +
          "margin:4px 0;border-radius:6px;background:rgba(16,185,129,0.08);" +
          "border:1px solid rgba(16,185,129,0.25);cursor:pointer;user-select:none;" +
          "font-family:sans-serif;font-size:0.82em;color:#047857;white-space:nowrap;";
        graphDiv.innerHTML = formatGraphBlockInner(definition);

        const createTrailingParagraph = () => {
          const p = document.createElement("p");
          p.innerHTML = "<br>";
          return p;
        };

        const setCaretInParagraph = (p: HTMLElement) => {
          const sel = window.getSelection();
          if (sel) {
            const range = document.createRange();
            range.setStart(p, 0);
            range.collapse(true);
            sel.removeAllRanges();
            sel.addRange(range);
            savedRangeRef.current = range.cloneRange();
          }
        };

        let inserted = false;

        const getEnclosingBlock = (node: Node | null): HTMLElement | null => {
          let curr: Node | null = node;
          while (curr && curr !== el) {
            if (
              curr.nodeType === 1 &&
              ((curr as HTMLElement).classList.contains("math-block") ||
                (curr as HTMLElement).classList.contains("graph-block"))
            ) {
              return curr as HTMLElement;
            }
            curr = curr.parentNode;
          }
          return null;
        };

        if (savedRangeRef.current && el.contains(savedRangeRef.current.commonAncestorContainer)) {
          try {
            const range = savedRangeRef.current;
            const enclosing =
              getEnclosingBlock(range.commonAncestorContainer) ??
              getEnclosingBlock(range.startContainer);
            if (enclosing && enclosing.parentNode) {
              const trailingP = createTrailingParagraph();
              if (enclosing.nextSibling) {
                enclosing.parentNode.insertBefore(graphDiv, enclosing.nextSibling);
                enclosing.parentNode.insertBefore(trailingP, graphDiv.nextSibling);
              } else {
                enclosing.parentNode.appendChild(graphDiv);
                enclosing.parentNode.appendChild(trailingP);
              }
              setCaretInParagraph(trailingP);
              inserted = true;
            } else {
              let targetNode = range.startContainer;
              if (targetNode.nodeType === 3) targetNode = targetNode.parentNode as Node;
              const parentBlock = (targetNode as HTMLElement)?.closest?.("p, div");
              if (
                parentBlock &&
                parentBlock !== el &&
                (!parentBlock.textContent?.trim() || parentBlock.innerHTML === "<br>")
              ) {
                const trailingP = createTrailingParagraph();
                parentBlock.replaceWith(graphDiv);
                if (graphDiv.nextSibling) {
                  graphDiv.parentNode?.insertBefore(trailingP, graphDiv.nextSibling);
                } else {
                  graphDiv.parentNode?.appendChild(trailingP);
                }
                setCaretInParagraph(trailingP);
                inserted = true;
              }
            }
          } catch {
            inserted = false;
          }
        }

        if (!inserted) {
          const lastChild = el.lastElementChild;
          const trailingP = createTrailingParagraph();
          if (
            lastChild &&
            (lastChild.tagName === "P" || lastChild.tagName === "DIV") &&
            (!lastChild.textContent?.trim() || lastChild.innerHTML === "<br>")
          ) {
            lastChild.replaceWith(graphDiv);
            el.appendChild(trailingP);
          } else {
            el.appendChild(graphDiv);
            el.appendChild(trailingP);
          }
          setCaretInParagraph(trailingP);
          inserted = true;
        }

        triggerChange();
        updateFormatState();
      },
      [triggerChange, updateFormatState],
    );

    const updateGraphBlock = useCallback(
      (definition: GraphDefinition, targetBlockId?: string | null) => {
        const el = editorRef.current;
        if (!el) return;
        let graphEl: HTMLElement | null = null;
        if (targetBlockId) {
          graphEl = el.querySelector(`[data-block-id="${targetBlockId}"]`);
        }
        if (!graphEl) {
          graphEl = el.querySelector(".graph-block");
        }
        if (graphEl) {
          const defJson = JSON.stringify(definition);
          graphEl.setAttribute("data-graph-definition", defJson);
          graphEl.innerHTML = formatGraphBlockInner(definition);
          triggerChange();
          updateFormatState();
        } else {
          insertGraphBlock(definition);
        }
      },
      [insertGraphBlock, triggerChange, updateFormatState],
    );

    useImperativeHandle(
      ref,
      () => ({
        toggleBold,
        toggleItalic,
        toggleUnderline,
        toggleBlackInk,
        setFontScale,
        setTextColor,
        setHighlight,
        clearFormatting,
        insertTable,
        insertTableRow,
        deleteTableRow,
        insertTableColumn,
        deleteTableColumn,
        setTableColumnAlignment,
        getTableInfo,
        insertMathBlock,
        updateMathBlock,
        clearActiveMathElement,
        getMathInfo,
        insertGraphBlock,
        updateGraphBlock,
        focus: () => editorRef.current?.focus(),
        getFormatState: () => formatState,
      }),
      [
        toggleBold,
        toggleItalic,
        toggleUnderline,
        toggleBlackInk,
        setFontScale,
        setTextColor,
        setHighlight,
        clearFormatting,
        insertTable,
        insertTableRow,
        deleteTableRow,
        insertTableColumn,
        deleteTableColumn,
        setTableColumnAlignment,
        getTableInfo,
        formatState,
        insertMathBlock,
        updateMathBlock,
        clearActiveMathElement,
        getMathInfo,
        insertGraphBlock,
        updateGraphBlock,
      ],
    );

    const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
      const el = editorRef.current;
      if (!el) return;

      if (e.key === "Tab") {
        if (handleTableTabNavigation(el, e.shiftKey)) {
          e.preventDefault();
          triggerChange();
          return;
        }
      }

      if (e.key === "Backspace" || e.key === "Delete") {
        const sel = window.getSelection();
        const anchor = sel?.anchorNode;
        if (sel && sel.rangeCount > 0 && sel.isCollapsed && anchor && editorRef.current?.contains(anchor)) {
          if (e.key === "Backspace") {
            const prev = anchor.previousSibling;
            if (
              prev &&
              prev.nodeType === 1 &&
              ((prev as HTMLElement).classList.contains("math-block") ||
                (prev as HTMLElement).classList.contains("graph-block"))
            ) {
              e.preventDefault();
              (prev as HTMLElement).remove();
              triggerChange();
              return;
            }
          } else if (e.key === "Delete") {
            const next = anchor.nextSibling;
            if (
              next &&
              next.nodeType === 1 &&
              ((next as HTMLElement).classList.contains("math-block") ||
                (next as HTMLElement).classList.contains("graph-block"))
            ) {
              e.preventDefault();
              (next as HTMLElement).remove();
              triggerChange();
              return;
            }
          }
        }
      }

      if (e.ctrlKey || e.metaKey) {
        const key = e.key.toLowerCase();
        if (key === "c") {
          const sel = window.getSelection();
          const hasTextSel = sel && !sel.isCollapsed && sel.toString().length > 0;
          if (!hasTextSel && selectedMathElementRef.current && el.contains(selectedMathElementRef.current)) {
            e.preventDefault();
            copyMathBlockFromElement(selectedMathElementRef.current);
            return;
          }
        }
        if (key === "b") {
          e.preventDefault();
          toggleBold();
          return;
        }
        if (key === "i") {
          e.preventDefault();
          toggleItalic();
          return;
        }
        if (key === "u") {
          e.preventDefault();
          toggleUnderline();
          return;
        }
      }

      // Handle Escape, Backspace, Delete, Enter on selected MathBlock
      if (selectedMathElementRef.current && el.contains(selectedMathElementRef.current)) {
        if (e.key === "Escape") {
          e.preventDefault();
          selectMathElement(null);
          return;
        }
        if (e.key === "Backspace" || e.key === "Delete") {
          const sel = window.getSelection();
          const hasTextSel = sel && !sel.isCollapsed && sel.toString().length > 0;
          if (!hasTextSel) {
            e.preventDefault();
            const target = selectedMathElementRef.current;
            selectMathElement(null);
            target.remove();
            triggerChange();
            updateFormatState();
            return;
          }
        }
        if (e.key === "Enter") {
          e.preventDefault();
          const target = selectedMathElementRef.current;
          const latex = target.getAttribute("data-latex") ?? "";
          onMathBlockClick?.(latex, target);
          return;
        }
      }
    };

    const handlePaste = (e: React.ClipboardEvent<HTMLDivElement>) => {
      const mathPayload = deserializeMathBlockFromClipboard(e.clipboardData);
      if (mathPayload) {
        e.preventDefault();
        pasteMathBlock(mathPayload);
        return;
      }

      const plain = e.clipboardData.getData("text/plain");
      if (
        /(\*\*[^*\n]+\*\*|__[^\n_]+__|==[^\n=]+==)/.test(plain) &&
        !isHtmlContent(plain)
      ) {
        e.preventDefault();
        const converted = migrateLegacyContentToHtml(plain);
        document.execCommand("insertHTML", false, converted);
        triggerChange();
      }
    };

    const handleSelectMathColor = useCallback(
      (newColor: string | undefined) => {
        if (!mathColorMenu?.mathBlock) return;
        const block = mathColorMenu.mathBlock;
        if (newColor) {
          block.setAttribute("data-color", newColor);
        } else {
          block.removeAttribute("data-color");
        }
        const latex = block.getAttribute("data-latex") ?? "";
        block.innerHTML = formatMathBlockInner(latex, newColor);
        setMathColorMenu(null);
        triggerChange();
      },
      [mathColorMenu, triggerChange],
    );

    return (
      <>
        <div
          ref={editorRef}
          contentEditable
          suppressContentEditableWarning
          role="textbox"
          aria-multiline="true"
          aria-label="Answer content editor"
          data-placeholder={placeholder}
          onInput={triggerChange}
          onKeyDown={handleKeyDown}
          onPaste={handlePaste}
          onCopy={(e) => {
            const sel = window.getSelection();
            const hasTextSel = sel && !sel.isCollapsed && sel.toString().length > 0;
            if (
              !hasTextSel &&
              selectedMathElementRef.current &&
              editorRef.current?.contains(selectedMathElementRef.current)
            ) {
              e.preventDefault();
              copyMathBlockFromElement(selectedMathElementRef.current, e.clipboardData);
            }
          }}
          onDoubleClick={(e) => {
            const target = e.target as HTMLElement | null;
            const mathBlock = target?.closest?.(".math-block") as HTMLElement | null;
            if (mathBlock) {
              e.stopPropagation();
              const latex = mathBlock.getAttribute("data-latex") ?? "";
              selectMathElement(mathBlock);
              onMathBlockClick?.(latex, mathBlock);
            }
          }}
          onBlur={saveSelection}
          onKeyUp={() => {
            saveSelection();
            updateFormatState();
          }}
          onMouseUp={() => {
            saveSelection();
            updateFormatState();
          }}
          onFocus={updateFormatState}
          onMouseDown={(e) => {
            const el = editorRef.current;
            if (!el) return;
            const target = e.target as HTMLElement | null;
            if (target === el) {
              const lastChild = el.lastElementChild;
              const lastRect = lastChild?.getBoundingClientRect();
              if (!lastRect || e.clientY >= lastRect.bottom - 4) {
                e.preventDefault();
                el.focus();
                let targetP: HTMLElement;
                if (
                  lastChild &&
                  lastChild.tagName === "P" &&
                  (!lastChild.textContent?.trim() || lastChild.innerHTML === "<br>")
                ) {
                  targetP = lastChild as HTMLElement;
                } else {
                  targetP = document.createElement("p");
                  targetP.innerHTML = "<br>";
                  el.appendChild(targetP);
                  triggerChange();
                }
                const sel = window.getSelection();
                if (sel) {
                  const range = document.createRange();
                  range.setStart(targetP, 0);
                  range.collapse(true);
                  sel.removeAllRanges();
                  sel.addRange(range);
                  savedRangeRef.current = range.cloneRange();
                }
                currentMathElementRef.current = null;
                updateFormatState();
              }
            }
          }}
          onClick={(e) => {
            const el = editorRef.current;
            if (!el) return;
            const target = e.target as HTMLElement | null;

            // Check if color button on math chip was clicked
            const colorBtn = target?.closest?.(".math-chip-color") as HTMLElement | null;
            if (colorBtn) {
              e.stopPropagation();
              const mathBlock = colorBtn.closest(".math-block") as HTMLElement | null;
              if (mathBlock) {
                selectMathElement(mathBlock);
                const rect = colorBtn.getBoundingClientRect();
                const currentColor = mathBlock.getAttribute("data-color") || undefined;
                setMathColorMenu({
                  mathBlock,
                  top: rect.bottom + 4,
                  left: Math.max(8, Math.min(rect.left, window.innerWidth - 210)),
                  currentColor,
                });
              }
              return;
            }

            // Check if copy button on math chip was clicked
            const copyBtn = target?.closest?.(".math-chip-copy") as HTMLElement | null;
            if (copyBtn) {
              e.stopPropagation();
              const mathBlock = copyBtn.closest(".math-block") as HTMLElement | null;
              if (mathBlock) {
                selectMathElement(mathBlock);
                copyMathBlockFromElement(mathBlock);
              }
              return;
            }

            // Check if edit button on math chip was clicked
            const editBtn = target?.closest?.(".math-chip-edit") as HTMLElement | null;
            if (editBtn) {
              e.stopPropagation();
              const mathBlock = editBtn.closest(".math-block") as HTMLElement | null;
              if (mathBlock) {
                const latex = mathBlock.getAttribute("data-latex") ?? "";
                selectMathElement(mathBlock);
                onMathBlockClick?.(latex, mathBlock);
              }
              return;
            }

            // Check if math block itself was clicked (selects it)
            const mathBlock = target?.closest?.(".math-block") as HTMLElement | null;
            if (mathBlock) {
              selectMathElement(mathBlock);
              return;
            }

            // Clicked outside math block -> deselect
            if (selectedMathElementRef.current) {
              selectMathElement(null);
            }
            if (mathColorMenu) {
              setMathColorMenu(null);
            }

            const graphBlock = target?.closest?.(".graph-block") as HTMLElement | null;
            if (graphBlock) {
              const defJson = graphBlock.getAttribute("data-graph-definition") ?? "";
              try {
                const def = JSON.parse(defJson) as GraphDefinition;
                const blockId = graphBlock.getAttribute("data-block-id") || "";
                onGraphBlockClick?.(def, blockId);
              } catch {}
              return;
            }

            currentMathElementRef.current = null;

            if (target === el) {
              const lastChild = el.lastElementChild;
              const lastRect = lastChild?.getBoundingClientRect();
              if (!lastRect || e.clientY >= lastRect.bottom - 4) {
                let targetP =
                  lastChild &&
                  lastChild.tagName === "P" &&
                  (!lastChild.textContent?.trim() || lastChild.innerHTML === "<br>")
                    ? (lastChild as HTMLElement)
                    : null;
                if (!targetP) {
                  targetP = document.createElement("p");
                  targetP.innerHTML = "<br>";
                  el.appendChild(targetP);
                  triggerChange();
                }
                const sel = window.getSelection();
                if (sel) {
                  const range = document.createRange();
                  range.setStart(targetP, 0);
                  range.collapse(true);
                  sel.removeAllRanges();
                  sel.addRange(range);
                  savedRangeRef.current = range.cloneRange();
                }
                updateFormatState();
              }
            }
          }}
          className={cn(
            "min-h-0 flex-1 rounded-lg border border-input bg-card p-4 text-base leading-relaxed text-foreground outline-none transition-colors cursor-text",
            "focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30",
            "overflow-y-auto whitespace-pre-wrap [overflow-wrap:anywhere]",
            "[&_h1]:mb-3 [&_h1]:mt-4 [&_h1]:text-2xl [&_h1]:font-bold [&_h1]:tracking-tight",
            "[&_h2]:mb-2 [&_h2]:mt-3 [&_h2]:text-xl [&_h2]:font-semibold",
            "[&_p]:mb-2.5",
            "[&_ul]:mb-3 [&_ul]:ml-6 [&_ul]:list-disc",
            "[&_ol]:mb-3 [&_ol]:ml-6 [&_ol]:list-decimal",
            "[&_li]:mb-1",
            "[&_blockquote]:my-3 [&_blockquote]:border-l-4 [&_blockquote]:border-primary/40 [&_blockquote]:pl-4 [&_blockquote]:italic [&_blockquote]:text-muted-foreground",
            "[&_hr]:my-4 [&_hr]:border-border",
            "[&_table]:my-3 [&_table]:w-full [&_table]:border-collapse [&_table]:border [&_table]:border-border [&_table]:cursor-text",
            "[&_thead]:cursor-text [&_tbody]:cursor-text [&_tr]:cursor-text",
            "[&_th]:border [&_th]:border-border [&_th]:bg-muted/40 [&_th]:p-2 [&_th]:font-semibold [&_th]:cursor-text [&_th]:whitespace-pre-wrap",
            "[&_td]:border [&_td]:border-border [&_td]:p-2 [&_td]:cursor-text [&_td]:whitespace-pre-wrap",
            "[&_strong]:font-bold",
            "[&_em]:italic",
            "[&_u]:underline",
            className,
          )}
        />
        {mathColorMenu && (
          <div
            id="math-block-color-popover"
            style={{
              position: "fixed",
              top: mathColorMenu.top,
              left: mathColorMenu.left,
              zIndex: 9999,
            }}
            className="w-48 rounded-lg border border-border bg-popover p-2 shadow-lg backdrop-blur animate-in fade-in zoom-in-95 cursor-default select-none text-popover-foreground"
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
                  onClick={() => handleSelectMathColor(ink.hex)}
                  title={ink.label}
                  className="flex flex-col items-center gap-1 rounded p-1 text-[10px] transition-colors hover:bg-accent cursor-pointer"
                >
                  <span
                    className={cn(
                      "size-5 rounded-full border border-black/20 shadow-xs transition-transform hover:scale-110",
                      mathColorMenu.currentColor?.toLowerCase() === ink.hex.toLowerCase() &&
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
                onClick={() => handleSelectMathColor(undefined)}
                className="rounded px-1.5 py-0.5 text-muted-foreground hover:bg-accent hover:text-foreground cursor-pointer"
              >
                Default ink
              </button>
              <label className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground cursor-pointer px-1.5 py-0.5 rounded hover:bg-accent">
                <span>Custom</span>
                <input
                  type="color"
                  value={mathColorMenu.currentColor || "#1d3fb5"}
                  onChange={(e) => handleSelectMathColor(e.target.value)}
                  className="size-4 p-0 border-0 rounded cursor-pointer"
                />
              </label>
            </div>
          </div>
        )}
      </>
    );
  },
);

RichContentEditor.displayName = "RichContentEditor";
