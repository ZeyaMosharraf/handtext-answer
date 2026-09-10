export type InkColor = "blue" | "darkblue" | "royal" | "black" | "darkblack" | "red" | "green" | "custom";

export type PaperKind =
  | "plain"
  | "ruled"
  | "double"
  | "narrow"
  | "grid"
  | "graph"
  | "dotted"
  | "exam"
  | "cornell"
  | "border";

export type PageSizeKey = "a4" | "a5" | "letter" | "legal" | "custom";

export type Orientation = "portrait" | "landscape";

export type TextureLevel = "off" | "low" | "medium" | "high";

export type ApplyTo = "all" | "first" | "last";

export type Slot = "left" | "center" | "right";

export type ElementKind =
  | "text"
  | "studentName"
  | "enrollment"
  | "roll"
  | "subject"
  | "courseCode"
  | "college"
  | "teacherName"
  | "assignment"
  | "signature"
  | "date"
  | "pageNumber";

export type PageNumberFormat = "n" | "page-n" | "page-dash-n" | "pg-n" | "n-of-t" | "page-n-of-t";

export interface PageElement {
  id: string;
  kind: ElementKind;
  label: string;
  value: string;
  slot: Slot;
  row: number; // 0-based row inside the header/footer band
  fontSize: number;
  color: string;
  handwritten: boolean;
  enabled: boolean;
  applyTo: ApplyTo;
  format?: PageNumberFormat;
}

export interface BandConfig {
  enabled: boolean;
  applyTo: ApplyTo;
  height: number;
  borderTop: boolean;
  borderBottom: boolean;
  borderColor: string;
  elements: PageElement[];
}

export interface RulingConfig {
  enabled: boolean;
  color: string;
  opacity: number; // 0 - 1
  thickness: number; // px
}

export interface MarginRuleConfig {
  enabled: boolean;
  color: string;
  position: number; // px from the left page edge
  thickness: number;
}

export interface PageConfig {
  size: PageSizeKey;
  customWidth: number;
  customHeight: number;
  orientation: Orientation;
  paperColor: string;
  texture: TextureLevel;
  ruling: RulingConfig;
  margin: MarginRuleConfig;
  headerHeight: number;
  footerHeight: number;
}

export interface TableStyle {
  borderColor: string;
  borderWidth: number;
  fontScale: number;
  cellPadding: number;
  repeatHeader: boolean;
}

export interface HandwritingSettings {
  styleId: string;
  fontFamily: string;
  fontSize: number; // px at render scale
  slant: number; // degrees
  letterSpacing: number; // px
  wordSpacing: number; // px
  lineSpacing: number; // multiplier of fontSize
  compactness: number; // 0.85 - 1.1 horizontal scale
  baselineVariation: number; // px
  charVariation: number; // 0 - 1
  slantVariation: number; // degrees
  imperfection: number; // 0 - 1
  writingSpeed: number; // 0 - 1, higher = faster / more compressed strokes
  pressure: number; // 0 - 1, stroke weight
  ink: InkColor;
  inkCustom: string; // hex used when ink === "custom"
  penWidth: number;
  inkIntensity: number; // 0.5 - 1
  inkVariation: number; // 0 - 1
  pageSize: PageSizeKey;
  paper: PaperKind;
  marginLeft: number; // px
  marginTop: number; // px
  marginRight: number;
  marginBottom: number;
  showMarginLine: boolean;
  page: PageConfig;
  header: BandConfig;
  footer: BandConfig;
  table: TableStyle;
}

export interface HandwritingStyle {
  id: string;
  name: string;
  description: string;
  settings: Partial<HandwritingSettings>;
}

export const INK_COLORS: Record<Exclude<InkColor, "custom">, string> = {
  blue: "#1d3fb5",
  darkblue: "#12235e",
  royal: "#174ea6",
  black: "#141821",
  darkblack: "#000000",
  red: "#b3231f",
  green: "#146b3a",
};

export const INK_LABELS: Record<InkColor, string> = {
  blue: "Blue",
  darkblue: "Dark blue",
  royal: "Royal blue",
  black: "Black",
  darkblack: "Dark black",
  red: "Red",
  green: "Green",
  custom: "Custom",
};

export function inkHex(s: HandwritingSettings) {
  return s.ink === "custom" ? s.inkCustom : INK_COLORS[s.ink];
}

