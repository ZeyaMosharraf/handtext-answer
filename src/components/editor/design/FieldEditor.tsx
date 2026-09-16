/**
 * FieldEditor — a single header/footer field card.
 *
 * Responsibility: render the controls for one PageElement (value, format,
 * text size, handwritten toggle, pen color, position, move, delete).
 *
 * Used by BandEditor for both header and footer — one implementation only.
 */

import { ChevronDown, ChevronUp, Trash2 } from "lucide-react";
import { Button, Input, Select } from "@/components/ui/primitives";
import {
  FIELD_PEN_COLORS,
  INK_COLORS,
  TEXT_SIZE_PRESETS,
  fontSizeForTextSize,
  getTextSizePreset,
  type ElementKind,
  type ElementTextSize,
  type PageElement,
  type PageNumberFormat,
} from "@/lib/handwriting";
import { cn } from "@/lib/utils";

const PAGE_NUMBER_FORMATS: { id: PageNumberFormat; label: string }[] = [
  { id: "page-n", label: "Page 1" },
  { id: "n", label: "1" },
  { id: "page-dash-n", label: "Page - 1" },
  { id: "pg-n", label: "Pg. 1" },
  { id: "n-of-t", label: "1 / 6" },
  { id: "page-n-of-t", label: "Page 1 of 6" },
];

interface FieldEditorProps {
  /** The field element to display. */
  el: PageElement;
  /** Namespace prefix for HTML ids — "header" or "footer" to ensure uniqueness across tabs. */
  ns: "header" | "footer";
  /** True when this is the first element in the list (disables move-up). */
  isFirst: boolean;
  /** True when this is the last element in the list (disables move-down). */
  isLast: boolean;
  /** True when this element was added as a page-specific extra. */
  isExtra: boolean;
  /** True when this element has page-specific overrides relative to the global band. */
  hasDelta: boolean;
  /** Current scope — controls whether text-size also updates fontSize. */
  scope: "all" | "page";
  /** Called when any field property changes. */
  onUpdate: (patch: Partial<PageElement>) => void;
  /** Called to reorder this element. */
  onMove: (direction: "up" | "down") => void;
  /** Called to remove this element. */
  onDelete: () => void;
}

/** Human-readable labels for all ElementKind values. */
const ELEMENT_KIND_LABELS: Record<ElementKind, string> = {
  studentName: "Name",
  enrollment: "Enrollment number",
  roll: "Roll number",
  courseCode: "Course",
  subject: "Subject",
  college: "College/University",
  date: "Date",
  pageNumber: "Page number",
  teacherName: "Teacher name",
  assignment: "Assignment number",
  signature: "Teacher signature",
  text: "Custom text",
};

function getFieldPlaceholder(kind: ElementKind): string {
  switch (kind) {
    case "studentName": return "Student / Name (or leave blank for line)";
    case "subject": return "Subject name";
    case "date": return "Date (or leave blank for line)";
    case "enrollment": return "Enrollment number";
    case "roll": return "Roll number";
    case "college": return "College / University";
    case "teacherName": return "Teacher name";
    case "signature": return "Signature line (or leave blank)";
    case "assignment": return "Assignment name or number";
    case "courseCode": return "Course name or code";
    case "text": return "Custom text (e.g. Confidential Examination Script)";
    default: return "Value";
  }
}

