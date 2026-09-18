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
import { cn } from "@/lib/utils";

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
  focus: () => void;
  getFormatState: () => FormatState;
}

interface RichContentEditorProps {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  className?: string;
  onFormatChange?: (state: FormatState) => void;
  onMathBlockClick?: (latex: string, element: HTMLElement) => void;
}

function rgbToHex(rgbStr: string): string | null {
  const m = rgbStr.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/i);
  if (!m || !m[1] || !m[2] || !m[3]) return null;
  const r = parseInt(m[1], 10).toString(16).padStart(2, "0");
  const g = parseInt(m[2], 10).toString(16).padStart(2, "0");
  const b = parseInt(m[3], 10).toString(16).padStart(2, "0");
  return `#${r}${g}${b}`;
}

export const RichContentEditor = forwardRef<RichContentEditorHandle, RichContentEditorProps>(
  ({ value, onChange, placeholder, className, onFormatChange, onMathBlockClick }, ref) => {
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

      // Detect math block ancestry — only when selection is explicitly inside a math-block
      let mathInfo: { latex: string; element: HTMLElement } | undefined = undefined;
      if (sel && sel.rangeCount > 0) {
        let checkNode: Node | null = sel.anchorNode;
        while (checkNode && checkNode !== editorRef.current) {
          if (checkNode.nodeType === 1) {
            const el = checkNode as HTMLElement;
            if (el.classList.contains("math-block")) {
              const latex = el.getAttribute("data-latex") ?? "";
              if (latex) { mathInfo = { latex, element: el }; break; }
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

    // Initial mount and external changes (e.g. undo/redo, template load, AI suggestions)
    useEffect(() => {
      const el = editorRef.current;
      if (!el) return;

      const normalized = migrateLegacyContentToHtml(value);
      if (isInternalChangeRef.current) {
        isInternalChangeRef.current = false;
        lastValueRef.current = normalized;
        return;
      }

      if (el.innerHTML !== normalized) {
        el.innerHTML = normalized;
        lastValueRef.current = normalized;
        updateFormatState();
      }
    }, [value, updateFormatState]);

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

      // Clean up any residual data-scale wrappers in active selection
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

        // If content is currently markdown table, update the divider row
        const raw = el.innerText || el.textContent || "";
        if (raw.includes("|")) {
          const lines = raw.split("\n");
          let updated = false;
          for (let i = 0; i < lines.length; i++) {
            const line = lines[i]?.trim() ?? "";
            if (/^\|[\s:|-]+\|$/.test(line) && line.includes("-")) {
              const parts = line.slice(1, -1).split("|");
              if (parts[colIndex] !== undefined) {
                const alignMarker = alignment === "center" ? " :---: " : alignment === "right" ? " ---: " : " :--- ";
                parts[colIndex] = alignMarker;
                lines[i] = `|${parts.join("|")}|`;
                updated = true;
                break;
              }
            }
          }
          if (updated) {
            el.innerText = lines.join("\n");
            triggerChange();
          }
        }
      },
      [triggerChange],
    );

    const currentMathElementRef = useRef<HTMLElement | null>(null);

    const insertMathBlock = useCallback(
      (latex: string) => {
        const el = editorRef.current;
        if (!el) return;
        el.focus();

        // Build the math-block DOM node
        const mathDiv = document.createElement("div");
        mathDiv.className = "math-block";
        mathDiv.setAttribute("data-latex", latex);
        mathDiv.setAttribute("contenteditable", "false");
        mathDiv.style.cssText =
          "display:inline-flex;align-items:center;gap:6px;padding:4px 10px;" +
          "margin:4px 0;border-radius:6px;background:rgba(99,102,241,0.08);" +
          "border:1px solid rgba(99,102,241,0.25);cursor:pointer;user-select:none;" +
          "font-family:monospace;font-size:0.82em;color:#4338ca;white-space:nowrap;";
        const previewText = latex.length > 60 ? latex.slice(0, 57) + "…" : latex;
        mathDiv.innerHTML = `<span style="opacity:0.7;font-size:1.1em;">∑</span><span>${previewText}</span>`;

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

        // 1. Try saved selection first (captured before focus went to modal)
        if (savedRangeRef.current && el.contains(savedRangeRef.current.commonAncestorContainer)) {
          try {
            const range = savedRangeRef.current;
            const enclosing = getEnclosingMathBlock(range.commonAncestorContainer)
              ?? getEnclosingMathBlock(range.startContainer);
            if (enclosing) {
              inserted = insertAfterElement(enclosing);
            } else {
              // Check if range is inside an empty paragraph or container
              let targetNode = range.startContainer;
              if (targetNode.nodeType === 3) targetNode = targetNode.parentNode as Node;
              const parentBlock = (targetNode as HTMLElement)?.closest?.("p, div");
              if (
                parentBlock &&
                parentBlock !== el &&
                (!parentBlock.textContent?.trim() || parentBlock.innerHTML === "<br>")
              ) {
                // Cleanly replace empty paragraph
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
                // Insert after non-empty paragraph
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
                  mathDiv.parentNode?.appendChild(trailingP);
                }
                setCaretInParagraph(trailingP);
                inserted = true;
              }
            }
          } catch (err) {
            console.warn("Could not insert math into saved range:", err);
          }
        }

        // 2. Fallback: append inside editor (or into last paragraph)
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
          // Strict Invariant: Never overwrite an arbitrary math block if none was explicitly targeted!
          insertMathBlock(latex);
          return;
        }
        mathEl.setAttribute("data-latex", latex);
        const previewText = latex.length > 60 ? latex.slice(0, 57) + "…" : latex;
        mathEl.innerHTML = `<span style="opacity:0.7;font-size:1.1em;">∑</span><span>${previewText}</span>`;
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
        const title = definition.title || `${definition.type} graph`;
        const escTitle = title.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
        graphDiv.innerHTML = `<span style="opacity:0.7;font-size:1.1em;">📈</span><span>${escTitle}</span>`;

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

        const insertAfterElement = (target: HTMLElement) => {
          if (target.parentNode) {
            const trailingP = createTrailingParagraph();
            if (target.nextSibling) {
              target.parentNode.insertBefore(graphDiv, target.nextSibling);
              target.parentNode.insertBefore(trailingP, graphDiv.nextSibling);
            } else {
              target.parentNode.appendChild(graphDiv);
              target.parentNode.appendChild(trailingP);
            }
            setCaretInParagraph(trailingP);
            return true;
          }
          return false;
        };

        // 1. Try saved selection first
        if (savedRangeRef.current && el.contains(savedRangeRef.current.commonAncestorContainer)) {
          try {
            const range = savedRangeRef.current;
            const enclosing =
              getEnclosingBlock(range.commonAncestorContainer) ??
              getEnclosingBlock(range.startContainer);
            if (enclosing) {
              inserted = insertAfterElement(enclosing);
            } else {
              let targetNode = range.startContainer;
              if (targetNode.nodeType === 3) targetNode = targetNode.parentNode as Node;
              const parentBlock = (targetNode as HTMLElement)?.closest?.("p, div");
              if (
                parentBlock &&
                el.contains(parentBlock) &&
                parentBlock !== el &&
                (parentBlock.innerHTML === "<br>" || !parentBlock.textContent?.trim())
              ) {
                const trailingP = createTrailingParagraph();
                parentBlock.parentNode?.insertBefore(graphDiv, parentBlock);
                parentBlock.parentNode?.insertBefore(trailingP, parentBlock);
                parentBlock.remove();
                setCaretInParagraph(trailingP);
                inserted = true;
              } else {
                range.deleteContents();
                range.insertNode(graphDiv);
                const trailingP = createTrailingParagraph();
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

        // 2. Fallback: append inside editor
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
      ],
    );

    const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (e.key === "Tab") {
        if (editorRef.current && handleTableTabNavigation(editorRef.current, e.shiftKey)) {
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
            if (prev && prev.nodeType === 1 && (prev as HTMLElement).classList.contains("math-block")) {
              e.preventDefault();
              (prev as HTMLElement).remove();
              triggerChange();
              return;
            }
          } else if (e.key === "Delete") {
            const next = anchor.nextSibling;
            if (next && next.nodeType === 1 && (next as HTMLElement).classList.contains("math-block")) {
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
    };

    const handlePaste = (e: React.ClipboardEvent<HTMLDivElement>) => {
      const plain = e.clipboardData.getData("text/plain");
      // Check if pasted content contains legacy markdown markers like **bold**, __underline__, ==black==
      if (
        /(\*\*[^*\n]+\*\*|__[^\n_]+__|==[^\n=]+==)/.test(plain) &&
        !isHtmlContent(plain)
      ) {
        e.preventDefault();
        const converted = migrateLegacyContentToHtml(plain);
        document.execCommand("insertHTML", false, converted);
        triggerChange();
      }
      // Otherwise allow standard browser paste behavior for rich and plain text
    };

    return (
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
          // If user clicked directly in the editor padding/background (empty space below content)
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
          const mathBlock = target?.closest?.(".math-block") as HTMLElement | null;
          if (mathBlock) {
            const latex = mathBlock.getAttribute("data-latex") ?? "";
            currentMathElementRef.current = mathBlock;
            const baseState = queryActiveFormats();
            currentMathElementRef.current = mathBlock;
            const updated = {
              ...baseState,
              mathInfo: { latex, element: mathBlock },
            };
            setFormatState(updated);
            onFormatChange?.(updated);
            onMathBlockClick?.(latex, mathBlock);
            return;
          }

          currentMathElementRef.current = null;

          // If click was on empty space, make sure caret and savedRange are established
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
    );
  },
);

RichContentEditor.displayName = "RichContentEditor";
