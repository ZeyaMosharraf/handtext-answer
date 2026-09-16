/**
 * TableSettingsPanel — the "Tables" tab content.
 *
 * Responsibility: column alignment UI and table style sliders.
 *
 * This is also the correct home for future table features
 * (e.g., cell whitespace preservation options, border styles).
 */

import { useMemo } from "react";
import { ColorField } from "@/components/editor/ColorField";
import { Button, Card, Label, Slider } from "@/components/ui/primitives";
import {
  parseContent,
  type ColumnAlignment,
  type HandwritingSettings,
} from "@/lib/handwriting";

interface Props {
  settings: HandwritingSettings;
  onChange: (next: HandwritingSettings) => void;
  content?: string | undefined;
  onSetTableColumnAlignment?: ((colIndex: number, alignment: ColumnAlignment) => void) | undefined;
}

export function TableSettingsPanel({ settings, onChange, content, onSetTableColumnAlignment }: Props) {
  const tableColumns = useMemo(() => {
    if (!content) return [];
    const blocks = parseContent(content);
    const tableBlock = blocks.find((b) => b.kind === "table" && b.table);
    if (!tableBlock?.table || tableBlock.table.rows.length === 0) return [];
    const firstRow = tableBlock.table.rows[0] ?? [];
    const alignments = tableBlock.table.alignments ?? [];
    return firstRow.map((cell, idx) => {
      const cellText = typeof cell === "string" ? cell : cell.text;
      return {
        name: cellText.split("\n")[0]?.trim() || `Column ${idx + 1}`,
        alignment: alignments[idx] ?? "left",
      };
    });
  }, [content]);

  return (
    <div className="space-y-4">
      {tableColumns.length > 0 && (
        <Card className="space-y-3 p-4">
          <div className="flex items-center justify-between">
            <Label className="text-sm font-semibold">Column alignment</Label>
            <span className="text-[10px] text-muted-foreground font-mono">{tableColumns.length} columns</span>
          </div>
          <p className="text-xs text-muted-foreground">
            Set text alignment for each column in your table.
          </p>
          <div className="space-y-2.5">
            {tableColumns.map((col, idx) => (
              <div key={idx} className="rounded-lg border border-border bg-card p-3 space-y-2">
                <div className="space-y-0.5">
                  <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Column</div>
                  <div className="text-xs font-semibold text-foreground truncate">{col.name}</div>
                </div>
                <div className="space-y-1">
                  <div className="text-[10px] font-medium text-muted-foreground">Alignment</div>
                  <div className="grid grid-cols-3 gap-1">
                    {(["left", "center", "right"] as const).map((alignment) => (
                      <Button
                        key={alignment}
                        type="button"
                        size="sm"
                        variant={col.alignment === alignment ? "primary" : "outline"}
                        className="h-7 text-xs capitalize cursor-pointer"
                        onClick={() => onSetTableColumnAlignment?.(idx, alignment)}
                      >
                        {alignment.charAt(0).toUpperCase() + alignment.slice(1)}
                      </Button>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      <Card className="space-y-4 p-4">
        <Label>Table style</Label>
        <p className="text-xs text-muted-foreground">
          Tables are written by hand: borders and cell text use the same pen as your answer.
        </p>
        <ColorField
          label="Border colour"
          value={settings.table.borderColor}
          onChange={(hex) => onChange({ ...settings, table: { ...settings.table, borderColor: hex } })}
        />
        <Slider
          label="Border thickness"
          min={0.8}
          max={4}
          step={0.1}
          value={settings.table.borderWidth}
          onChange={(e) => onChange({ ...settings, table: { ...settings.table, borderWidth: Number(e.target.value) } })}
        />
        <Slider
          label="Handwriting size in cells"
          min={0.6}
          max={1.1}
          step={0.02}
          value={settings.table.fontScale}
          onChange={(e) => onChange({ ...settings, table: { ...settings.table, fontScale: Number(e.target.value) } })}
        />
        <Slider
          label="Cell padding"
          min={4}
          max={30}
          step={1}
          value={settings.table.cellPadding}
          onChange={(e) => onChange({ ...settings, table: { ...settings.table, cellPadding: Number(e.target.value) } })}
          suffix="px"
        />
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            className="size-4 accent-primary"
            checked={settings.table.repeatHeader}
            onChange={(e) => onChange({ ...settings, table: { ...settings.table, repeatHeader: e.target.checked } })}
          />
          Repeat the header row on new pages
        </label>
      </Card>
    </div>
  );
}
