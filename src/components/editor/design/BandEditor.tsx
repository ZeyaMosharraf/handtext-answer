/**
 * BandEditor — shared UI for a header or footer band.
 *
 * Responsibility: scope selector, enable/disable toggle, field list management
 * (add, delete, move, per-page override state), and field card rendering.
 *
 * Used by DesignPanel as <BandEditor which="header" /> and <BandEditor which="footer" />.
 * All band mutation logic is delegated to band-operations.ts — no inline mutations.
 */

import { Plus, RotateCcw, Sparkles } from "lucide-react";
import { useState } from "react";
import { Button, Card, Label, Select } from "@/components/ui/primitives";
import {
  addBandElement,
  computeHasOverride,
  deleteBandElement,
  moveBandElement,
  resetBandToGlobal,
  restoreHiddenElement,
  resolveEffectiveBand,
  setBandEnabled,
  updateBandElement,
  type BandOverride,
  type ElementKind,
  type HandwritingSettings,
  type PageElement,
} from "@/lib/handwriting";
import { FieldEditor } from "./FieldEditor";

interface BandEditorProps {
  /** Which band this editor controls. */
  which: "header" | "footer";
  settings: HandwritingSettings;
  currentPage: number;
  totalPages: number;
  onChange: (next: HandwritingSettings) => void;
}

/** The complete list of field kind options shown in the Add-field dropdown. */
const ELEMENT_KIND_OPTIONS: { id: ElementKind; label: string }[] = [
  { id: "studentName", label: "Name" },
  { id: "enrollment", label: "Enrollment number" },
  { id: "roll", label: "Roll number" },
  { id: "courseCode", label: "Course" },
  { id: "subject", label: "Subject" },
  { id: "college", label: "College/University" },
  { id: "date", label: "Date" },
  { id: "pageNumber", label: "Page number" },
  { id: "teacherName", label: "Teacher name" },
  { id: "assignment", label: "Assignment number" },
  { id: "signature", label: "Teacher signature" },
  { id: "text", label: "Custom text" },
];

