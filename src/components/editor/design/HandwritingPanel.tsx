/**
 * HandwritingPanel — the "Handwriting" tab content.
 *
 * Responsibility: handwriting personality styles, academic presets,
 * writing sliders, and pen & ink controls.
 */

import { ColorField } from "@/components/editor/ColorField";
import { Badge, Card, Label, Select, Slider } from "@/components/ui/primitives";
import {
  FORMAT_PRESETS,
  HANDWRITING_STYLES,
  HAND_FONTS,
  INK_COLORS,
  INK_LABELS,
  styleSettings,
  type HandwritingSettings,
  type InkColor,
} from "@/lib/handwriting";
import { cn } from "@/lib/utils";

interface Props {
  settings: HandwritingSettings;
  onChange: (next: HandwritingSettings) => void;
}

export function HandwritingPanel({ settings, onChange }: Props) {
  const set = <K extends keyof HandwritingSettings>(key: K, value: HandwritingSettings[K]) =>
    onChange({ ...settings, [key]: value });

  const num = (key: keyof HandwritingSettings) => (e: React.ChangeEvent<HTMLInputElement>) =>
    onChange({ ...settings, [key]: Number(e.target.value) });

  return (
    <div className="space-y-4">
      <section className="space-y-2">
        <Label>Handwriting personality</Label>
        <div className="grid gap-2 sm:grid-cols-2">
          {HANDWRITING_STYLES.map((style) => {
            const active = settings.styleId === style.id;
            return (
              <button
                key={style.id}
                type="button"
                aria-pressed={active}
                onClick={() => onChange(styleSettings(style.id, settings))}
                className={cn(
                  "rounded-lg border p-3 text-left transition-colors",
                  active ? "border-primary bg-accent" : "border-border bg-card hover:bg-muted",
                )}
              >
                <span
                  className="block truncate text-xl leading-tight text-foreground"
                  style={{ fontFamily: `"${style.settings.fontFamily ?? settings.fontFamily}", cursive` }}
                >
                  {style.id === "custom" ? "Your own settings" : "The quick answer"}
                </span>
                <span className="mt-1 block text-sm font-semibold">{style.name}</span>
                <span className="block text-xs text-muted-foreground">{style.description}</span>
              </button>
            );
          })}
        </div>
      </section>

      <section className="space-y-2">
        <Label>Academic presets</Label>
        <div className="flex flex-wrap gap-2">
          {FORMAT_PRESETS.map((preset) => (
            <button
              key={preset.id}
              type="button"
              title={preset.description}
              onClick={() => onChange({ ...settings, ...preset.settings } as HandwritingSettings)}
              className="rounded-full border border-border bg-card px-3 py-1 text-xs font-medium hover:bg-muted"
            >
              {preset.name}
            </button>
          ))}
        </div>
      </section>

      <Card className="space-y-4 p-4">
        <div className="flex items-center justify-between">
          <Label>Writing</Label>
          <Badge>{settings.styleId}</Badge>
        </div>
        <div className="space-y-1.5">
          <label htmlFor="font" className="text-xs font-medium text-muted-foreground">
            Handwriting model
          </label>
          <Select id="font" value={settings.fontFamily} onChange={(e) => set("fontFamily", e.target.value)}>
            {HAND_FONTS.map((f: string) => (
              <option key={f} value={f}>
                {f}
              </option>
            ))}
          </Select>
        </div>
        <Slider label="Size" min={20} max={48} step={1} value={settings.fontSize} onChange={num("fontSize")} suffix="px" />
        <Slider label="Slant" min={-6} max={12} step={0.5} value={settings.slant} onChange={num("slant")} suffix="°" />
        <Slider label="Letter spacing" min={-1} max={4} step={0.1} value={settings.letterSpacing} onChange={num("letterSpacing")} />
        <Slider label="Word spacing" min={4} max={24} step={0.5} value={settings.wordSpacing} onChange={num("wordSpacing")} />
        <Slider label="Line spacing" min={1.2} max={2.4} step={0.05} value={settings.lineSpacing} onChange={num("lineSpacing")} />
        <Slider label="Natural variation" min={0} max={1} step={0.05} value={settings.charVariation} onChange={num("charVariation")} />
        <Slider label="Writing pressure" min={0} max={1} step={0.05} value={settings.pressure} onChange={num("pressure")} />
        <Slider label="Writing speed" min={0} max={1} step={0.05} value={settings.writingSpeed} onChange={num("writingSpeed")} />
        <Slider label="Baseline variation" min={0} max={4} step={0.1} value={settings.baselineVariation} onChange={num("baselineVariation")} />
        <Slider label="Slant variation" min={0} max={4} step={0.1} value={settings.slantVariation} onChange={num("slantVariation")} />
        <Slider label="Imperfections" min={0} max={1} step={0.05} value={settings.imperfection} onChange={num("imperfection")} />
        <Slider label="Compactness" min={0.82} max={1.12} step={0.01} value={settings.compactness} onChange={num("compactness")} />
      </Card>

      <Card className="space-y-4 p-4">
        <Label>Pen &amp; ink</Label>
        <div className="flex flex-wrap gap-1.5">
          {(Object.keys(INK_LABELS) as InkColor[]).map((ink) => (
            <button
              key={ink}
              type="button"
              aria-pressed={settings.ink === ink}
              onClick={() => set("ink", ink)}
              className={cn(
                "flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium",
                settings.ink === ink ? "border-primary bg-accent" : "border-border bg-card hover:bg-muted",
              )}
            >
              <span
                className="size-3 rounded-full border border-border"
                style={{ backgroundColor: ink === "custom" ? settings.inkCustom : INK_COLORS[ink] }}
              />
              {INK_LABELS[ink]}
            </button>
          ))}
        </div>
        <ColorField
          label="Custom ink colour"
          value={settings.inkCustom}
          onChange={(hex) => onChange({ ...settings, inkCustom: hex, ink: "custom" })}
        />
        <Slider label="Pen thickness" min={1} max={3} step={0.1} value={settings.penWidth} onChange={num("penWidth")} />
        <Slider label="Ink intensity" min={0.5} max={1} step={0.02} value={settings.inkIntensity} onChange={num("inkIntensity")} />
        <Slider label="Ink variation" min={0} max={1} step={0.05} value={settings.inkVariation} onChange={num("inkVariation")} />
      </Card>
    </div>
  );
}