export function FieldEditor({
  el,
  ns,
  isFirst,
  isLast,
  isExtra,
  hasDelta,
  scope,
  onUpdate,
  onMove,
  onDelete,
}: FieldEditorProps) {
  const kindLabel = ELEMENT_KIND_LABELS[el.kind] ?? el.label ?? "Field";

  const handleTextSizeChange = (nextSize: ElementTextSize) => {
    if (scope === "all") {
      onUpdate({ textSize: nextSize, fontSize: fontSizeForTextSize(nextSize) });
    } else {
      onUpdate({ textSize: nextSize });
    }
  };

  return (
    <li className="rounded-lg border border-border bg-card p-3 space-y-2 transition-colors">
      {/* Header row: label, badges, action buttons */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-xs font-semibold text-foreground truncate">{kindLabel}</span>
          {isExtra && (
            <span className="rounded bg-primary/10 px-1.5 py-0.2 text-[9px] font-medium text-primary">
              page extra
            </span>
          )}
          {hasDelta && (
            <span className="rounded bg-amber-500/10 px-1.5 py-0.2 text-[9px] font-medium text-amber-600 dark:text-amber-400">
              custom
            </span>
          )}
        </div>

        <div className="flex items-center gap-0.5 shrink-0">
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 text-muted-foreground hover:text-foreground disabled:opacity-30"
            disabled={isFirst}
            aria-label={`Move ${kindLabel} up`}
            onClick={() => onMove("up")}
          >
            <ChevronUp className="size-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 text-muted-foreground hover:text-foreground disabled:opacity-30"
            disabled={isLast}
            aria-label={`Move ${kindLabel} down`}
            onClick={() => onMove("down")}
          >
            <ChevronDown className="size-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 text-muted-foreground hover:text-destructive"
            aria-label={`Remove ${kindLabel}`}
            onClick={onDelete}
          >
            <Trash2 className="size-3.5" />
          </Button>
        </div>
      </div>

      {/* Field value or page-number format */}
      {el.kind === "pageNumber" ? (
        <div className="space-y-1.5">
          <div className="space-y-1">
            <label htmlFor={`${ns}-field-format-${el.id}`} className="text-[11px] text-muted-foreground">
              Number format
            </label>
            <Select
              id={`${ns}-field-format-${el.id}`}
              aria-label="Page number format"
              value={el.format ?? "n"}
              onChange={(e) => onUpdate({ format: e.target.value as PageNumberFormat })}
              className="text-xs h-8"
            >
              {PAGE_NUMBER_FORMATS.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.label}
                </option>
              ))}
            </Select>
          </div>
          <div className="space-y-1">
            <label htmlFor={`${ns}-field-start-${el.id}`} className="text-[11px] text-muted-foreground">
              Starting page number
            </label>
            <Input
              id={`${ns}-field-start-${el.id}`}
              type="number"
              min={1}
              step={1}
              aria-label="Starting page number"
              value={el.startPageNumber ?? 1}
              onChange={(e) => {
                const raw = e.target.value;
                if (raw === "") { onUpdate({ startPageNumber: 1 }); return; }
                const parsed = parseInt(raw, 10);
                if (!isNaN(parsed) && parsed >= 1) onUpdate({ startPageNumber: parsed });
              }}
              className="text-xs h-8"
            />
          </div>
        </div>
      ) : (
        <div className="space-y-1">
          <Input
            id={`${ns}-field-val-${el.id}`}
            value={el.value}
            aria-label={`${kindLabel} value`}
            placeholder={getFieldPlaceholder(el.kind)}
            onChange={(e) => onUpdate({ value: e.target.value })}
            className="text-xs h-8"
          />
        </div>
      )}

      {/* Text size */}
      <div className="space-y-1">
        <label htmlFor={`${ns}-field-text-size-${el.id}`} className="text-[11px] text-muted-foreground">
          Text size
        </label>
        <Select
          id={`${ns}-field-text-size-${el.id}`}
          aria-label="Text size"
          value={el.textSize ?? getTextSizePreset(el.fontSize)}
          onChange={(e) => handleTextSizeChange(e.target.value as ElementTextSize)}
          className="text-xs h-8"
        >
          {TEXT_SIZE_PRESETS.map((preset) => (
            <option key={preset.id} value={preset.id}>
              {preset.label}
            </option>
          ))}
        </Select>
      </div>

      {/* Handwritten toggle */}
      <div className="pt-0.5">
        <label className="inline-flex items-center gap-2 text-xs font-medium cursor-pointer select-none text-foreground">
          <input
            type="checkbox"
            id={`${ns}-field-handwritten-${el.id}`}
            checked={Boolean(el.handwritten)}
            onChange={(e) => {
              const isChecked = e.target.checked;
              onUpdate({
                handwritten: isChecked,
                ...(isChecked && (!el.color || el.color === "#333333") ? { color: INK_COLORS.blue } : {}),
              });
            }}
            className="size-3.5 rounded border-border accent-primary cursor-pointer"
          />
          <span>Handwritten</span>
        </label>
      </div>

      {/* Pen color — only when handwritten */}
      {el.handwritten && (
        <div className="space-y-1 pt-0.5">
          <label htmlFor={`${ns}-field-color-${el.id}`} className="text-[11px] font-medium text-muted-foreground">
            Pen color
          </label>
          <Select
            id={`${ns}-field-color-${el.id}`}
            aria-label="Pen color"
            value={el.color && Object.values(INK_COLORS).includes(el.color) ? el.color : INK_COLORS.blue}
            onChange={(e) => onUpdate({ color: e.target.value })}
            className="text-xs h-8"
          >
            {FIELD_PEN_COLORS.map((c) => (
              <option key={c.id} value={c.value}>
                {c.label}
              </option>
            ))}
          </Select>
        </div>
      )}

      {/* Position segmented control */}
      <div className="space-y-1 pt-0.5">
        <span className="text-[11px] font-medium text-muted-foreground">Position</span>
        <div className="grid grid-cols-3 gap-1 rounded-md bg-muted/60 p-0.5 border border-border/40">
          {(["left", "center", "right"] as const).map((pos) => {
            const isSelected = (el.slot ?? "left") === pos;
            return (
              <button
                key={pos}
                type="button"
                id={`${ns}-field-pos-${el.id}-${pos}`}
                onClick={() => onUpdate({ slot: pos })}
                className={cn(
                  "h-6 rounded text-[11px] font-medium transition-all capitalize",
                  isSelected
                    ? "bg-background text-foreground shadow-sm font-semibold"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {pos}
              </button>
            );
          })}
        </div>
      </div>
    </li>
  );
}

// Re-export page number formats for BandEditor convenience
export { PAGE_NUMBER_FORMATS };
export type { ElementKind };