export function BandEditor({ which, settings, currentPage, totalPages, onChange }: BandEditorProps) {
  const [scope, setScope] = useState<"all" | "page">("all");
  const [selectedKind, setSelectedKind] = useState<ElementKind>("pageNumber");

  const globalBand = settings[which];
  const pageOverride: BandOverride | undefined = settings.pageOverrides?.[currentPage]?.[which];
  const hasOverride = computeHasOverride(pageOverride);

  // The displayed band merges global defaults with any page-specific overrides
  const displayedBand = scope === "all"
    ? globalBand
    : resolveEffectiveBand(settings, which, currentPage, totalPages);

  const ns = which; // "header" | "footer" — used as id namespace in FieldEditor

  // ── Handlers — all mutations go through band-operations.ts ───────────────

  const handleToggleEnabled = (checked: boolean) =>
    onChange(setBandEnabled(settings, which, scope, currentPage, checked));

  const handleAddElement = () =>
    onChange(addBandElement(settings, which, scope, currentPage, selectedKind, displayedBand));

  const handleDeleteElement = (id: string) =>
    onChange(deleteBandElement(settings, which, scope, currentPage, id, globalBand.elements));

  const handleMoveElement = (id: string, direction: "up" | "down") =>
    onChange(moveBandElement(settings, which, scope, currentPage, id, direction, displayedBand));

  const handleUpdateElement = (id: string, patch: Partial<PageElement>) =>
    onChange(updateBandElement(settings, which, scope, currentPage, id, patch, globalBand.elements));

  const handleResetToGlobal = () =>
    onChange(resetBandToGlobal(settings, which, currentPage));

  const handleRestoreHidden = (hiddenId: string) =>
    onChange(restoreHiddenElement(settings, which, currentPage, hiddenId));

  // ── Render ────────────────────────────────────────────────────────────────

  const bandLabel = which === "header" ? "header" : "footer";

  return (
    <div className="space-y-4">
      {/* Scope card */}
      <Card className="space-y-4 p-4">
        <div className="space-y-1.5">
          <label htmlFor={`${ns}-scope`} className="text-xs font-medium text-muted-foreground">
            Apply to
          </label>
          <Select
            id={`${ns}-scope`}
            value={scope}
            onChange={(e) => setScope(e.target.value as "all" | "page")}
          >
            <option value="all">Every page (Global)</option>
            <option value="page">This page · Page {currentPage}</option>
          </Select>
        </div>

        {scope === "page" &&
          (hasOverride ? (
            <div className="flex items-center justify-between rounded-lg bg-amber-500/10 px-3 py-2 border border-amber-500/25 text-xs">
              <div className="flex items-center gap-1.5 font-medium text-amber-600 dark:text-amber-400">
                <Sparkles className="size-3.5" />
                <span>Custom for Page {currentPage}</span>
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs text-muted-foreground hover:text-foreground hover:bg-amber-500/20"
                onClick={handleResetToGlobal}
              >
                <RotateCcw className="mr-1 size-3" />
                Reset to global
              </Button>
            </div>
          ) : (
            <div className="flex items-center justify-between rounded-lg bg-muted/60 px-3 py-2 text-xs text-muted-foreground">
              <span>Inheriting global defaults</span>
              <span className="text-[10px] text-muted-foreground/80">Edits will customize this page</span>
            </div>
          ))}

        {scope === "all" && hasOverride && (
          <div className="rounded-lg bg-muted/40 px-3 py-1.5 text-[11px] text-muted-foreground">
            Note: Page {currentPage} has custom overrides. Changes here update document defaults.
          </div>
        )}

        <label className="flex items-center gap-2 text-sm font-medium cursor-pointer">
          <input
            type="checkbox"
            className="size-4 accent-primary"
            checked={displayedBand.enabled}
            onChange={(e) => handleToggleEnabled(e.target.checked)}
          />
          <span>Show {bandLabel} {scope === "page" ? `on Page ${currentPage}` : ""}</span>
        </label>
      </Card>

      {/* Field list card */}
      {displayedBand.enabled && (
        <Card className="space-y-4 p-4">
          <div className="flex items-center justify-between">
            <Label className="text-sm font-semibold">Fields</Label>
            {scope === "page" && (
              <span className="text-[11px] text-muted-foreground">
                Page {currentPage} fields
              </span>
            )}
          </div>

          {/* Add field row */}
          <div className="flex gap-2">
            <Select
              id={`${ns}-add-field-select`}
              aria-label="Select field type to add"
              value={selectedKind}
              onChange={(e) => setSelectedKind(e.target.value as ElementKind)}
              className="flex-1 text-xs"
            >
              {ELEMENT_KIND_OPTIONS.map((k) => (
                <option key={k.id} value={k.id}>
                  {k.label}
                </option>
              ))}
            </Select>
            <Button variant="secondary" size="sm" onClick={handleAddElement} className="text-xs shrink-0">
              <Plus className="mr-1 size-3.5" />
              Add field
            </Button>
          </div>

          {/* Hidden field restore list */}
          {scope === "page" && pageOverride?.hiddenElementIds && pageOverride.hiddenElementIds.length > 0 && (
            <div className="rounded-lg border border-dashed border-border p-2.5 space-y-1.5 text-xs text-muted-foreground">
              <div className="font-medium text-foreground">Hidden on Page {currentPage}:</div>
              <div className="flex flex-wrap gap-1.5">
                {pageOverride.hiddenElementIds.map((hiddenId) => {
                  const orig = globalBand.elements.find((e) => e.id === hiddenId);
                  const kindLabel = ELEMENT_KIND_OPTIONS.find((k) => k.id === orig?.kind)?.label ?? "Field";
                  const name = orig?.label || kindLabel;
                  return (
                    <button
                      key={hiddenId}
                      type="button"
                      onClick={() => handleRestoreHidden(hiddenId)}
                      className="inline-flex items-center gap-1 rounded bg-muted px-2 py-0.5 text-xs font-medium hover:bg-accent text-foreground transition-colors"
                    >
                      <span>{name}</span>
                      <span className="text-primary font-bold">↺ Restore</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Field list */}
          {displayedBand.elements.length === 0 ? (
            <p className="text-xs text-muted-foreground py-2 text-center">
              No fields yet. Select a field above and click Add field.
            </p>
          ) : (
            <ul className="space-y-2.5">
              {displayedBand.elements.map((el, index) => {
                const isExtra =
                  scope === "page" && Boolean(pageOverride?.extraElements?.some((e) => e.id === el.id));
                const hasDelta =
                  scope === "page" && Boolean(pageOverride?.elementOverrides?.[el.id]);
                const isFirst = index === 0;
                const isLast = index === displayedBand.elements.length - 1;

                return (
                  <FieldEditor
                    key={el.id}
                    el={el}
                    ns={ns}
                    isFirst={isFirst}
                    isLast={isLast}
                    isExtra={isExtra}
                    hasDelta={hasDelta}
                    scope={scope}
                    onUpdate={(patch) => handleUpdateElement(el.id, patch)}
                    onMove={(dir) => handleMoveElement(el.id, dir)}
                    onDelete={() => handleDeleteElement(el.id)}
                  />
                );
              })}
            </ul>
          )}
        </Card>
      )}
    </div>
  );
}