export const PAGE_SIZES: Record<PageSizeKey, { w: number; h: number; label: string }> = {
  a4: { w: 1240, h: 1754, label: "A4" },
  a5: { w: 874, h: 1240, label: "A5" },
  letter: { w: 1275, h: 1650, label: "Letter" },
  legal: { w: 1275, h: 2100, label: "Legal" },
  custom: { w: 1240, h: 1754, label: "Custom" },
};

export function pageDimensions(page: PageConfig) {
  const base =
    page.size === "custom"
      ? { w: page.customWidth, h: page.customHeight }
      : { w: PAGE_SIZES[page.size].w, h: PAGE_SIZES[page.size].h };
  return page.orientation === "landscape" ? { w: base.h, h: base.w } : base;
}

export const PAPERS: { id: PaperKind; label: string }[] = [
  { id: "plain", label: "Plain white" },
  { id: "ruled", label: "Blue ruled" },
  { id: "double", label: "Double line ruled" },
  { id: "narrow", label: "Narrow ruled" },
  { id: "grid", label: "Grid paper" },
  { id: "graph", label: "Fine graph paper" },
  { id: "dotted", label: "Dotted journal" },
  { id: "exam", label: "Exam answer sheet" },
  { id: "cornell", label: "Cornell notes" },
  { id: "border", label: "Bordered project page" },
];

export const PAPER_COLORS = [
  { label: "White", value: "#ffffff" },
  { label: "Off white", value: "#fdfcf7" },
  { label: "Cream", value: "#fbf3e2" },
  { label: "Light yellow", value: "#fdf8dd" },
  { label: "Notebook white", value: "#fbfbf9" },
  { label: "Aged paper", value: "#f2e6cf" },
];

export const RULING_COLORS = [
  { label: "Light blue", value: "#a7bfe8" },
  { label: "Blue", value: "#6d90cf" },
  { label: "Grey", value: "#9aa0aa" },
  { label: "Light grey", value: "#c9ced6" },
  { label: "Green", value: "#8fc0a0" },
  { label: "Purple", value: "#b3a6d8" },
];

export const MARGIN_COLORS = [
  { label: "Red", value: "#d77a7a" },
  { label: "Deep red", value: "#c0392b" },
  { label: "Grey", value: "#a0a6ae" },
  { label: "Brown", value: "#9b6b45" },
  { label: "Blue", value: "#7f9ed4" },
];

export interface ColorPreset {
  id: string;
  name: string;
  paper: string;
  ruling: string;
  margin: string;
  ink: string;
}

export const COLOR_PRESETS: ColorPreset[] = [
  { id: "classic", name: "Classic Blue", paper: "#ffffff", ruling: "#a7bfe8", margin: "#d77a7a", ink: "#1d3fb5" },
  { id: "mono", name: "Black & White", paper: "#ffffff", ruling: "#c9ced6", margin: "#a0a6ae", ink: "#141821" },
  { id: "vintage", name: "Vintage", paper: "#fbf3e2", ruling: "#dcc9a5", margin: "#9b6b45", ink: "#12235e" },
  { id: "fresh", name: "Fresh Green", paper: "#fdfcf7", ruling: "#8fc0a0", margin: "#146b3a", ink: "#146b3a" },
];

/* -------------------------------- defaults -------------------------------- */

export const DEFAULT_PAGE: PageConfig = {
  size: "a4",
  customWidth: 1240,
  customHeight: 1754,
  orientation: "portrait",
  paperColor: "#fdfcf7",
  texture: "low",
  ruling: { enabled: true, color: "#a7bfe8", opacity: 0.55, thickness: 1 },
  margin: { enabled: true, color: "#d77a7a", position: 96, thickness: 1.5 },
  headerHeight: 0,
  footerHeight: 0,
};

