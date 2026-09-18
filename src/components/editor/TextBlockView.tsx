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

function sanitizeTextHtml(raw: string | undefined): string {
  if (!raw) return "<p><br></p>";
  let clean = raw;
  while (/^<div[^>]*data-block-type=["']text["'][^>]*>([\s\S]*)<\/div>$/i.test(clean.trim())) {
    clean = clean.trim().replace(/^<div[^>]*data-block-type=["']text["'][^>]*>/i, "").replace(/<\/div>$/i, "");
  }
  return clean || "<p><br></p>";
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
    const initialHtmlRef = useRef<string>(sanitizeTextHtml(block.html));
    const lastHtmlRef = useRef<string>(sanitizeTextHtml(block.html));
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

    // Sync external changes into DOM only when NOT focused and actually different
    useEffect(() => {
      const el = elRef.current;
      if (!el) return;

      // If user is actively typing/focused inside this block, the DOM is the active source of truth.
      // NEVER overwrite innerHTML while focused, as that destroys selection and resets caret to 0!
      const isFocused = document.activeElement === el || el.contains(document.activeElement);
      if (isFocused) {
        lastHtmlRef.current = el.innerHTML;
        return;
      }

      const sanitized = sanitizeTextHtml(block.html);
      if (el.innerHTML !== sanitized) {
        el.innerHTML = sanitized;
        lastHtmlRef.current = sanitized;
      }
    }, [block.html]);

    const handleInput = useCallback(() => {
      if (!elRef.current) return;
      const newHtml = elRef.current.innerHTML;
      if (newHtml !== lastHtmlRef.current) {
        lastHtmlRef.current = newHtml;
        onChange(newHtml);
      }
    }, [onChange]);

    const handleBlur = useCallback(() => {
      if (!elRef.current) return;
      const currentHtml = elRef.current.innerHTML;
      if (currentHtml !== lastHtmlRef.current) {
        lastHtmlRef.current = currentHtml;
        onChange(currentHtml);
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
      [onBackspaceAtStart, onArrowUpAtStart, onArrowDownAtEnd]
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
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        data-placeholder={placeholder}
        className={cn(
          "text-block-view relative w-full outline-none leading-relaxed cursor-text whitespace-pre-wrap [overflow-wrap:anywhere]",
          className
        )}
        dangerouslySetInnerHTML={{ __html: initialHtmlRef.current }}
      />
    );
  }
);

TextBlockView.displayName = "TextBlockView";
