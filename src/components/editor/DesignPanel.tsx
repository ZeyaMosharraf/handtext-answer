import { ChevronDown, ChevronUp, Plus, RotateCcw, Sparkles, Trash2 } from "lucide-react";
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
  STANDARD_FOOTER_HEIGHT,
  STANDARD_HEADER_HEIGHT,
  applyTemplate,
  cleanupPageOverrides,
  newElement,
  resolveEffectiveBand,
  styleSettings,
  type ApplyTo,
  type BandConfig,
  type BandOverride,
  type ElementKind,
  type ElementOverride,
  type HandwritingSettings,
  type InkColor,
  type Orientation,
  type PageBandOverride,
  type PageElement,
  type PageNumberFormat,
  type PageOverridesMap,
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
  currentPage?: number;
  totalPages?: number;
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
  currentPage = 1,
  totalPages = 1,
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

      {tab === "header" && (
        <HeaderEditor
          settings={settings}
          currentPage={currentPage}
          totalPages={totalPages}
          onChange={onChange}
        />
      )}

      {tab === "footer" && (
        <FooterEditor
          settings={settings}
          currentPage={currentPage}
          totalPages={totalPages}
          onChange={onChange}
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

/* ------------------------------ header editor ----------------------------- */

function getFieldPlaceholder(kind: ElementKind): string {
  switch (kind) {
    case "studentName":
      return "Student / Name (or leave blank for line)";
    case "subject":
      return "Subject name";
    case "date":
      return "Date (or leave blank for line)";
    case "enrollment":
      return "Enrollment number";
    case "courseCode":
      return "Course name or code";
    case "roll":
      return "Roll number";
    case "assignment":
      return "Assignment name or number";
    case "college":
      return "College / University";
    case "teacherName":
      return "Teacher name";
    case "signature":
      return "Signature line (or leave blank)";
    case "text":
      return "Custom header text";
    default:
      return "Value";
  }
}

function HeaderEditor({
  settings,
  currentPage,
  totalPages,
  onChange,
}: {
  settings: HandwritingSettings;
  currentPage: number;
  totalPages: number;
  onChange: (nextSettings: HandwritingSettings) => void;
}) {
  const [scope, setScope] = useState<"all" | "page">("all");
  const [selectedKind, setSelectedKind] = useState<ElementKind>("studentName");

  const globalBand = settings.header;
  const pageOverride: BandOverride | undefined = settings.pageOverrides?.[currentPage]?.header;

  const hasOverride = Boolean(
    pageOverride &&
      (pageOverride.enabled !== undefined ||
        (pageOverride.elementOverrides && Object.keys(pageOverride.elementOverrides).length > 0) ||
        (pageOverride.extraElements && pageOverride.extraElements.length > 0) ||
        (pageOverride.hiddenElementIds && pageOverride.hiddenElementIds.length > 0)),
  );

  const displayedBand =
    scope === "all"
      ? globalBand
      : resolveEffectiveBand(settings, "header", currentPage, totalPages);

  const updatePageOverride = (updater: (prev: BandOverride) => BandOverride) => {
    const currentOverride = settings.pageOverrides?.[currentPage]?.header ?? {};
    const updatedOverride = updater(currentOverride);

    const hasContent =
      updatedOverride.enabled !== undefined ||
      updatedOverride.height !== undefined ||
      updatedOverride.borderTop !== undefined ||
      updatedOverride.borderBottom !== undefined ||
      updatedOverride.borderColor !== undefined ||
      (updatedOverride.elementOverrides && Object.keys(updatedOverride.elementOverrides).length > 0) ||
      (updatedOverride.extraElements && updatedOverride.extraElements.length > 0) ||
      (updatedOverride.hiddenElementIds && updatedOverride.hiddenElementIds.length > 0);

    const nextOverrides: PageOverridesMap = { ...(settings.pageOverrides ?? {}) };
    const currentPageRecord: PageBandOverride = { ...(nextOverrides[currentPage] ?? {}) };

    if (hasContent) {
      currentPageRecord.header = updatedOverride;
      nextOverrides[currentPage] = currentPageRecord;
    } else {
      delete currentPageRecord.header;
      if (Object.keys(currentPageRecord).length > 0) {
        nextOverrides[currentPage] = currentPageRecord;
      } else {
        delete nextOverrides[currentPage];
      }
    }

    const cleaned = cleanupPageOverrides(nextOverrides);
    const nextSettings: HandwritingSettings = { ...settings };
    if (cleaned) {
      nextSettings.pageOverrides = cleaned;
    } else {
      delete nextSettings.pageOverrides;
    }
    onChange(nextSettings);
  };

  const handleToggleEnabled = (checked: boolean) => {
    if (scope === "all") {
      onChange({
        ...settings,
        header: {
          ...globalBand,
          enabled: checked,
          height: globalBand.height && globalBand.height > 0 ? globalBand.height : STANDARD_HEADER_HEIGHT,
          borderBottom: globalBand.borderBottom !== undefined ? globalBand.borderBottom : true,
          borderColor: globalBand.borderColor || "#c9ced6",
        },
      });
    } else {
      updatePageOverride((prev) => {
        if (checked === globalBand.enabled) {
          const { enabled: _e, ...rest } = prev;
          return rest;
        }
        return { ...prev, enabled: checked };
      });
    }
  };

  const handleAddElement = () => {
    const isRight = selectedKind === "date" || selectedKind === "pageNumber" || selectedKind === "signature";
    const slot: Slot = isRight ? "right" : "left";
    const existingInSlot = displayedBand.elements.filter((e) => (isRight ? e.slot === "right" : e.slot !== "right"));
    const row = existingInSlot.length;
    const newEl = newElement(selectedKind, {
      slot,
      row,
      fontSize: 20,
      color: "#333333",
      handwritten: false,
      enabled: true,
      ...(selectedKind === "pageNumber" ? { format: "n", label: "Page No." } : {}),
    });

    if (scope === "all") {
      onChange({
        ...settings,
        header: {
          ...globalBand,
          enabled: true,
          height: globalBand.height && globalBand.height > 0 ? globalBand.height : STANDARD_HEADER_HEIGHT,
          borderBottom: globalBand.borderBottom !== undefined ? globalBand.borderBottom : true,
          elements: [...globalBand.elements, newEl],
        },
      });
    } else {
      updatePageOverride((prev) => {
        const extra = [...(prev.extraElements ?? []), newEl];
        return {
          ...prev,
          enabled: prev.enabled !== undefined ? prev.enabled : (globalBand.enabled ? undefined : true),
          extraElements: extra,
        };
      });
    }
  };

  const handleDeleteElement = (id: string) => {
    if (scope === "all") {
      onChange({
        ...settings,
        header: {
          ...globalBand,
          elements: globalBand.elements.filter((x) => x.id !== id),
        },
      });
    } else {
      updatePageOverride((prev) => {
        const isExtra = prev.extraElements?.some((e) => e.id === id);
        if (isExtra) {
          const nextExtra = prev.extraElements?.filter((e) => e.id !== id);
          return {
            ...prev,
            extraElements: nextExtra && nextExtra.length > 0 ? nextExtra : undefined,
          };
        }

        const hidden = new Set(prev.hiddenElementIds ?? []);
        hidden.add(id);

        const nextElemOverrides = { ...(prev.elementOverrides ?? {}) };
        delete nextElemOverrides[id];

        return {
          ...prev,
          hiddenElementIds: Array.from(hidden),
          elementOverrides: Object.keys(nextElemOverrides).length > 0 ? nextElemOverrides : undefined,
        };
      });
    }
  };

  const handleMoveElement = (id: string, direction: "up" | "down") => {
    const currentElements = [...displayedBand.elements];
    const idx = currentElements.findIndex((e) => e.id === id);
    if (idx === -1) return;
    const targetIdx = direction === "up" ? idx - 1 : idx + 1;
    if (targetIdx < 0 || targetIdx >= currentElements.length) return;

    const currentEl = currentElements[idx];
    const targetEl = currentElements[targetIdx];
    if (!currentEl || !targetEl) return;
    currentElements[idx] = targetEl;
    currentElements[targetIdx] = currentEl;

    let leftCount = 0;
    let rightCount = 0;
    const normalized = currentElements.map((el) => {
      if (el.slot === "right") {
        return { ...el, row: rightCount++ };
      } else {
        return { ...el, row: leftCount++ };
      }
    });

    if (scope === "all") {
      onChange({
        ...settings,
        header: {
          ...globalBand,
          elements: normalized,
        },
      });
    } else {
      updatePageOverride((prev) => {
        const extraIds = new Set(prev.extraElements?.map((e) => e.id) ?? []);
        const nextExtra = (prev.extraElements ?? []).map((extraEl) => {
          const norm = normalized.find((e) => e.id === extraEl.id);
          return norm ? { ...extraEl, row: norm.row } : extraEl;
        });

        const nextOverrides = { ...(prev.elementOverrides ?? {}) };
        for (const el of normalized) {
          if (!extraIds.has(el.id)) {
            const globalEl = globalBand.elements.find((g) => g.id === el.id);
            const currentElOverride = nextOverrides[el.id];
            if (globalEl && globalEl.row !== el.row) {
              nextOverrides[el.id] = { ...(currentElOverride ?? {}), row: el.row };
            } else if (currentElOverride) {
              const { row: _r, ...rest } = currentElOverride;
              if (Object.keys(rest).length > 0) {
                nextOverrides[el.id] = rest;
              } else {
                delete nextOverrides[el.id];
              }
            }
          }
        }

        return {
          ...prev,
          extraElements: nextExtra.length > 0 ? nextExtra : undefined,
          elementOverrides: Object.keys(nextOverrides).length > 0 ? nextOverrides : undefined,
        };
      });
    }
  };

  const handleUpdateElement = (id: string, patch: Partial<PageElement>) => {
    if (scope === "all") {
      onChange({
        ...settings,
        header: {
          ...globalBand,
          elements: globalBand.elements.map((el) => (el.id === id ? { ...el, ...patch } : el)),
        },
      });
    } else {
      updatePageOverride((prev) => {
        const isExtra = prev.extraElements?.some((e) => e.id === id);
        if (isExtra) {
          const nextExtra = (prev.extraElements ?? []).map((e) => (e.id === id ? { ...e, ...patch } : e));
          return { ...prev, extraElements: nextExtra };
        }

        const globalEl = globalBand.elements.find((e) => e.id === id);
        if (!globalEl) return prev;

        const currentElemOverride = prev.elementOverrides?.[id] ?? {};
        const nextElemOverride: ElementOverride = { ...currentElemOverride, ...patch };

        for (const key of Object.keys(nextElemOverride) as (keyof ElementOverride)[]) {
          if (nextElemOverride[key] === (globalEl as any)[key]) {
            delete nextElemOverride[key];
          }
        }

        const nextElemOverrides = { ...(prev.elementOverrides ?? {}) };
        if (Object.keys(nextElemOverride).length > 0) {
          nextElemOverrides[id] = nextElemOverride;
        } else {
          delete nextElemOverrides[id];
        }

        return {
          ...prev,
          elementOverrides: Object.keys(nextElemOverrides).length > 0 ? nextElemOverrides : undefined,
        };
      });
    }
  };

  const handleResetToGlobal = () => {
    if (!settings.pageOverrides?.[currentPage]?.header) return;

    const nextOverrides: PageOverridesMap = { ...(settings.pageOverrides ?? {}) };
    const currentPageRecord: PageBandOverride = { ...(nextOverrides[currentPage] ?? {}) };
    delete currentPageRecord.header;

    if (Object.keys(currentPageRecord).length > 0) {
      nextOverrides[currentPage] = currentPageRecord;
    } else {
      delete nextOverrides[currentPage];
    }

    const cleaned = cleanupPageOverrides(nextOverrides);
    const nextSettings: HandwritingSettings = { ...settings };
    if (cleaned) {
      nextSettings.pageOverrides = cleaned;
    } else {
      delete nextSettings.pageOverrides;
    }
    onChange(nextSettings);
  };

  const handleRestoreHiddenElement = (hiddenId: string) => {
    updatePageOverride((prev) => {
      const nextHidden = prev.hiddenElementIds?.filter((id) => id !== hiddenId);
      return {
        ...prev,
        hiddenElementIds: nextHidden && nextHidden.length > 0 ? nextHidden : undefined,
      };
    });
  };

  return (
    <div className="space-y-4">
      <Card className="space-y-4 p-4">
        <div className="space-y-1.5">
          <label htmlFor="header-scope" className="text-xs font-medium text-muted-foreground">
            Apply to
          </label>
          <Select
            id="header-scope"
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
          <span>Show header {scope === "page" ? `on Page ${currentPage}` : ""}</span>
        </label>
      </Card>

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

          <div className="flex gap-2">
            <Select
              id="header-add-field-select"
              aria-label="Select field type to add"
              value={selectedKind}
              onChange={(e) => setSelectedKind(e.target.value as ElementKind)}
              className="flex-1 text-xs"
            >
              {ELEMENT_KINDS.map((k) => (
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

          {scope === "page" && pageOverride?.hiddenElementIds && pageOverride.hiddenElementIds.length > 0 && (
            <div className="rounded-lg border border-dashed border-border p-2.5 space-y-1.5 text-xs text-muted-foreground">
              <div className="font-medium text-foreground">Hidden on Page {currentPage}:</div>
              <div className="flex flex-wrap gap-1.5">
                {pageOverride.hiddenElementIds.map((hiddenId) => {
                  const orig = globalBand.elements.find((e) => e.id === hiddenId);
                  const name = orig?.label || ELEMENT_KINDS.find((k) => k.id === orig?.kind)?.label || "Field";
                  return (
                    <button
                      key={hiddenId}
                      type="button"
                      onClick={() => handleRestoreHiddenElement(hiddenId)}
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

          {displayedBand.elements.length === 0 ? (
            <p className="text-xs text-muted-foreground py-2 text-center">
              No fields in header yet. Select a field above and click Add field.
            </p>
          ) : (
            <ul className="space-y-2.5">
              {displayedBand.elements.map((el, index) => {
                const isExtra = scope === "page" && Boolean(pageOverride?.extraElements?.some((e) => e.id === el.id));
                const hasDelta = scope === "page" && Boolean(pageOverride?.elementOverrides?.[el.id]);
                const kindDef = ELEMENT_KINDS.find((k) => k.id === el.kind);
                const isFirst = index === 0;
                const isLast = index === displayedBand.elements.length - 1;

                return (
                  <li key={el.id} className="rounded-lg border border-border bg-card p-3 space-y-2 transition-colors">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-xs font-semibold text-foreground truncate">
                          {kindDef?.label ?? el.label ?? "Field"}
                        </span>
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
                          aria-label={`Move ${kindDef?.label ?? el.label} up`}
                          onClick={() => handleMoveElement(el.id, "up")}
                        >
                          <ChevronUp className="size-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 text-muted-foreground hover:text-foreground disabled:opacity-30"
                          disabled={isLast}
                          aria-label={`Move ${kindDef?.label ?? el.label} down`}
                          onClick={() => handleMoveElement(el.id, "down")}
                        >
                          <ChevronDown className="size-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 text-muted-foreground hover:text-destructive"
                          aria-label={`Remove ${kindDef?.label ?? el.label}`}
                          onClick={() => handleDeleteElement(el.id)}
                        >
                          <Trash2 className="size-3.5" />
                        </Button>
                      </div>
                    </div>

                    {/* Field value or format input */}
                    {el.kind === "pageNumber" ? (
                      <div className="space-y-1">
                        <label htmlFor={`field-format-${el.id}`} className="text-[11px] text-muted-foreground">
                          Number format
                        </label>
                        <Select
                          id={`field-format-${el.id}`}
                          aria-label="Page number format"
                          value={el.format ?? "n"}
                          onChange={(e) => handleUpdateElement(el.id, { format: e.target.value as PageNumberFormat })}
                          className="text-xs h-8"
                        >
                          {PAGE_NUMBER_FORMATS.map((f) => (
                            <option key={f.id} value={f.id}>
                              {f.label}
                            </option>
                          ))}
                        </Select>
                      </div>
                    ) : (
                      <div className="space-y-1">
                        <Input
                          id={`field-val-${el.id}`}
                          value={el.value}
                          aria-label={`${kindDef?.label ?? el.label} value`}
                          placeholder={getFieldPlaceholder(el.kind)}
                          onChange={(e) => handleUpdateElement(el.id, { value: e.target.value })}
                          className="text-xs h-8"
                        />
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
      )}
    </div>
  );
}

/* ------------------------------ footer editor ----------------------------- */

function getFooterFieldPlaceholder(kind: ElementKind): string {
  switch (kind) {
    case "text":
      return "Custom footer text (e.g. Confidential Examination Script)";
    case "date":
      return "Date (or leave blank for line)";
    case "studentName":
      return "Student / Name (or leave blank for line)";
    case "subject":
      return "Subject name";
    case "enrollment":
      return "Enrollment number";
    case "courseCode":
      return "Course name or code";
    case "roll":
      return "Roll number";
    case "signature":
      return "Signature line (or leave blank)";
    case "teacherName":
      return "Teacher name";
    case "college":
      return "College / University";
    case "assignment":
      return "Assignment name or number";
    default:
      return "Value";
  }
}

function FooterEditor({
  settings,
  currentPage,
  totalPages,
  onChange,
}: {
  settings: HandwritingSettings;
  currentPage: number;
  totalPages: number;
  onChange: (nextSettings: HandwritingSettings) => void;
}) {
  const [scope, setScope] = useState<"all" | "page">("all");
  const [selectedKind, setSelectedKind] = useState<ElementKind>("pageNumber");

  const globalBand = settings.footer;
  const pageOverride: BandOverride | undefined = settings.pageOverrides?.[currentPage]?.footer;

  const hasOverride = Boolean(
    pageOverride &&
      (pageOverride.enabled !== undefined ||
        (pageOverride.elementOverrides && Object.keys(pageOverride.elementOverrides).length > 0) ||
        (pageOverride.extraElements && pageOverride.extraElements.length > 0) ||
        (pageOverride.hiddenElementIds && pageOverride.hiddenElementIds.length > 0)),
  );

  const displayedBand =
    scope === "all"
      ? globalBand
      : resolveEffectiveBand(settings, "footer", currentPage, totalPages);

  const updatePageOverride = (updater: (prev: BandOverride) => BandOverride) => {
    const currentOverride = settings.pageOverrides?.[currentPage]?.footer ?? {};
    const updatedOverride = updater(currentOverride);

    const hasContent =
      updatedOverride.enabled !== undefined ||
      updatedOverride.height !== undefined ||
      updatedOverride.borderTop !== undefined ||
      updatedOverride.borderBottom !== undefined ||
      updatedOverride.borderColor !== undefined ||
      (updatedOverride.elementOverrides && Object.keys(updatedOverride.elementOverrides).length > 0) ||
      (updatedOverride.extraElements && updatedOverride.extraElements.length > 0) ||
      (updatedOverride.hiddenElementIds && updatedOverride.hiddenElementIds.length > 0);

    const nextOverrides: PageOverridesMap = { ...(settings.pageOverrides ?? {}) };
    const currentPageRecord: PageBandOverride = { ...(nextOverrides[currentPage] ?? {}) };

    if (hasContent) {
      currentPageRecord.footer = updatedOverride;
      nextOverrides[currentPage] = currentPageRecord;
    } else {
      delete currentPageRecord.footer;
      if (Object.keys(currentPageRecord).length > 0) {
        nextOverrides[currentPage] = currentPageRecord;
      } else {
        delete nextOverrides[currentPage];
      }
    }

    const cleaned = cleanupPageOverrides(nextOverrides);
    const nextSettings: HandwritingSettings = { ...settings };
    if (cleaned) {
      nextSettings.pageOverrides = cleaned;
    } else {
      delete nextSettings.pageOverrides;
    }
    onChange(nextSettings);
  };

  const handleToggleEnabled = (checked: boolean) => {
    if (scope === "all") {
      onChange({
        ...settings,
        footer: {
          ...globalBand,
          enabled: checked,
          height: globalBand.height && globalBand.height > 0 ? globalBand.height : STANDARD_FOOTER_HEIGHT,
          borderTop: globalBand.borderTop !== undefined ? globalBand.borderTop : true,
          borderColor: globalBand.borderColor || "#c9ced6",
        },
      });
    } else {
      updatePageOverride((prev) => {
        if (checked === globalBand.enabled) {
          const { enabled: _e, ...rest } = prev;
          return rest;
        }
        return { ...prev, enabled: checked };
      });
    }
  };

  const handleAddElement = () => {
    const isRight = selectedKind === "pageNumber" || selectedKind === "date" || selectedKind === "signature";
    const slot: Slot = isRight ? "right" : "left";
    const existingInSlot = displayedBand.elements.filter((e) => (isRight ? e.slot === "right" : e.slot !== "right"));
    const row = existingInSlot.length;
    const newEl = newElement(selectedKind, {
      slot,
      row,
      fontSize: 18,
      color: "#333333",
      handwritten: false,
      enabled: true,
      ...(selectedKind === "pageNumber" ? { format: "n", label: "Page No." } : {}),
      ...(selectedKind === "text" ? { label: "", value: "Custom text" } : {}),
    });

    if (scope === "all") {
      onChange({
        ...settings,
        footer: {
          ...globalBand,
          enabled: true,
          height: globalBand.height && globalBand.height > 0 ? globalBand.height : STANDARD_FOOTER_HEIGHT,
          borderTop: globalBand.borderTop !== undefined ? globalBand.borderTop : true,
          elements: [...globalBand.elements, newEl],
        },
      });
    } else {
      updatePageOverride((prev) => {
        const extra = [...(prev.extraElements ?? []), newEl];
        return {
          ...prev,
          enabled: prev.enabled !== undefined ? prev.enabled : (globalBand.enabled ? undefined : true),
          extraElements: extra,
        };
      });
    }
  };

  const handleDeleteElement = (id: string) => {
    if (scope === "all") {
      onChange({
        ...settings,
        footer: {
          ...globalBand,
          elements: globalBand.elements.filter((x) => x.id !== id),
        },
      });
    } else {
      updatePageOverride((prev) => {
        const isExtra = prev.extraElements?.some((e) => e.id === id);
        if (isExtra) {
          const nextExtra = prev.extraElements?.filter((e) => e.id !== id);
          return {
            ...prev,
            extraElements: nextExtra && nextExtra.length > 0 ? nextExtra : undefined,
          };
        }

        const hidden = new Set(prev.hiddenElementIds ?? []);
        hidden.add(id);

        const nextElemOverrides = { ...(prev.elementOverrides ?? {}) };
        delete nextElemOverrides[id];

        return {
          ...prev,
          hiddenElementIds: Array.from(hidden),
          elementOverrides: Object.keys(nextElemOverrides).length > 0 ? nextElemOverrides : undefined,
        };
      });
    }
  };

  const handleMoveElement = (id: string, direction: "up" | "down") => {
    const currentElements = [...displayedBand.elements];
    const idx = currentElements.findIndex((e) => e.id === id);
    if (idx === -1) return;
    const targetIdx = direction === "up" ? idx - 1 : idx + 1;
    if (targetIdx < 0 || targetIdx >= currentElements.length) return;

    const currentEl = currentElements[idx];
    const targetEl = currentElements[targetIdx];
    if (!currentEl || !targetEl) return;
    currentElements[idx] = targetEl;
    currentElements[targetIdx] = currentEl;

    let leftCount = 0;
    let rightCount = 0;
    const normalized = currentElements.map((el) => {
      if (el.slot === "right") {
        return { ...el, row: rightCount++ };
      } else {
        return { ...el, row: leftCount++ };
      }
    });

    if (scope === "all") {
      onChange({
        ...settings,
        footer: {
          ...globalBand,
          elements: normalized,
        },
      });
    } else {
      updatePageOverride((prev) => {
        const extraIds = new Set(prev.extraElements?.map((e) => e.id) ?? []);
        const nextExtra = (prev.extraElements ?? []).map((extraEl) => {
          const norm = normalized.find((e) => e.id === extraEl.id);
          return norm ? { ...extraEl, row: norm.row } : extraEl;
        });

        const nextOverrides = { ...(prev.elementOverrides ?? {}) };
        for (const el of normalized) {
          if (!extraIds.has(el.id)) {
            const globalEl = globalBand.elements.find((g) => g.id === el.id);
            const currentElOverride = nextOverrides[el.id];
            if (globalEl && globalEl.row !== el.row) {
              nextOverrides[el.id] = { ...(currentElOverride ?? {}), row: el.row };
            } else if (currentElOverride) {
              const { row: _r, ...rest } = currentElOverride;
              if (Object.keys(rest).length > 0) {
                nextOverrides[el.id] = rest;
              } else {
                delete nextOverrides[el.id];
              }
            }
          }
        }

        return {
          ...prev,
          extraElements: nextExtra.length > 0 ? nextExtra : undefined,
          elementOverrides: Object.keys(nextOverrides).length > 0 ? nextOverrides : undefined,
        };
      });
    }
  };

  const handleUpdateElement = (id: string, patch: Partial<PageElement>) => {
    if (scope === "all") {
      onChange({
        ...settings,
        footer: {
          ...globalBand,
          elements: globalBand.elements.map((el) => (el.id === id ? { ...el, ...patch } : el)),
        },
      });
    } else {
      updatePageOverride((prev) => {
        const isExtra = prev.extraElements?.some((e) => e.id === id);
        if (isExtra) {
          const nextExtra = (prev.extraElements ?? []).map((e) => (e.id === id ? { ...e, ...patch } : e));
          return { ...prev, extraElements: nextExtra };
        }

        const globalEl = globalBand.elements.find((e) => e.id === id);
        if (!globalEl) return prev;

        const currentElemOverride = prev.elementOverrides?.[id] ?? {};
        const nextElemOverride: ElementOverride = { ...currentElemOverride, ...patch };

        for (const key of Object.keys(nextElemOverride) as (keyof ElementOverride)[]) {
          if (nextElemOverride[key] === (globalEl as any)[key]) {
            delete nextElemOverride[key];
          }
        }

        const nextElemOverrides = { ...(prev.elementOverrides ?? {}) };
        if (Object.keys(nextElemOverride).length > 0) {
          nextElemOverrides[id] = nextElemOverride;
        } else {
          delete nextElemOverrides[id];
        }

        return {
          ...prev,
          elementOverrides: Object.keys(nextElemOverrides).length > 0 ? nextElemOverrides : undefined,
        };
      });
    }
  };

  const handleResetToGlobal = () => {
    if (!settings.pageOverrides?.[currentPage]?.footer) return;

    const nextOverrides: PageOverridesMap = { ...(settings.pageOverrides ?? {}) };
    const currentPageRecord: PageBandOverride = { ...(nextOverrides[currentPage] ?? {}) };
    delete currentPageRecord.footer;

    if (Object.keys(currentPageRecord).length > 0) {
      nextOverrides[currentPage] = currentPageRecord;
    } else {
      delete nextOverrides[currentPage];
    }

    const cleaned = cleanupPageOverrides(nextOverrides);
    const nextSettings: HandwritingSettings = { ...settings };
    if (cleaned) {
      nextSettings.pageOverrides = cleaned;
    } else {
      delete nextSettings.pageOverrides;
    }
    onChange(nextSettings);
  };

  const handleRestoreHiddenElement = (hiddenId: string) => {
    updatePageOverride((prev) => {
      const nextHidden = prev.hiddenElementIds?.filter((id) => id !== hiddenId);
      return {
        ...prev,
        hiddenElementIds: nextHidden && nextHidden.length > 0 ? nextHidden : undefined,
      };
    });
  };

  return (
    <div className="space-y-4">
      <Card className="space-y-4 p-4">
        <div className="space-y-1.5">
          <label htmlFor="footer-scope" className="text-xs font-medium text-muted-foreground">
            Apply to
          </label>
          <Select
            id="footer-scope"
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
          <span>Show footer {scope === "page" ? `on Page ${currentPage}` : ""}</span>
        </label>
      </Card>

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

          <div className="flex gap-2">
            <Select
              id="footer-add-field-select"
              aria-label="Select field type to add"
              value={selectedKind}
              onChange={(e) => setSelectedKind(e.target.value as ElementKind)}
              className="flex-1 text-xs"
            >
              {ELEMENT_KINDS.map((k) => (
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

          {scope === "page" && pageOverride?.hiddenElementIds && pageOverride.hiddenElementIds.length > 0 && (
            <div className="rounded-lg border border-dashed border-border p-2.5 space-y-1.5 text-xs text-muted-foreground">
              <div className="font-medium text-foreground">Hidden on Page {currentPage}:</div>
              <div className="flex flex-wrap gap-1.5">
                {pageOverride.hiddenElementIds.map((hiddenId) => {
                  const orig = globalBand.elements.find((e) => e.id === hiddenId);
                  const name = orig?.label || ELEMENT_KINDS.find((k) => k.id === orig?.kind)?.label || "Field";
                  return (
                    <button
                      key={hiddenId}
                      type="button"
                      onClick={() => handleRestoreHiddenElement(hiddenId)}
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

          {displayedBand.elements.length === 0 ? (
            <p className="text-xs text-muted-foreground py-2 text-center">
              No fields in footer yet. Select a field above and click Add field.
            </p>
          ) : (
            <ul className="space-y-2.5">
              {displayedBand.elements.map((el, index) => {
                const isExtra = scope === "page" && Boolean(pageOverride?.extraElements?.some((e) => e.id === el.id));
                const hasDelta = scope === "page" && Boolean(pageOverride?.elementOverrides?.[el.id]);
                const kindDef = ELEMENT_KINDS.find((k) => k.id === el.kind);
                const isFirst = index === 0;
                const isLast = index === displayedBand.elements.length - 1;

                return (
                  <li key={el.id} className="rounded-lg border border-border bg-card p-3 space-y-2 transition-colors">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-xs font-semibold text-foreground truncate">
                          {kindDef?.label ?? el.label ?? "Field"}
                        </span>
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
                          aria-label={`Move ${kindDef?.label ?? el.label} up`}
                          onClick={() => handleMoveElement(el.id, "up")}
                        >
                          <ChevronUp className="size-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 text-muted-foreground hover:text-foreground disabled:opacity-30"
                          disabled={isLast}
                          aria-label={`Move ${kindDef?.label ?? el.label} down`}
                          onClick={() => handleMoveElement(el.id, "down")}
                        >
                          <ChevronDown className="size-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 text-muted-foreground hover:text-destructive"
                          aria-label={`Remove ${kindDef?.label ?? el.label}`}
                          onClick={() => handleDeleteElement(el.id)}
                        >
                          <Trash2 className="size-3.5" />
                        </Button>
                      </div>
                    </div>

                    {/* Field value or format input */}
                    {el.kind === "pageNumber" ? (
                      <div className="space-y-1">
                        <label htmlFor={`footer-field-format-${el.id}`} className="text-[11px] text-muted-foreground">
                          Number format
                        </label>
                        <Select
                          id={`footer-field-format-${el.id}`}
                          aria-label="Page number format"
                          value={el.format ?? "n"}
                          onChange={(e) => handleUpdateElement(el.id, { format: e.target.value as PageNumberFormat })}
                          className="text-xs h-8"
                        >
                          {PAGE_NUMBER_FORMATS.map((f) => (
                            <option key={f.id} value={f.id}>
                              {f.label}
                            </option>
                          ))}
                        </Select>
                      </div>
                    ) : (
                      <div className="space-y-1">
                        <Input
                          id={`footer-field-val-${el.id}`}
                          value={el.value}
                          aria-label={`${kindDef?.label ?? el.label} value`}
                          placeholder={getFooterFieldPlaceholder(el.kind)}
                          onChange={(e) => handleUpdateElement(el.id, { value: e.target.value })}
                          className="text-xs h-8"
                        />
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
      )}
    </div>
  );
}