export function newElement(kind: ElementKind, partial: Partial<PageElement> = {}): PageElement {
  const defaults: Record<ElementKind, { label: string; value: string; slot: Slot; row: number }> = {
    studentName: { label: "Name", value: "", slot: "left", row: 0 },
    enrollment: { label: "Enrollment No", value: "", slot: "left", row: 1 },
    roll: { label: "Roll No", value: "", slot: "left", row: 1 },
    courseCode: { label: "Course", value: "", slot: "left", row: 2 },
    subject: { label: "Subject", value: "", slot: "left", row: 2 },
    college: { label: "College", value: "", slot: "left", row: 3 },
    date: { label: "Date", value: "", slot: "right", row: 0 },
    pageNumber: { label: "Page No.", value: "", slot: "right", row: 1 },
    teacherName: { label: "Teacher", value: "", slot: "left", row: 2 },
    assignment: { label: "Assignment", value: "", slot: "left", row: 0 },
    signature: { label: "Teacher's Signature", value: "______________", slot: "right", row: 0 },
    text: { label: "", value: "Custom text", slot: "left", row: 0 },
  };
  const def = defaults[kind] ?? { label: "", value: "", slot: "left", row: 0 };
  return {
    id: `el_${Math.random().toString(36).slice(2, 9)}`,
    kind,
    label: def.label,
    value: def.value,
    slot: def.slot,
    row: def.row,
    fontSize: 20,
    color: "#333333",
    handwritten: false,
    enabled: true,
    applyTo: "all",
    ...(kind === "pageNumber" ? { format: "n" as PageNumberFormat } : {}),
    ...partial,
  };
}

export const DEFAULT_HEADER: BandConfig = {
  enabled: false,
  applyTo: "all",
  height: 140,
  borderTop: false,
  borderBottom: true,
  borderColor: "#c9ced6",
  elements: [],
};

export const DEFAULT_FOOTER: BandConfig = {
  enabled: false,
  applyTo: "all",
  height: 110,
  borderTop: true,
  borderBottom: false,
  borderColor: "#c9ced6",
  elements: [],
};

export const DEFAULT_TABLE: TableStyle = {
  borderColor: "#1d3fb5",
  borderWidth: 1.6,
  fontScale: 0.92,
  cellPadding: 12,
  repeatHeader: true,
};

export const DEFAULT_SETTINGS: HandwritingSettings = {
  styleId: "natural",
  fontFamily: "Kalam",
  fontSize: 30,
  slant: 1,
  letterSpacing: 0.4,
  wordSpacing: 9,
  lineSpacing: 1.55,
  compactness: 1,
  baselineVariation: 1.4,
  charVariation: 0.5,
  slantVariation: 1.2,
  imperfection: 0.45,
  writingSpeed: 0.4,
  pressure: 0.45,
  ink: "blue",
  inkCustom: "#174ea6",
  penWidth: 1,
  inkIntensity: 0.92,
  inkVariation: 0.5,
  pageSize: "a4",
  paper: "ruled",
  marginLeft: 120,
  marginTop: 110,
  marginRight: 90,
  marginBottom: 100,
  showMarginLine: true,
  page: DEFAULT_PAGE,
  header: DEFAULT_HEADER,
  footer: DEFAULT_FOOTER,
  table: DEFAULT_TABLE,
};

/** Fill in any missing nested config on projects saved before V2. */
export function withDefaults(partial: Partial<HandwritingSettings> | undefined): HandwritingSettings {
  const s = { ...DEFAULT_SETTINGS, ...(partial ?? {}) };
  const page = { ...DEFAULT_PAGE, ...(partial?.page ?? {}) };
  return {
    ...s,
    page: {
      ...page,
      ruling: { ...DEFAULT_PAGE.ruling, ...(partial?.page?.ruling ?? {}) },
      margin: { ...DEFAULT_PAGE.margin, ...(partial?.page?.margin ?? {}) },
    },
    header: { ...DEFAULT_HEADER, ...(partial?.header ?? {}) },
    footer: { ...DEFAULT_FOOTER, ...(partial?.footer ?? {}) },
    table: { ...DEFAULT_TABLE, ...(partial?.table ?? {}) },
  };
}

