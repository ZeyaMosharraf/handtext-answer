import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from "react";
import { HIGHLIGHT_COLOR, isHtmlContent, migrateLegacyContentToHtml } from "@/lib/handwriting/parse";
import { cn } from "@/lib/utils";

export interface FormatState {
  bold: boolean;
  italic: boolean;
  underline: boolean;
  blackInk: boolean;
}

export interface RichContentEditorHandle {
  toggleBold: () => void;
  toggleItalic: () => void;
  toggleUnderline: () => void;
  toggleBlackInk: () => void;
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

function checkBlackInkActive(): boolean {
  if (typeof window === "undefined" || typeof document === "undefined") return false;
  try {
    const cmdVal = document.queryCommandValue("foreColor")?.toLowerCase();
    if (
      cmdVal === "rgb(20, 24, 33)" ||
      cmdVal === "rgb(20,24,33)" ||
      cmdVal === "#141821" ||
      cmdVal === "141821"
    ) {
      return true;
    }
  } catch {
    // Ignore queryCommandValue exceptions
  }

  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0) return false;
  let node: Node | null = sel.anchorNode;
  while (node && node !== document.body) {
    if (node.nodeType === 1 /* Element */) {
      const el = node as HTMLElement;
      const colorAttr = el.getAttribute("color")?.toLowerCase();
      const styleColor = el.style?.color?.toLowerCase();
      const dataColor = el.getAttribute("data-color")?.toLowerCase();
      if (
        colorAttr === HIGHLIGHT_COLOR.toLowerCase() ||
        colorAttr === "#141821" ||
        colorAttr?.includes("141821") ||
        styleColor === "rgb(20, 24, 33)" ||
        styleColor === "#141821" ||
        dataColor === HIGHLIGHT_COLOR.toLowerCase() ||
        el.tagName === "MARK" ||
        (el.tagName === "FONT" && (colorAttr?.includes("141821") || colorAttr === "#141821"))
      ) {
        return true;
      }
    }
    node = node.parentNode;
  }
  return false;
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
    });

    const queryActiveFormats = useCallback((): FormatState => {
      if (typeof document === "undefined") {
        return { bold: false, italic: false, underline: false, blackInk: false };
      }
      const bold = document.queryCommandState("bold");
      const italic = document.queryCommandState("italic");
      const underline = document.queryCommandState("underline");
      const blackInk = checkBlackInkActive();
      return { bold, italic, underline, blackInk };
    }, []);

    const updateFormatState = useCallback(() => {
      const state = queryActiveFormats();
      setFormatState(state);
      onFormatChange?.(state);
    }, [queryActiveFormats, onFormatChange]);

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
      const active = checkBlackInkActive();
      if (active) {
        document.execCommand("removeFormat", false);
        document.execCommand("foreColor", false, "inherit");
      } else {
        document.execCommand("foreColor", false, HIGHLIGHT_COLOR);
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
        insertTable,
        focus: () => editorRef.current?.focus(),
        getFormatState: () => formatState,
      }),
      [toggleBold, toggleItalic, toggleUnderline, toggleBlackInk, insertTable, formatState],
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
          "min-h-[40vh] lg:min-h-[52vh] rounded-lg border border-input bg-card p-4 text-base leading-relaxed text-foreground outline-none transition-colors",
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
