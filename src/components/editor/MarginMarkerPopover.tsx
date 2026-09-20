/**
 * src/components/editor/MarginMarkerPopover.tsx
 *
 * Compact, fast popover for selecting, customizing, editing, or removing
 * answer-sheet gutter margin markers (Question, Answer, Sub-question, Marks, Custom).
 */

import React, { useState, useEffect, useRef } from "react";
import type { MarginMarker, MarginMarkerType } from "@/types/document";
import { cn } from "@/lib/utils";

interface MarginMarkerPopoverProps {
  isOpen: boolean;
  anchorRect: { top: number; left: number; bottom: number; height: number } | null;
  currentMarker?: MarginMarker | undefined;
  suggestedQuestion?: string | undefined;
  suggestedSubquestion?: string | undefined;
  onSelectMarker: (marker: MarginMarker) => void;
  onRemoveMarker: () => void;
  onClose: () => void;
}

const QUESTION_PRESETS = ["Q1", "Q2", "Q3", "Q4", "Q5", "Q6", "Q7", "Q8"];
const SUBQUESTION_PRESETS = ["a)", "b)", "c)", "d)", "e)", "(i)", "(ii)", "(iii)", "(iv)", "(v)"];
const MARKS_PRESETS = ["[2M]", "[5M]", "[10M]", "[15M]", "[20M]", "[5 Marks]"];
const CUSTOM_PRESETS = ["Note:", "Fig.", "Important:", "Step 1:", "Def:"];