export const HANDWRITING_STYLES: HandwritingStyle[] = [
  {
    id: "natural",
    name: "Natural Student",
    description: "Everyday student hand — medium letters, subtle inconsistency.",
    settings: {
      fontFamily: "Kalam",
      fontSize: 30,
      slant: 1,
      charVariation: 0.55,
      baselineVariation: 1.6,
      imperfection: 0.5,
      lineSpacing: 1.55,
      writingSpeed: 0.4,
      pressure: 0.45,
      ink: "blue",
    },
  },
  {
    id: "neat",
    name: "Very Neat Student",
    description: "Clean, organised, consistent and slightly smaller.",
    settings: {
      fontFamily: "Patrick Hand",
      fontSize: 28,
      slant: 0,
      charVariation: 0.22,
      baselineVariation: 0.7,
      slantVariation: 0.4,
      imperfection: 0.18,
      lineSpacing: 1.6,
      inkVariation: 0.25,
      writingSpeed: 0.25,
      pressure: 0.4,
    },
  },
  {
    id: "fast",
    name: "Fast Exam Writing",
    description: "Compressed, quick strokes, tighter spacing, stronger slant.",
    settings: {
      fontFamily: "Shadows Into Light",
      fontSize: 31,
      slant: 5,
      compactness: 0.9,
      charVariation: 0.68,
      baselineVariation: 2,
      slantVariation: 2.2,
      imperfection: 0.65,
      lineSpacing: 1.45,
      wordSpacing: 7.5,
      writingSpeed: 0.85,
      pressure: 0.5,
    },
  },
  {
    id: "college",
    name: "Casual Notes",
    description: "Larger relaxed letters with generous spacing.",
    settings: {
      fontFamily: "Caveat",
      fontSize: 37,
      slant: 2,
      charVariation: 0.55,
      baselineVariation: 1.8,
      imperfection: 0.5,
      lineSpacing: 1.55,
      wordSpacing: 11,
      writingSpeed: 0.35,
      pressure: 0.45,
    },
  },
  {
    id: "exam",
    name: "Exam Style",
    description: "Examination answer sheet look, blue pen, clear structure.",
    settings: {
      fontFamily: "Kalam",
      fontSize: 28,
      slant: 0.5,
      charVariation: 0.35,
      baselineVariation: 1,
      imperfection: 0.3,
      lineSpacing: 1.7,
      ink: "blue",
      paper: "exam",
    },
  },
  {
    id: "custom",
    name: "Custom",
    description: "Start from the current settings and tune everything.",
    settings: {},
  },
];

export interface FormatPreset {
  id: string;
  name: string;
  description: string;
  settings: Partial<HandwritingSettings>;
}

export const FORMAT_PRESETS: FormatPreset[] = [
  {
    id: "assignment",
    name: "University Assignment",
    description: "Clear headings, structured paragraphs, professional hand.",
    settings: { styleId: "neat", fontFamily: "Patrick Hand", fontSize: 29, lineSpacing: 1.65, paper: "ruled", ink: "blue" },
  },
  {
    id: "exam",
    name: "Exam Answer",
    description: "Compact writing, question numbers, blue pen.",
    settings: { styleId: "exam", fontFamily: "Kalam", fontSize: 28, lineSpacing: 1.6, paper: "exam", ink: "blue" },
  },
  {
    id: "notes",
    name: "Class Notes",
    description: "Larger handwriting, more spacing, notebook paper.",
    settings: { styleId: "college", fontFamily: "Caveat", fontSize: 38, lineSpacing: 1.5, paper: "double", ink: "darkblue" },
  },
  {
    id: "project",
    name: "Project Notes",
    description: "Neat hand, structured sections, clean margins.",
    settings: { styleId: "neat", fontFamily: "Patrick Hand", fontSize: 28, lineSpacing: 1.7, paper: "plain", ink: "black", marginLeft: 140 },
  },
];

/* ----------------------------- page templates ----------------------------- */

export interface PageTemplate {
  id: string;
  name: string;
  description: string;
  build: (s: HandwritingSettings) => HandwritingSettings;
}

const band = (b: BandConfig, elements: PageElement[], extra: Partial<BandConfig> = {}): BandConfig => ({
  ...b,
  enabled: true,
  elements,
  ...extra,
});

