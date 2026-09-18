/**
 * src/components/editor/RichContentEditor.tsx
 *
 * Primary Rich Content Editor using the Hybrid Block-Document Architecture.
 *
 * Architectural Invariants:
 * 1. Document consists of an ordered sequence of typed blocks: TextBlock | MathBlock | TableBlock | GraphBlock.
 * 2. NO monolithic contenteditable container — contenteditable is strictly confined to individual TextBlockView instances.
 * 3. Math, Table, and Graph blocks are first-class discrete document objects with clear selection outlines.
 * 4. CREATE vs EDIT ownership:
 *    - insertMathBlock always creates a NEW MathBlock with a new stable UUID, inserted at current position.
 *    - After inserting Math, an empty TextBlock is automatically created and focused, enabling unbroken typing.
 *    - updateMathBlock updates ONLY the targeted MathBlock by block ID.
 * 5. 100% backward-compatible: accepts and emits clean semantic HTML identical to Phase 1 specs.
 */

import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import { HIGHLIGHT_COLOR, isHtmlContent, migrateLegacyContentToHtml } from "@/lib/handwriting/parse";
import {
  type TableSelectionInfo,
  getTableSelectionInfo,
  insertTableRow as domInsertTableRow,
  deleteTableRow as domDeleteTableRow,
  insertTableColumn as domInsertTableColumn,
  deleteTableColumn as domDeleteTableColumn,
  setTableColumnAlignment as domSetTableColumnAlignment,
} from "@/lib/table-dom";
import type { GraphDefinition } from "@/lib/graph/types";
import { cn } from "@/lib/utils";
import {
  type DocumentBlock,
  type TextBlock,
  type MathBlock,
  type TableBlock,
  createEmptyTextBlock,
  createMathBlock,
  createTableBlock,
  createGraphBlock,
} from "@/types/document";
import { useDocumentBlocks } from "@/hooks/useDocumentBlocks";
import { BlockListContainer } from "./BlockListContainer";

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
  placeholder?: string | undefined;
  className?: string | undefined;
  onFormatChange?: ((state: FormatState) => void) | undefined;
  onMathBlockClick?: ((latex: string, element: HTMLElement) => void) | undefined;
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
    const containerRef = useRef<HTMLDivElement>(null);
    const lastEmittedHtmlRef = useRef<string>(value);
    const [focusTargetBlockId, setFocusTargetBlockId] = useState<string | null>(null);

    // Active editing math block tracker (guarantees updateMathBlock only edits this block ID)
    const editingMathBlockIdRef = useRef<string | null>(null);

    // Document Block State Machine
    const {
      blocks,
      selectedBlockId,
      insertBlock,
      updateBlock,
      deleteBlock,
      selectBlock,
      toHtml,
      loadFromHtml,
    } = useDocumentBlocks({
      initialHtml: value || "<p><br></p>",
      onChange: (_newBlocks, html) => {
        lastEmittedHtmlRef.current = html;
        onChange(html);
        updateFormatState();
      },
    });

    // Sync external value changes into DocumentBlocks
    useEffect(() => {
      if (value !== lastEmittedHtmlRef.current) {
        lastEmittedHtmlRef.current = value;
        loadFromHtml(value);
      }
    }, [value, loadFromHtml]);

    // Format state tracking
    const [formatState, setFormatState] = useState<FormatState>({
      bold: false,
      italic: false,
      underline: false,
      blackInk: false,
      hasSelection: false,
    });

    const queryActiveFormats = useCallback((): FormatState => {
      if (typeof document === "undefined" || !containerRef.current) {
        return {
          bold: false,
          italic: false,
          underline: false,
          blackInk: false,
          hasSelection: false,
        };
      }

      const bold = document.queryCommandState("bold");
      const italic = document.queryCommandState("italic");
      const underline = document.queryCommandState("underline");

      const sel = window.getSelection();
      const hasSelection = Boolean(sel && !sel.isCollapsed && sel.toString().length > 0);

      let selectionRect: FormatState["selectionRect"] = undefined;
      if (hasSelection && sel && sel.rangeCount > 0) {
        const range = sel.getRangeAt(0);
        const rect = range.getBoundingClientRect();
        if (rect.width > 0 && rect.height > 0) {
          selectionRect = {
            top: rect.top,
            left: rect.left,
            width: rect.width,
            height: rect.height,
          };
        }
      }

      let color: string | undefined = undefined;
      let scale: number | undefined = undefined;
      let highlight: string | undefined = undefined;
      let blackInk = false;

      if (sel && sel.rangeCount > 0 && containerRef.current.contains(sel.anchorNode)) {
        let node: Node | null = sel.anchorNode;
        if (node && node.nodeType === 3) {
          node = node.parentNode;
        }
        while (node && node !== containerRef.current) {
          if (node.nodeType === 1) {
            const el = node as HTMLElement;
            if (!color && el.style.color) color = rgbToHex(el.style.color) ?? el.style.color;
            if (!color && el.getAttribute("color")) color = el.getAttribute("color") ?? undefined;
            if (!scale && el.getAttribute("data-font-scale")) {
              scale = parseFloat(el.getAttribute("data-font-scale") ?? "1.0");
            }
            if (!highlight && el.getAttribute("data-highlight")) {
              highlight = el.getAttribute("data-highlight") ?? undefined;
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

      const tableInfo = getTableSelectionInfo(containerRef.current);

      // Check math block info
      let mathInfo: FormatState["mathInfo"] = undefined;
      if (selectedBlockId) {
        const selectedBlock = blocks.find((b) => b.id === selectedBlockId);
        if (selectedBlock && selectedBlock.type === "math") {
          const mathB = selectedBlock as MathBlock;
          const el = containerRef.current.querySelector(
            `[data-block-id="${selectedBlockId}"]`
          ) as HTMLElement;
          if (el) {
            mathInfo = { latex: mathB.latex, element: el };
          }
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
    }, [blocks, selectedBlockId]);

    const updateFormatState = useCallback(() => {
      const state = queryActiveFormats();
      setFormatState(state);
      onFormatChange?.(state);
    }, [queryActiveFormats, onFormatChange]);

    useEffect(() => {
      const handleSelectionChange = () => {
        if (!containerRef.current) return;
        const sel = window.getSelection();
        if (sel && sel.anchorNode && containerRef.current.contains(sel.anchorNode)) {
          updateFormatState();
        }
      };
      document.addEventListener("selectionchange", handleSelectionChange);
      return () => document.removeEventListener("selectionchange", handleSelectionChange);
    }, [updateFormatState]);

    // ─── Math Block Handlers ───────────────────────────────────────────────────

    const handleEditMathBlock = useCallback(
      (block: MathBlock) => {
        editingMathBlockIdRef.current = block.id;
        selectBlock(block.id);
        const el = containerRef.current?.querySelector(
          `[data-block-id="${block.id}"]`
        ) as HTMLElement | null;
        if (el && onMathBlockClick) {
          onMathBlockClick(block.naturalExpr || block.latex, el);
        }
      },
      [selectBlock, onMathBlockClick]
    );

    const insertMathBlock = useCallback(
      (latex: string) => {
        const trimmed = latex.trim();
        if (!trimmed) return;

        // CREATE MODE: Always creates a NEW MathBlock with a fresh unique ID
        const newMathBlock = createMathBlock(trimmed, trimmed, "block");

        // Determine anchor: insert after selected block, or at end
        const anchorId = selectedBlockId || (blocks.length > 0 ? blocks[blocks.length - 1]!.id : null);
        insertBlock(newMathBlock, anchorId);

        // CONTINUITY GUARANTEE: Automatically create and focus an empty TextBlock directly below
        const followingTextBlock = createEmptyTextBlock("<p><br></p>");
        insertBlock(followingTextBlock, newMathBlock.id);

        setFocusTargetBlockId(followingTextBlock.id);
        editingMathBlockIdRef.current = null;
        selectBlock(null);
      },
      [blocks, selectedBlockId, insertBlock, selectBlock]
    );

    const updateMathBlock = useCallback(
      (latex: string, targetEl?: HTMLElement | null) => {
        const trimmed = latex.trim();
        if (!trimmed) return;

        // Determine target block ID explicitly
        let targetBlockId = editingMathBlockIdRef.current;
        if (!targetBlockId && targetEl) {
          targetBlockId = targetEl.getAttribute("data-block-id");
        }
        if (!targetBlockId && selectedBlockId) {
          const selected = blocks.find((b) => b.id === selectedBlockId);
          if (selected && selected.type === "math") {
            targetBlockId = selected.id;
          }
        }

        if (targetBlockId) {
          updateBlock<MathBlock>(targetBlockId, {
            naturalExpr: trimmed,
            latex: trimmed,
          });
        } else {
          // Fallback to insert if no target found
          insertMathBlock(trimmed);
        }

        editingMathBlockIdRef.current = null;
      },
      [blocks, selectedBlockId, updateBlock, insertMathBlock]
    );

    const clearActiveMathElement = useCallback(() => {
      editingMathBlockIdRef.current = null;
      selectBlock(null);
    }, [selectBlock]);

    const getMathInfo = useCallback((): { latex: string } | null => {
      if (selectedBlockId) {
        const selected = blocks.find((b) => b.id === selectedBlockId);
        if (selected && selected.type === "math") {
          return { latex: (selected as MathBlock).latex };
        }
      }
      return null;
    }, [blocks, selectedBlockId]);

    // ─── Table Block Handlers ──────────────────────────────────────────────────

    const insertTable = useCallback(
      (rows: number, cols: number) => {
        let theadCols = "";
        for (let c = 0; c < cols; c++) {
          theadCols += `<th class="border border-border bg-muted/50 p-2 text-left text-xs font-semibold text-foreground">Col ${c + 1}</th>`;
        }
        let tbodyRows = "";
        for (let r = 0; r < rows - 1; r++) {
          let rowCells = "";
          for (let c = 0; c < cols; c++) {
            rowCells += `<td class="border border-border p-2 text-xs text-foreground">&nbsp;</td>`;
          }
          tbodyRows += `<tr>${rowCells}</tr>`;
        }

        const tableHtml = `<table class="my-3 w-full border-collapse border border-border text-sm"><thead><tr>${theadCols}</tr></thead><tbody>${tbodyRows}</tbody></table>`;
        const newTableBlock = createTableBlock(tableHtml);

        const anchorId = selectedBlockId || (blocks.length > 0 ? blocks[blocks.length - 1]!.id : null);
        insertBlock(newTableBlock, anchorId);

        // Continuity: add trailing text block
        const followingTextBlock = createEmptyTextBlock("<p><br></p>");
        insertBlock(followingTextBlock, newTableBlock.id);
        setFocusTargetBlockId(followingTextBlock.id);
      },
      [blocks, selectedBlockId, insertBlock]
    );

    const getActiveTableInfo = useCallback((): TableSelectionInfo | null => {
      if (!containerRef.current) return null;
      return getTableSelectionInfo(containerRef.current);
    }, []);

    const insertTableRow = useCallback(
      (relative: "above" | "below") => {
        const info = getActiveTableInfo();
        if (info) {
          domInsertTableRow(info.table, info.rowIndex, relative);
          // Sync updated table HTML to block
          const tableBlockEl = info.table.closest("[data-block-type='table']") as HTMLElement | null;
          const blockId = tableBlockEl?.getAttribute("data-block-id");
          if (blockId) {
            updateBlock<TableBlock>(blockId, { html: info.table.outerHTML });
          }
        }
      },
      [getActiveTableInfo, updateBlock]
    );

    const deleteTableRow = useCallback(() => {
      const info = getActiveTableInfo();
      if (info) {
        const tableBlockEl = info.table.closest("[data-block-type='table']") as HTMLElement | null;
        const blockId = tableBlockEl?.getAttribute("data-block-id");
        domDeleteTableRow(info.table, info.rowIndex);
        if (blockId) {
          if (info.table.rows.length === 0) {
            deleteBlock(blockId);
          } else {
            updateBlock<TableBlock>(blockId, { html: info.table.outerHTML });
          }
        }
      }
    }, [getActiveTableInfo, updateBlock, deleteBlock]);

    const insertTableColumn = useCallback(
      (relative: "left" | "right") => {
        const info = getActiveTableInfo();
        if (info) {
          domInsertTableColumn(info.table, info.colIndex, relative);
          const tableBlockEl = info.table.closest("[data-block-type='table']") as HTMLElement | null;
          const blockId = tableBlockEl?.getAttribute("data-block-id");
          if (blockId) {
            updateBlock<TableBlock>(blockId, { html: info.table.outerHTML });
          }
        }
      },
      [getActiveTableInfo, updateBlock]
    );

    const deleteTableColumn = useCallback(() => {
      const info = getActiveTableInfo();
      if (info) {
        const tableBlockEl = info.table.closest("[data-block-type='table']") as HTMLElement | null;
        const blockId = tableBlockEl?.getAttribute("data-block-id");
        domDeleteTableColumn(info.table, info.colIndex);
        if (blockId) {
          if (info.table.rows.length === 0 || info.table.rows[0]?.cells.length === 0) {
            deleteBlock(blockId);
          } else {
            updateBlock<TableBlock>(blockId, { html: info.table.outerHTML });
          }
        }
      }
    }, [getActiveTableInfo, updateBlock, deleteBlock]);

    const setTableColumnAlignment = useCallback(
      (colIndex: number, alignment: "left" | "center" | "right") => {
        const info = getActiveTableInfo();
        if (info) {
          domSetTableColumnAlignment(info.table, colIndex, alignment);
          const tableBlockEl = info.table.closest("[data-block-type='table']") as HTMLElement | null;
          const blockId = tableBlockEl?.getAttribute("data-block-id");
          if (blockId) {
            updateBlock<TableBlock>(blockId, { html: info.table.outerHTML });
          }
        }
      },
      [getActiveTableInfo, updateBlock]
    );

    // ─── Graph Block Handlers ──────────────────────────────────────────────────

    const insertGraphBlock = useCallback(
      (definition: GraphDefinition) => {
        const newGraphBlock = createGraphBlock(definition);
        const anchorId = selectedBlockId || (blocks.length > 0 ? blocks[blocks.length - 1]!.id : null);
        insertBlock(newGraphBlock, anchorId);

        // Continuity: add trailing text block
        const followingTextBlock = createEmptyTextBlock("<p><br></p>");
        insertBlock(followingTextBlock, newGraphBlock.id);
        setFocusTargetBlockId(followingTextBlock.id);
      },
      [blocks, selectedBlockId, insertBlock]
    );

    // ─── Rich Text Formatting Handlers ─────────────────────────────────────────

    const toggleBold = useCallback(() => {
      document.execCommand("bold", false);
      updateFormatState();
    }, [updateFormatState]);

    const toggleItalic = useCallback(() => {
      document.execCommand("italic", false);
      updateFormatState();
    }, [updateFormatState]);

    const toggleUnderline = useCallback(() => {
      document.execCommand("underline", false);
      updateFormatState();
    }, [updateFormatState]);

    const toggleBlackInk = useCallback(() => {
      if (formatState.blackInk) {
        document.execCommand("removeFormat", false);
      } else {
        document.execCommand("foreColor", false, HIGHLIGHT_COLOR);
      }
      updateFormatState();
    }, [formatState.blackInk, updateFormatState]);

    const setFontScale = useCallback(
      (scale: number | null) => {
        const sel = window.getSelection();
        if (!sel || sel.rangeCount === 0 || sel.isCollapsed) return;

        if (!scale || scale === 1.0) {
          const range = sel.getRangeAt(0);
          const span = document.createElement("span");
          span.setAttribute("data-font-scale", "1.0");
          try {
            range.surroundContents(span);
          } catch {
            document.execCommand("fontSize", false, "3");
          }
        } else {
          const range = sel.getRangeAt(0);
          const span = document.createElement("span");
          span.setAttribute("data-font-scale", scale.toString());
          span.style.fontSize = `${scale}em`;
          try {
            range.surroundContents(span);
          } catch {
            // Safe fallback
          }
        }
        updateFormatState();
      },
      [updateFormatState]
    );

    const setTextColor = useCallback(
      (color: string | null) => {
        if (!color) {
          document.execCommand("removeFormat", false);
        } else {
          document.execCommand("foreColor", false, color);
        }
        updateFormatState();
      },
      [updateFormatState]
    );

    const setHighlight = useCallback(
      (color: string | null) => {
        if (!color) {
          document.execCommand("removeFormat", false);
        } else {
          document.execCommand("hiliteColor", false, color);
        }
        updateFormatState();
      },
      [updateFormatState]
    );

    const clearFormatting = useCallback(() => {
      document.execCommand("removeFormat", false);
      updateFormatState();
    }, [updateFormatState]);

    const focus = useCallback(() => {
      const firstBlock = blocks[0];
      if (firstBlock) {
        setFocusTargetBlockId(firstBlock.id);
      }
    }, [blocks]);

    // Imperative Handle Exposure for Toolbar & Workspace
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
        getTableInfo: getActiveTableInfo,
        insertMathBlock,
        updateMathBlock,
        clearActiveMathElement,
        getMathInfo,
        insertGraphBlock,
        focus,
        getFormatState: queryActiveFormats,
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
        getActiveTableInfo,
        insertMathBlock,
        updateMathBlock,
        clearActiveMathElement,
        getMathInfo,
        insertGraphBlock,
        focus,
        queryActiveFormats,
      ]
    );

    return (
      <div
        ref={containerRef}
        className={cn(
          "rich-content-editor-host relative w-full flex-1 min-h-0 text-sm leading-relaxed",
          className
        )}
      >
        <BlockListContainer
          blocks={blocks}
          selectedBlockId={selectedBlockId}
          onSelectBlock={selectBlock}
          onUpdateBlock={updateBlock}
          onDeleteBlock={deleteBlock}
          onInsertBlockAfter={insertBlock}
          onEditMathBlock={handleEditMathBlock}
          onTableSelectionChange={(info) => {
            setFormatState((prev) => ({ ...prev, tableInfo: info ?? undefined }));
            onFormatChange?.({ ...formatState, tableInfo: info ?? undefined });
          }}
          focusTargetBlockId={focusTargetBlockId}
          onFocusHandled={() => setFocusTargetBlockId(null)}
          placeholder={placeholder}
        />
      </div>
    );
  }
);

RichContentEditor.displayName = "RichContentEditor";