export function MarginMarkerPopover({
  isOpen,
  anchorRect,
  currentMarker,
  suggestedQuestion = "Q1",
  suggestedSubquestion = "a)",
  onSelectMarker,
  onRemoveMarker,
  onClose,
}: MarginMarkerPopoverProps) {
  const popoverRef = useRef<HTMLDivElement>(null);
  const [activeTab, setActiveTab] = useState<MarginMarkerType>(
    currentMarker?.type || "question"
  );
  const [customText, setCustomText] = useState(
    currentMarker?.type === "custom" ? currentMarker.text : ""
  );

  useEffect(() => {
    if (currentMarker) {
      setActiveTab(currentMarker.type);
      if (currentMarker.type === "custom") {
        setCustomText(currentMarker.text);
      }
    } else {
      setActiveTab("question");
      setCustomText("");
    }
  }, [currentMarker, isOpen]);

  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen || !anchorRect) return null;

  // Calculate viewport safe coordinates
  const popoverWidth = 270;
  const popoverHeight = 310;
  const padding = 12;

  let left = anchorRect.left;
  let top = anchorRect.bottom + 6;

  // Horizontal bounding
  if (left + popoverWidth > window.innerWidth - padding) {
    left = window.innerWidth - popoverWidth - padding;
  }
  if (left < padding) left = padding;

  // Vertical bounding
  if (top + popoverHeight > window.innerHeight - padding) {
    // Show above anchor if no space below
    top = Math.max(padding, anchorRect.top - popoverHeight - 6);
  }

  const handleApplyCustom = (e?: React.FormEvent) => {
    e?.preventDefault();
    const trimmed = customText.trim();
    if (!trimmed) return;
    onSelectMarker({
      type: "custom",
      text: trimmed,
    });
    onClose();
  };

  return (
    <div
      ref={popoverRef}
      style={{
        position: "fixed",
        top: `${top}px`,
        left: `${left}px`,
        zIndex: 9999,
        width: `${popoverWidth}px`,
      }}
      className="rounded-xl border border-border bg-popover/95 p-3 text-popover-foreground shadow-2xl backdrop-blur-md animate-in fade-in zoom-in-95 select-none"
      onMouseDown={(e) => e.stopPropagation()}
    >
      {/* Header with current status */}
      <div className="flex items-center justify-between border-b border-border/60 pb-2 mb-2.5">
        <div className="flex items-center gap-1.5">
          <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
            Margin Marker
          </span>
          {currentMarker && (
            <span className="inline-flex items-center rounded-md bg-primary/10 px-1.5 py-0.5 text-xs font-semibold text-primary">
              {currentMarker.text}
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={onClose}
          className="text-xs text-muted-foreground hover:text-foreground rounded p-0.5 hover:bg-accent cursor-pointer"
          aria-label="Close"
        >
          ✕
        </button>
      </div>

      {/* Tabs */}
      <div className="grid grid-cols-5 gap-0.5 rounded-lg bg-muted/60 p-0.5 mb-3 text-[11px]">
        {(
          [
            { id: "question", label: "Q" },
            { id: "answer", label: "Ans" },
            { id: "subquestion", label: "Sub" },
            { id: "marks", label: "Marks" },
            { id: "custom", label: "Custom" },
          ] as const
        ).map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setActiveTab(t.id)}
            className={cn(
              "rounded-md py-1 font-medium transition-all text-center cursor-pointer",
              activeTab === t.id
                ? "bg-background text-foreground shadow-xs font-semibold"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab Contents */}
      <div className="min-h-[140px] flex flex-col justify-between">
        {activeTab === "question" && (
          <div className="space-y-2.5">
            {/* Suggested Question Auto-Increment button */}
            <button
              type="button"
              onClick={() => {
                onSelectMarker({ type: "question", text: suggestedQuestion });
                onClose();
              }}
              className="w-full flex items-center justify-between rounded-lg bg-primary/10 hover:bg-primary/20 text-primary border border-primary/20 px-2.5 py-1.5 text-xs font-semibold cursor-pointer transition-colors"
            >
              <span>Suggested:</span>
              <span className="font-bold text-sm bg-primary text-primary-foreground px-2 py-0.5 rounded-md">
                {suggestedQuestion}
              </span>
            </button>

            <div className="text-[10px] uppercase font-semibold text-muted-foreground px-0.5">
              Quick Numbers
            </div>
            <div className="grid grid-cols-4 gap-1.5">
              {QUESTION_PRESETS.map((q) => (
                <button
                  key={q}
                  type="button"
                  onClick={() => {
                    onSelectMarker({ type: "question", text: q });
                    onClose();
                  }}
                  className={cn(
                    "rounded-md border border-border/80 px-2 py-1 text-xs font-medium hover:bg-accent hover:border-primary/40 cursor-pointer transition-all text-center",
                    currentMarker?.text === q && "bg-primary text-primary-foreground border-primary"
                  )}
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}

        {activeTab === "answer" && (
          <div className="space-y-3 py-2">
            <button
              type="button"
              onClick={() => {
                onSelectMarker({ type: "answer", text: "Ans" });
                onClose();
              }}
              className="w-full rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground py-2.5 text-sm font-semibold cursor-pointer shadow-xs transition-all flex items-center justify-center gap-2"
            >
              <span>Set as Answer:</span>
              <strong className="underline underline-offset-2">Ans</strong>
            </button>
            <div className="text-[11px] text-muted-foreground text-center px-2">
              Labels this block as the direct answer response.
            </div>
          </div>
        )}

        {activeTab === "subquestion" && (
          <div className="space-y-2">
            {/* Suggested subquestion button */}
            <button
              type="button"
              onClick={() => {
                onSelectMarker({ type: "subquestion", text: suggestedSubquestion });
                onClose();
              }}
              className="w-full flex items-center justify-between rounded-lg bg-primary/10 hover:bg-primary/20 text-primary border border-primary/20 px-2.5 py-1 text-xs font-semibold cursor-pointer transition-colors"
            >
              <span>Suggested Next:</span>
              <span className="font-bold bg-primary text-primary-foreground px-2 py-0.5 rounded-md">
                {suggestedSubquestion}
              </span>
            </button>

            <div className="text-[10px] uppercase font-semibold text-muted-foreground px-0.5">
              Alphabetical / Roman
            </div>
            <div className="grid grid-cols-5 gap-1">
              {SUBQUESTION_PRESETS.map((sq) => (
                <button
                  key={sq}
                  type="button"
                  onClick={() => {
                    onSelectMarker({ type: "subquestion", text: sq });
                    onClose();
                  }}
                  className={cn(
                    "rounded-md border border-border/80 p-1 text-xs font-medium hover:bg-accent hover:border-primary/40 cursor-pointer transition-all text-center",
                    currentMarker?.text === sq && "bg-primary text-primary-foreground border-primary"
                  )}
                >
                  {sq}
                </button>
              ))}
            </div>
          </div>
        )}

        {activeTab === "marks" && (
          <div className="space-y-2">
            <div className="text-[10px] uppercase font-semibold text-muted-foreground px-0.5">
              Common Marks
            </div>
            <div className="grid grid-cols-3 gap-1.5">
              {MARKS_PRESETS.map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => {
                    onSelectMarker({ type: "marks", text: m });
                    onClose();
                  }}
                  className={cn(
                    "rounded-md border border-border/80 px-2 py-1.5 text-xs font-medium hover:bg-accent hover:border-primary/40 cursor-pointer transition-all text-center",
                    currentMarker?.text === m && "bg-primary text-primary-foreground border-primary"
                  )}
                >
                  {m}
                </button>
              ))}
            </div>
          </div>
        )}

        {activeTab === "custom" && (
          <form onSubmit={handleApplyCustom} className="space-y-2.5">
            <div className="flex gap-1.5">
              <input
                type="text"
                value={customText}
                onChange={(e) => setCustomText(e.target.value)}
                placeholder="e.g. Note, Fig. 1, Step 1"
                maxLength={24}
                autoFocus
                className="flex-1 rounded-md border border-input bg-background px-2.5 py-1 text-xs shadow-xs outline-none focus:border-primary focus:ring-1 focus:ring-primary"
              />
              <button
                type="submit"
                disabled={!customText.trim()}
                className="rounded-md bg-primary px-3 py-1 text-xs font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50 cursor-pointer"
              >
                Set
              </button>
            </div>

            <div className="text-[10px] uppercase font-semibold text-muted-foreground px-0.5">
              Presets
            </div>
            <div className="flex flex-wrap gap-1">
              {CUSTOM_PRESETS.map((cp) => (
                <button
                  key={cp}
                  type="button"
                  onClick={() => {
                    setCustomText(cp);
                    onSelectMarker({ type: "custom", text: cp });
                    onClose();
                  }}
                  className="rounded border border-border/70 bg-muted/40 px-2 py-0.5 text-[11px] text-muted-foreground hover:text-foreground hover:bg-accent cursor-pointer"
                >
                  {cp}
                </button>
              ))}
            </div>
          </form>
        )}

        {/* Removal option if marker currently exists */}
        {currentMarker && (
          <div className="mt-3 border-t border-border/60 pt-2 flex justify-between items-center">
            <button
              type="button"
              onClick={() => {
                onRemoveMarker();
                onClose();
              }}
              className="text-[11px] font-medium text-destructive hover:bg-destructive/10 rounded px-2 py-1 transition-colors cursor-pointer flex items-center gap-1"
            >
              <span>🗑️</span>
              <span>Remove Marker</span>
            </button>
            <span className="text-[10px] text-muted-foreground">
              Clears label from block
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