export const PAGE_TEMPLATES: PageTemplate[] = [
  {
    id: "plain",
    name: "Plain Paper",
    description: "No ruling, no header or footer.",
    build: (s) => ({
      ...s,
      paper: "plain",
      page: { ...s.page, ruling: { ...s.page.ruling, enabled: false }, margin: { ...s.page.margin, enabled: false } },
      header: { ...s.header, enabled: false },
      footer: { ...s.footer, enabled: false },
    }),
  },
  {
    id: "notebook",
    name: "Standard Notebook",
    description: "Blue horizontal lines with a red margin.",
    build: (s) => ({
      ...s,
      paper: "ruled",
      page: {
        ...s.page,
        paperColor: "#fdfcf7",
        ruling: { enabled: true, color: "#a7bfe8", opacity: 0.6, thickness: 1 },
        margin: { enabled: true, color: "#d77a7a", position: 96, thickness: 1.5 },
      },
      header: { ...s.header, enabled: false },
      footer: { ...s.footer, enabled: false },
    }),
  },
  {
    id: "assignment",
    name: "Ruled Assignment Sheet",
    description: "Physical assignment sheet with Date & Page box and red margin.",
    build: (s) => ({
      ...s,
      paper: "ruled",
      page: {
        ...s.page,
        paperColor: "#fbfbf9",
        ruling: { enabled: true, color: "#a7bfe8", opacity: 0.6, thickness: 1 },
        margin: { enabled: true, color: "#d77a7a", position: 100, thickness: 1.5 },
      },
      header: band(
        s.header,
        [
          newElement("date", { slot: "right", row: 0 }),
          newElement("pageNumber", { slot: "right", row: 1, format: "n" }),
        ],
        { enabled: true, height: 140, borderTop: false, borderBottom: true, borderColor: "#a7bfe8" },
      ),
      footer: { ...s.footer, enabled: false },
    }),
  },
  {
    id: "college",
    name: "College Assignment",
    description: "Light blue ruling, red margin, header and footer.",
    build: (s) => ({
      ...s,
      paper: "ruled",
      page: {
        ...s.page,
        paperColor: "#ffffff",
        ruling: { enabled: true, color: "#a7bfe8", opacity: 0.5, thickness: 1 },
        margin: { enabled: true, color: "#d77a7a", position: 96, thickness: 1.5 },
      },
      header: band(s.header, [
        newElement("studentName", { slot: "left", row: 0 }),
        newElement("subject", { slot: "right", row: 0 }),
        newElement("enrollment", { slot: "left", row: 1 }),
        newElement("pageNumber", { slot: "right", row: 1, format: "page-n-of-t" }),
      ]),
      footer: band(s.footer, [
        newElement("enrollment", { slot: "left", row: 0 }),
        newElement("signature", { slot: "right", row: 0, applyTo: "last" }),
      ]),
    }),
  },
  {
    id: "exam",
    name: "Exam Answer Sheet",
    description: "Structured header, ruled writing area, footer with page number.",
    build: (s) => ({
      ...s,
      paper: "exam",
      page: {
        ...s.page,
        paperColor: "#ffffff",
        ruling: { enabled: true, color: "#9aa0aa", opacity: 0.45, thickness: 1 },
        margin: { enabled: true, color: "#c0392b", position: 100, thickness: 1.8 },
      },
      header: band(
        s.header,
        [
          newElement("text", { slot: "center", row: 0, value: "EXAMINATION ANSWER SHEET", fontSize: 26 }),
          newElement("studentName", { slot: "left", row: 1 }),
          newElement("roll", { slot: "right", row: 1 }),
          newElement("subject", { slot: "left", row: 2 }),
          newElement("courseCode", { slot: "right", row: 2 }),
        ],
        { height: 200 },
      ),
      footer: band(s.footer, [
        newElement("enrollment", { slot: "left", row: 0 }),
        newElement("pageNumber", { slot: "center", row: 0, format: "page-n-of-t" }),
        newElement("signature", { slot: "right", row: 0, applyTo: "last" }),
      ]),
    }),
  },
  {
    id: "premium",
    name: "Premium Notebook",
    description: "Cream paper with subtle grey-blue lines.",
    build: (s) => ({
      ...s,
      paper: "ruled",
      page: {
        ...s.page,
        paperColor: "#fbf3e2",
        texture: "medium",
        ruling: { enabled: true, color: "#c0b49a", opacity: 0.6, thickness: 1 },
        margin: { enabled: true, color: "#9b6b45", position: 100, thickness: 1.4 },
      },
      header: { ...s.header, enabled: false },
      footer: band(s.footer, [newElement("pageNumber", { slot: "center", row: 0, format: "n", handwritten: true })]),
    }),
  },
  {
    id: "university",
    name: "University Answer Sheet",
    description: "Name, enrollment, subject and page in the header; signature in the footer.",
    build: (s) => ({
      ...s,
      paper: "ruled",
      page: {
        ...s.page,
        paperColor: "#ffffff",
        ruling: { enabled: true, color: "#a7bfe8", opacity: 0.5, thickness: 1 },
        margin: { enabled: true, color: "#d77a7a", position: 100, thickness: 1.5 },
      },
      header: band(
        s.header,
        [
          newElement("studentName", { slot: "left", row: 0 }),
          newElement("enrollment", { slot: "left", row: 1 }),
          newElement("subject", { slot: "left", row: 2 }),
          newElement("pageNumber", { slot: "right", row: 2, format: "page-n" }),
        ],
        { height: 210 },
      ),
      footer: band(s.footer, [
        newElement("enrollment", { slot: "left", row: 0 }),
        newElement("signature", { slot: "right", row: 0 }),
      ]),
    }),
  },
  {
    id: "narrow",
    name: "Narrow Ruled School",
    description: "Tight double ruling for small, dense handwriting.",
    build: (s) => ({
      ...s,
      paper: "narrow",
      lineSpacing: 1.32,
      fontSize: Math.min(s.fontSize, 27),
      page: {
        ...s.page,
        paperColor: "#ffffff",
        ruling: { enabled: true, color: "#b3c4e2", opacity: 0.6, thickness: 0.9 },
        margin: { enabled: true, color: "#d77a7a", position: 92, thickness: 1.4 },
      },
    }),
  },
  {
    id: "dotted",
    name: "Dotted Journal",
    description: "Soft dot grid, no margin line — great for notes.",
    build: (s) => ({
      ...s,
      paper: "dotted",
      page: {
        ...s.page,
        paperColor: "#fdfcf7",
        texture: "low",
        ruling: { enabled: true, color: "#b9bec7", opacity: 0.5, thickness: 1.1 },
        margin: { ...s.page.margin, enabled: false },
      },
    }),
  },
  {
    id: "graph",
    name: "Graph Paper",
    description: "Fine engineering grid for diagrams and calculations.",
    build: (s) => ({
      ...s,
      paper: "graph",
      page: {
        ...s.page,
        paperColor: "#ffffff",
        texture: "off",
        ruling: { enabled: true, color: "#a9c8b4", opacity: 0.45, thickness: 0.7 },
        margin: { enabled: true, color: "#8fb79c", position: 96, thickness: 1.2 },
      },
    }),
  },
  {
    id: "legal",
    name: "Yellow Legal Pad",
    description: "Warm yellow sheet with strong blue ruling.",
    build: (s) => ({
      ...s,
      paper: "ruled",
      page: {
        ...s.page,
        paperColor: "#fdf3c4",
        texture: "low",
        ruling: { enabled: true, color: "#7f9ed4", opacity: 0.6, thickness: 1 },
        margin: { enabled: true, color: "#c0392b", position: 110, thickness: 1.6 },
      },
    }),
  },
  {
    id: "cornell",
    name: "Cornell Notes",
    description: "Cue column on the left and a summary strip at the bottom.",
    build: (s) => ({
      ...s,
      paper: "cornell",
      marginLeft: 380,
      page: {
        ...s.page,
        paperColor: "#ffffff",
        ruling: { enabled: true, color: "#c9ced6", opacity: 0.5, thickness: 1 },
        margin: { enabled: false, color: "#c0392b", position: 340, thickness: 1.6 },
      },
    }),
  },
  {
    id: "border",
    name: "Bordered Project Page",
    description: "Plain sheet inside a double decorative border.",
    build: (s) => ({
      ...s,
      paper: "border",
      marginLeft: 130,
      marginTop: 130,
      marginRight: 110,
      marginBottom: 120,
      page: {
        ...s.page,
        paperColor: "#ffffff",
        texture: "off",
        ruling: { ...s.page.ruling, enabled: false },
        margin: { enabled: false, color: "#1d3fb5", position: 96, thickness: 1.6 },
      },
    }),
  },
];

export const HAND_FONTS = [
  "Kalam",
  "Caveat",
  "Patrick Hand",
  "Shadows Into Light",
  "Indie Flower",
  "Gloria Hallelujah",
];

export function styleSettings(styleId: string, base: HandwritingSettings): HandwritingSettings {
  const style = HANDWRITING_STYLES.find((s) => s.id === styleId);
  if (!style) return base;
  return { ...base, ...style.settings, styleId };
}

export function formatPageNumber(format: PageNumberFormat | undefined, n: number, total: number) {
  switch (format) {
    case "n":
      return `${n}`;
    case "page-dash-n":
      return `Page - ${n}`;
    case "pg-n":
      return `Pg. ${n}`;
    case "n-of-t":
      return `${n} / ${total}`;
    case "page-n-of-t":
      return `Page ${n} of ${total}`;
    default:
      return `Page ${n}`;
  }
}
