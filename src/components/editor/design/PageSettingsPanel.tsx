/**
 * PageSettingsPanel — the "Page" tab content.
 *
 * Responsibility: page size, orientation, paper style, texture,
 * colour presets, ruling, and margin/writing area controls.
 */

import { ColorField } from "@/components/editor/ColorField";
import { Card, Input, Label, Select, Slider } from "@/components/ui/primitives";
import {
  COLOR_PRESETS,
  MARGIN_COLORS,
  PAGE_SIZES,
  PAPERS,
  PAPER_COLORS,
  RULING_COLORS,
  type HandwritingSettings,
  type Orientation,
  type PageSizeKey,
  type PaperKind,
} from "@/lib/handwriting";

interface Props {
  settings: HandwritingSettings;
  onChange: (next: HandwritingSettings) => void;
}

export function PageSettingsPanel({ settings, onChange }: Props) {
  const setPage = (patch: Partial<HandwritingSettings["page"]>) =>
    onChange({ ...settings, page: { ...settings.page, ...patch } });

  const num = (key: keyof HandwritingSettings) => (e: React.ChangeEvent<HTMLInputElement>) =>
    onChange({ ...settings, [key]: Number(e.target.value) });

  return (
    <div className="space-y-4">
      <Card className="space-y-4 p-4">
        <Label>Page size</Label>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <label htmlFor="psize" className="text-xs font-medium text-muted-foreground">
              Size
            </label>
            <Select id="psize" value={settings.page.size} onChange={(e) => setPage({ size: e.target.value as PageSizeKey })}>
              {Object.entries(PAGE_SIZES).map(([key, v]) => (
                <option key={key} value={key}>
                  {v.label}
                </option>
              ))}
            </Select>
          </div>
          <div className="space-y-1.5">
            <label htmlFor="orient" className="text-xs font-medium text-muted-foreground">
              Orientation
            </label>
            <Select
              id="orient"
              value={settings.page.orientation}
              onChange={(e) => setPage({ orientation: e.target.value as Orientation })}
            >
              <option value="portrait">Portrait</option>
              <option value="landscape">Landscape</option>
            </Select>
          </div>
        </div>
        {settings.page.size === "custom" && (
          <div className="grid grid-cols-2 gap-3">
            <Input
              type="number"
              aria-label="Custom width"
              value={settings.page.customWidth}
              onChange={(e) => setPage({ customWidth: Number(e.target.value) })}
            />
            <Input
              type="number"
              aria-label="Custom height"
              value={settings.page.customHeight}
              onChange={(e) => setPage({ customHeight: Number(e.target.value) })}
            />
          </div>
        )}
        <div className="space-y-1.5">
          <label htmlFor="paper" className="text-xs font-medium text-muted-foreground">
            Paper style
          </label>
          <Select id="paper" value={settings.paper} onChange={(e) => onChange({ ...settings, paper: e.target.value as PaperKind })}>
            {PAPERS.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label}
              </option>
            ))}
          </Select>
        </div>
        <div className="space-y-1.5">
          <label htmlFor="texture" className="text-xs font-medium text-muted-foreground">
            Paper texture
          </label>
          <Select
            id="texture"
            value={settings.page.texture}
            onChange={(e) => setPage({ texture: e.target.value as HandwritingSettings["page"]["texture"] })}
          >
            <option value="off">Off</option>
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
          </Select>
        </div>
      </Card>

      <Card className="space-y-4 p-4">
        <Label>Colours</Label>
        <div className="flex flex-wrap gap-2">
          {COLOR_PRESETS.map((preset) => (
            <button
              key={preset.id}
              type="button"
              onClick={() =>
                onChange({
                  ...settings,
                  ink: "custom",
                  inkCustom: preset.ink,
                  page: {
                    ...settings.page,
                    paperColor: preset.paper,
                    ruling: { ...settings.page.ruling, color: preset.ruling },
                    margin: { ...settings.page.margin, color: preset.margin },
                  },
                })
              }
              className="rounded-full border border-border bg-card px-3 py-1 text-xs font-medium hover:bg-muted"
            >
              {preset.name}
            </button>
          ))}
        </div>
        <ColorField
          label="Paper colour"
          value={settings.page.paperColor}
          presets={PAPER_COLORS}
          onChange={(hex) => setPage({ paperColor: hex })}
        />
        <ColorField
          label="Ruling colour"
          value={settings.page.ruling.color}
          presets={RULING_COLORS}
          onChange={(hex) => setPage({ ruling: { ...settings.page.ruling, color: hex } })}
        />
        <ColorField
          label="Margin colour"
          value={settings.page.margin.color}
          presets={MARGIN_COLORS}
          onChange={(hex) => setPage({ margin: { ...settings.page.margin, color: hex } })}
        />
      </Card>

      <Card className="space-y-4 p-4">
        <Label>Ruling</Label>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            className="size-4 accent-primary"
            checked={settings.page.ruling.enabled}
            onChange={(e) => setPage({ ruling: { ...settings.page.ruling, enabled: e.target.checked } })}
          />
          Show ruling lines
        </label>
        <Slider
          label="Ruling strength"
          min={0.1}
          max={1}
          step={0.05}
          value={settings.page.ruling.opacity}
          onChange={(e) => setPage({ ruling: { ...settings.page.ruling, opacity: Number(e.target.value) } })}
        />
        <div className="space-y-1.5">
          <label htmlFor="rw" className="text-xs font-medium text-muted-foreground">
            Ruling width
          </label>
          <Select
            id="rw"
            value={String(settings.page.ruling.thickness)}
            onChange={(e) => setPage({ ruling: { ...settings.page.ruling, thickness: Number(e.target.value) } })}
          >
            <option value="0.8">Thin</option>
            <option value="1">Medium</option>
            <option value="1.6">Thick</option>
          </Select>
        </div>
      </Card>

      <Card className="space-y-4 p-4">
        <Label>Margin &amp; writing area</Label>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            className="size-4 accent-primary"
            checked={settings.page.margin.enabled}
            onChange={(e) => setPage({ margin: { ...settings.page.margin, enabled: e.target.checked } })}
          />
          Show margin line
        </label>
        <Slider
          label="Margin position"
          min={40}
          max={260}
          step={2}
          value={settings.page.margin.position}
          onChange={(e) => setPage({ margin: { ...settings.page.margin, position: Number(e.target.value) } })}
          suffix="px"
        />
        <Slider
          label="Margin thickness"
          min={0.8}
          max={4}
          step={0.1}
          value={settings.page.margin.thickness}
          onChange={(e) => setPage({ margin: { ...settings.page.margin, thickness: Number(e.target.value) } })}
        />
        <Slider label="Text left inset" min={60} max={280} step={5} value={settings.marginLeft} onChange={num("marginLeft")} suffix="px" />
        <Slider label="Top inset" min={40} max={240} step={5} value={settings.marginTop} onChange={num("marginTop")} suffix="px" />
        <Slider label="Right inset" min={40} max={220} step={5} value={settings.marginRight} onChange={num("marginRight")} suffix="px" />
        <Slider label="Bottom inset" min={40} max={220} step={5} value={settings.marginBottom} onChange={num("marginBottom")} suffix="px" />
      </Card>
    </div>
  );
}
