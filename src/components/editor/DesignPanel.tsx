import { Plus, Trash2 } from "lucide-react";
import { useState } from "react";

import { ColorField } from "@/components/editor/ColorField";
import { Badge, Button, Card, Input, Label, Select, Slider } from "@/components/ui/primitives";
import {
  COLOR_PRESETS,
  FORMAT_PRESETS,
  HANDWRITING_STYLES,
  HAND_FONTS,
  INK_COLORS,
  INK_LABELS,
  MARGIN_COLORS,
  PAGE_SIZES,
  PAGE_TEMPLATES,
  PAPERS,
  PAPER_COLORS,
  RULING_COLORS,
  applyTemplate,
  newElement,
  styleSettings,
  type ApplyTo,
  type BandConfig,
  type ElementKind,
  type HandwritingSettings,
  type InkColor,
  type Orientation,
  type PageElement,
  type PageNumberFormat,
  type PageSizeKey,
  type PaperKind,
  type Slot,
} from "@/lib/handwriting";
import { cn } from "@/lib/utils";

interface Props {
  settings: HandwritingSettings;
  onChange: (next: HandwritingSettings) => void;
  onSaveTemplate: (name: string) => void;
  templates: { id: string; name: string; settings: HandwritingSettings }[];
  onLoadTemplate: (id: string) => void;
  onDeleteTemplate: (id: string) => void;
}

type TabId = "handwriting" | "page" | "header" | "footer" | "tables" | "templates";

const TABS: { id: TabId; label: string }[] = [
  { id: "handwriting", label: "Handwriting" },
  { id: "page", label: "Page" },
  { id: "header", label: "Header" },
  { id: "footer", label: "Footer" },
  { id: "tables", label: "Tables" },
  { id: "templates", label: "Templates" },
];

