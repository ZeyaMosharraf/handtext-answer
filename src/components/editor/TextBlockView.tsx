/**
 * src/components/editor/TextBlockView.tsx
 *
 * Isolated ContentEditable view for a single TextBlock.
 *
 * Architectural Invariants:
 * 1. ContentEditable is strictly confined to this block — no monolithic parent editable container.
 * 2. Typing edits only this block's HTML without triggering document-wide re-renders.
 * 3. Rich text formatting (bold, italic, underline, ink color, scale, lists, paragraphs) works naturally.
 * 4. Keyboard navigation:
 *    - Enter at end of block triggers creation of a new TextBlock below.
 *    - Backspace on empty block triggers block deletion and focus moves to previous block.
 *    - Up/Down arrows at block boundaries navigate to adjacent blocks.
 */

import React, { useRef, useEffect, useCallback, forwardRef, useImperativeHandle } from "react";
import type { TextBlock } from "@/types/document";
import { cn } from "@/lib/utils";

export interface TextBlockViewHandle {
  focus: (atEnd?: boolean) => void;
  getElement: () => HTMLDivElement | null;
}

export interface TextBlockViewProps {
  block: TextBlock;
  isSelected?: boolean | undefined;
  onSelect?: (() => void) | undefined;
  onChange: (html: string) => void;
  onSplit?: ((beforeHtml: string, afterHtml: string) => void) | undefined;
  onEnterAtEnd?: (() => void) | undefined;
  onBackspaceAtStart?: (() => void) | undefined;
  onArrowUpAtStart?: (() => void) | undefined;
  onArrowDownAtEnd?: (() => void) | undefined;
  placeholder?: string | undefined;
  className?: string | undefined;
}

export const TextBlockView = forwardRef<TextBlockViewHandle, TextBlockViewProps>(
  (
    {
      block,
      isSelected,
      onSelect,
      onChange,
      onEnterAtEnd,
      onBackspaceAtStart,
      onArrowUpAtStart,
      onArrowDownAtEnd,
      placeholder,
      className,
    },
    ref
  ) => {
    const elRef = useRef<HTMLDivElement>(null);
    const lastHtmlRef = useRef<string>(block.html);
    const isInternalChangeRef = useRef(false);

    useImperativeHandle(
      ref,
      () => ({
        focus: (atEnd = false) => {
          const el = elRef.current;
          if (!el) return;
          el.focus();

          if (atEnd && typeof window !== "undefined") {
            const sel = window.getSelection();
            if (sel) {
              const range = document.createRange();
              range.selectNodeContents(el);
              range.collapse(false); // collapse to end
              sel.removeAllRanges();
              sel.addRange(range);
            }
          }
        },
        getElement: () => elRef.current,
      }),
      []
    );

    // Sync external changes into DOM only if changed externally
    useEffect(() => {
      if (isInternalChangeRef.current) {
        isInternalChangeRef.current = false;
        return;
      }
      if (elRef.current && elRef.current.innerHTML !== block.html) {
        elRef.current.innerHTML = block.html || "<p><br></p>";
        lastHtmlRef.current = block.html;
      }
    }, [block.html]);

    const handleInput = useCallback(() => {
      if (!elRef.current) return;
      const newHtml = elRef.current.innerHTML;
      if (newHtml !== lastHtmlRef.current) {
        lastHtmlRef.current = newHtml;
        isInternalChangeRef.current = true;
        onChange(newHtml);
      }
    }, [onChange]);

    const handleKeyDown = useCallback(
      (e: React.KeyboardEvent<HTMLDivElement>) => {
        const el = elRef.current;
        if (!el) return;

        const sel = window.getSelection();
        if (!sel || sel.rangeCount === 0) return;
        const range = sel.getRangeAt(0);

        // Check if cursor is at start of block
        const isAtStart =
          range.collapsed &&
          range.startOffset === 0 &&
          (range.startContainer === el ||
            range.startContainer === el.firstChild ||
            (el.firstChild && el.firstChild.contains(range.startContainer)));

        // Check if cursor is at end of block
        let isAtEnd = false;
        if (range.collapsed) {
          const testRange = document.createRange();
          testRange.selectNodeContents(el);
          isAtEnd = range.compareBoundaryPoints(Range.END_TO_END, testRange) === 0;
        }

        // Empty block check
        const textContent = el.innerText.replace(/\n/g, "").trim();
        const isEmpty = textContent.length === 0;

        // Backspace on empty block -> remove block and go to previous
        if (e.key === "Backspace" && (isEmpty || isAtStart)) {
          if (isEmpty && onBackspaceAtStart) {
            e.preventDefault();
            onBackspaceAtStart();
            return;
          }
        }

        // Enter at end of block -> create new text block
        if (e.key === "Enter" && !e.shiftKey) {
          if (isAtEnd && onEnterAtEnd) {
            e.preventDefault();
            onEnterAtEnd();
            return;
          }
        }

        // Arrow Up at start -> navigate to previous block
        if (e.key === "ArrowUp" && isAtStart && onArrowUpAtStart) {
          e.preventDefault();
          onArrowUpAtStart();
          return;
        }

        // Arrow Down at end -> navigate to next block
        if (e.key === "ArrowDown" && isAtEnd && onArrowDownAtEnd) {
          e.preventDefault();
          onArrowDownAtEnd();
          return;
        }
      },
      [onBackspaceAtStart, onEnterAtEnd, onArrowUpAtStart, onArrowDownAtEnd]
    );

    return (
      <div
        ref={elRef}
        contentEditable
        suppressContentEditableWarning
        data-block-id={block.id}
        data-block-type="text"
        onClick={onSelect}
        onInput={handleInput}
        onKeyDown={handleKeyDown}
        data-placeholder={placeholder}
        className={cn(
          "text-block-view relative min-h-[1.5em] w-full outline-none py-1 px-1 transition-all rounded-sm",
          "focus:outline-none focus:ring-1 focus:ring-primary/20",
          isSelected && "bg-primary/5 ring-1 ring-primary/40",
          className
        )}
        dangerouslySetInnerHTML={{ __html: block.html || "<p><br></p>" }}
      />
    );
  }
);

TextBlockView.displayName = "TextBlockView";
