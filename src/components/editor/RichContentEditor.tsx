import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from "react";
import { HIGHLIGHT_COLOR, isHtmlContent, migrateLegacyContentToHtml } from "@/lib/handwriting/parse";
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
  focus: () => void;
  getFormatState: () => FormatState;
}

interface RichContentEditorProps {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  className?: string;
  onFormatChange?: (state: FormatState) => void;
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
  ({ value, onChange, placeholder, className, onFormatChange }, ref) => {
    const editorRef = useRef<HTMLDivElement>(null);
    const lastValueRef = useRef<string>("");
    const isInternalChangeRef = useRef(false);

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
      };
    }, []);

    const updateFormatState = useCallback(() => {
      const state = queryActiveFormats();
      setFormatState(state);
      onFormatChange?.(state);
    }, [queryActiveFormats, onFormatChange]);

    // Selection change tracking
    useEffect(() => {
      const handleSelectionChange = () => {
        if (!editorRef.current) return;
        const sel = window.getSelection();
        if (sel && sel.anchorNode && editorRef.current.contains(sel.anchorNode)) {
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
        formatState,
      ],
    );

    const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
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
      if (/(\*\*|__|==|\*|_)/.test(plain) && !isHtmlContent(plain)) {
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
        onKeyUp={updateFormatState}
        onMouseUp={updateFormatState}
        onFocus={updateFormatState}
        className={cn(
          "min-h-0 flex-1 rounded-lg border border-input bg-card p-4 text-base leading-relaxed text-foreground outline-none transition-colors",
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
          "[&_table]:my-3 [&_table]:w-full [&_table]:border-collapse [&_table]:border [&_table]:border-border",
          "[&_th]:border [&_th]:border-border [&_th]:bg-muted/40 [&_th]:p-2 [&_th]:font-semibold [&_th]:text-left",
          "[&_td]:border [&_td]:border-border [&_td]:p-2",
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