const ELEMENT_KINDS: { id: ElementKind; label: string }[] = [
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

const PAGE_NUMBER_FORMATS: { id: PageNumberFormat; label: string }[] = [
  { id: "page-n", label: "Page 1" },
  { id: "n", label: "1" },
  { id: "page-dash-n", label: "Page - 1" },
  { id: "pg-n", label: "Pg. 1" },
  { id: "n-of-t", label: "1 / 6" },
  { id: "page-n-of-t", label: "Page 1 of 6" },
];

export function DesignPanel({
  settings,
  onChange,
  onSaveTemplate,
  templates,
  onLoadTemplate,
  onDeleteTemplate,
}: Props) {
  const [tab, setTab] = useState<TabId>("handwriting");
  const [templateName, setTemplateName] = useState("");

  const set = <K extends keyof HandwritingSettings>(key: K, value: HandwritingSettings[K]) =>
    onChange({ ...settings, [key]: value });

  const num = (key: keyof HandwritingSettings) => (e: React.ChangeEvent<HTMLInputElement>) =>
    onChange({ ...settings, [key]: Number(e.target.value) });

  const setPage = (patch: Partial<HandwritingSettings["page"]>) =>
    onChange({ ...settings, page: { ...settings.page, ...patch } });

  const setBand = (which: "header" | "footer", patch: Partial<BandConfig>) =>
    onChange({ ...settings, [which]: { ...settings[which], ...patch } });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-1" role="tablist" aria-label="Design panel">
        {TABS.map((t) => (
          <button
            key={t.id}
            role="tab"
            aria-selected={tab === t.id}
            onClick={() => setTab(t.id)}
            className={cn(
              "rounded-full px-3 py-1.5 text-xs font-medium transition-colors",
              tab === t.id ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-accent",
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "handwriting" && (
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
                {HAND_FONTS.map((f) => (
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
            <ColorField label="Custom ink colour" value={settings.inkCustom} onChange={(hex) => onChange({ ...settings, inkCustom: hex, ink: "custom" })} />
            <Slider label="Pen thickness" min={1} max={3} step={0.1} value={settings.penWidth} onChange={num("penWidth")} />
            <Slider label="Ink intensity" min={0.5} max={1} step={0.02} value={settings.inkIntensity} onChange={num("inkIntensity")} />
            <Slider label="Ink variation" min={0} max={1} step={0.05} value={settings.inkVariation} onChange={num("inkVariation")} />
          </Card>
        </div>
      )}

      {tab === "page" && (
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
              <Select id="paper" value={settings.paper} onChange={(e) => set("paper", e.target.value as PaperKind)}>
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
            <ColorField label="Paper colour" value={settings.page.paperColor} presets={PAPER_COLORS} onChange={(hex) => setPage({ paperColor: hex })} />
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
      )}

      {(tab === "header" || tab === "footer") && (
        <BandEditor
          which={tab}
          band={settings[tab]}
          onChange={(patch) => setBand(tab, patch)}
        />
      )}

      {tab === "tables" && (
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
      )}

      {tab === "templates" && (
        <div className="space-y-4">
          <Card className="space-y-3 p-4">
            <Label>Physical Paper Templates</Label>
            <div className="grid gap-2">
              {PAGE_TEMPLATES.map((t) => {
                const isSelected = (settings.templateId ?? "assignment") === t.id;
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => onChange(applyTemplate(t.id, settings))}
                    className={cn(
                      "rounded-lg border p-3 text-left transition-colors",
                      isSelected
                        ? "border-primary bg-primary/10 shadow-sm"
                        : "border-border bg-card hover:bg-muted",
                    )}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-semibold">{t.name}</span>
                      {t.badge && (
                        <span
                          className={cn(
                            "rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider",
                            isSelected
                              ? "bg-primary text-primary-foreground"
                              : "bg-muted text-muted-foreground",
                          )}
                        >
                          {t.badge}
                        </span>
                      )}
                    </div>
                    <span className="mt-0.5 block text-xs text-muted-foreground">{t.description}</span>
                  </button>
                );
              })}
            </div>
          </Card>

          <Card className="space-y-3 p-4">
            <Label>My templates</Label>
            <div className="flex gap-2">
              <Input
                value={templateName}
                onChange={(e) => setTemplateName(e.target.value)}
                placeholder="My University Answer Sheet"
                aria-label="Template name"
              />
              <Button
                variant="secondary"
                onClick={() => {
                  if (!templateName.trim()) return;
                  onSaveTemplate(templateName.trim());
                  setTemplateName("");
                }}
              >
                Save
              </Button>
            </div>
            {templates.length === 0 ? (
              <p className="text-xs text-muted-foreground">Save the current page design to reuse it in other answers.</p>
            ) : (
              <ul className="space-y-2">
                {templates.map((t) => (
                  <li key={t.id} className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => onLoadTemplate(t.id)}
                      className="flex-1 rounded-lg border border-border bg-card px-3 py-2 text-left text-sm hover:bg-muted"
                    >
                      {t.name}
                    </button>
                    <Button variant="ghost" size="icon" aria-label={`Delete ${t.name}`} onClick={() => onDeleteTemplate(t.id)}>
                      <Trash2 className="size-4" />
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      )}
    </div>
  );
}

/* ------------------------------- band editor ------------------------------ */

function BandEditor({
  which,
  band,
  onChange,
}: {
  which: "header" | "footer";
  band: BandConfig;
  onChange: (patch: Partial<BandConfig>) => void;
}) {
  const [kind, setKind] = useState<ElementKind>(which === "header" ? "date" : "pageNumber");

  const updateElement = (id: string, patch: Partial<PageElement>) =>
    onChange({ elements: band.elements.map((el) => (el.id === id ? { ...el, ...patch } : el)) });

  return (
    <div className="space-y-4">
      <Card className="space-y-4 p-4">
        <label className="flex items-center gap-2 text-sm font-medium">
          <input
            type="checkbox"
            className="size-4 accent-primary"
            checked={band.enabled}
            onChange={(e) => onChange({ enabled: e.target.checked })}
          />
          Enable {which}
        </label>
        <div className="space-y-1.5">
          <label htmlFor={`${which}-apply`} className="text-xs font-medium text-muted-foreground">
            Apply to
          </label>
          <Select id={`${which}-apply`} value={band.applyTo} onChange={(e) => onChange({ applyTo: e.target.value as ApplyTo })}>
            <option value="all">Every page</option>
            <option value="first">First page only</option>
            <option value="last">Last page only</option>
          </Select>
        </div>
        <Slider
          label={`${which === "header" ? "Header" : "Footer"} height`}
          min={60}
          max={340}
          step={5}
          value={band.height}
          onChange={(e) => onChange({ height: Number(e.target.value) })}
          suffix="px"
        />
        <div className="flex gap-4 text-sm">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              className="size-4 accent-primary"
              checked={band.borderTop}
              onChange={(e) => onChange({ borderTop: e.target.checked })}
            />
            Top border
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              className="size-4 accent-primary"
              checked={band.borderBottom}
              onChange={(e) => onChange({ borderBottom: e.target.checked })}
            />
            Bottom border
          </label>
        </div>
        <ColorField label="Border colour" value={band.borderColor} onChange={(hex) => onChange({ borderColor: hex })} />
      </Card>

      <Card className="space-y-3 p-4">
        <Label>Fields</Label>
        <div className="flex gap-2">
          <Select aria-label="Field type" value={kind} onChange={(e) => setKind(e.target.value as ElementKind)}>
            {ELEMENT_KINDS.map((k) => (
              <option key={k.id} value={k.id}>
                {k.label}
              </option>
            ))}
          </Select>
          <Button
            variant="secondary"
            onClick={() =>
              onChange({
                enabled: true,
                elements: [...band.elements, newElement(kind)],
              })
            }
          >
            <Plus className="size-4" />
            Add
          </Button>
        </div>

        {band.elements.length === 0 && (
          <p className="text-xs text-muted-foreground">No fields yet — select a field type and click Add.</p>
        )}

        <ul className="space-y-3">
          {band.elements.map((el) => (
            <li key={el.id} className="space-y-2 rounded-lg border border-border p-3">
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  className="size-4 accent-primary"
                  aria-label={`Show ${el.label || el.kind}`}
                  checked={el.enabled}
                  onChange={(e) => updateElement(el.id, { enabled: e.target.checked })}
                />
                <span className="flex-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {ELEMENT_KINDS.find((k) => k.id === el.kind)?.label}
                </span>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Delete field"
                  onClick={() => onChange({ elements: band.elements.filter((x) => x.id !== el.id) })}
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>

              {el.kind === "pageNumber" ? (
                <div className="grid grid-cols-2 gap-2">
                  <Input
                    value={el.label}
                    aria-label="Field label"
                    placeholder="Label (e.g. Page No.)"
                    onChange={(e) => updateElement(el.id, { label: e.target.value })}
                  />
                  <Select
                    aria-label="Page number format"
                    value={el.format ?? "n"}
                    onChange={(e) => updateElement(el.id, { format: e.target.value as PageNumberFormat })}
                  >
                    {PAGE_NUMBER_FORMATS.map((f) => (
                      <option key={f.id} value={f.id}>
                        {f.label}
                      </option>
                    ))}
                  </Select>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  <Input
                    value={el.label}
                    aria-label="Field label"
                    placeholder="Label"
                    onChange={(e) => updateElement(el.id, { label: e.target.value })}
                  />
                  <Input
                    value={el.value}
                    aria-label="Field value"
                    placeholder="Value (optional)"
                    onChange={(e) => updateElement(el.id, { value: e.target.value })}
                  />
                </div>
              )}

              <div className="grid grid-cols-3 gap-2">
                <Select aria-label="Alignment" value={el.slot} onChange={(e) => updateElement(el.id, { slot: e.target.value as Slot })}>
                  <option value="left">Left</option>
                  <option value="center">Center</option>
                  <option value="right">Right</option>
                </Select>
                <Select aria-label="Row" value={String(el.row)} onChange={(e) => updateElement(el.id, { row: Number(e.target.value) })}>
                  {[0, 1, 2, 3].map((r) => (
                    <option key={r} value={r}>
                      Row {r + 1}
                    </option>
                  ))}
                </Select>
                <Select aria-label="Show on" value={el.applyTo} onChange={(e) => updateElement(el.id, { applyTo: e.target.value as ApplyTo })}>
                  <option value="all">All pages</option>
                  <option value="first">First page</option>
                  <option value="last">Last page</option>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <Slider
                  label="Size"
                  min={14}
                  max={40}
                  step={1}
                  value={el.fontSize}
                  onChange={(e) => updateElement(el.id, { fontSize: Number(e.target.value) })}
                  suffix="px"
                />
                <ColorField label="Colour" value={el.color} onChange={(hex) => updateElement(el.id, { color: hex })} />
              </div>

              <label className="flex items-center gap-2 text-xs">
                <input
                  type="checkbox"
                  className="size-4 accent-primary"
                  checked={el.handwritten}
                  onChange={(e) => updateElement(el.id, { handwritten: e.target.checked })}
                />
                Handwritten
              </label>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
