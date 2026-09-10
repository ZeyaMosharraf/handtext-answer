import {
  newElement,
  type BandConfig,
  type HandwritingSettings,
  type PageConfig,
  type PageTemplate,
  type PageTemplateDefinition,
  type PaperKind,
  type TableStyle,
} from "./types";

function createTemplate(def: PageTemplateDefinition): PageTemplate {
  const template: PageTemplate = {
    ...def,
    apply: (s: HandwritingSettings): HandwritingSettings => {
      const page: PageConfig = {
        ...s.page,
        ...(def.page ?? {}),
        ruling: {
          ...s.page.ruling,
          ...(def.page?.ruling ?? {}),
        },
        margin: {
          ...s.page.margin,
          ...(def.page?.margin ?? {}),
        },
      };

      const header: BandConfig = def.header
        ? {
            ...s.header,
            ...def.header,
            elements: def.header.elements
              ? def.header.elements.map((el) => ({ ...el, id: `el_${Math.random().toString(36).slice(2, 9)}` }))
              : s.header.elements,
          }
        : s.header;

      const footer: BandConfig = def.footer
        ? {
            ...s.footer,
            ...def.footer,
            elements: def.footer.elements
              ? def.footer.elements.map((el) => ({ ...el, id: `el_${Math.random().toString(36).slice(2, 9)}` }))
              : s.footer.elements,
          }
        : s.footer;

      return {
        ...s,
        templateId: def.id,
        paper: def.paper,
        page,
        marginLeft: def.margins?.left ?? s.marginLeft,
        marginTop: def.margins?.top ?? s.marginTop,
        marginRight: def.margins?.right ?? s.marginRight,
        marginBottom: def.margins?.bottom ?? s.marginBottom,
        header,
        footer,
        table: def.table ? { ...s.table, ...def.table } : s.table,
      };
    },
    build(current: HandwritingSettings) {
      return this.apply(current);
    },
  };
  return template;
}

/* -------------------------------------------------------------------------- */
/*                         Core Physical Templates                            */
/* -------------------------------------------------------------------------- */

/**
 * A. CURRENT ASSIGNMENT SHEET (Default & Visual Baseline)
 * Reproduces the visual baseline: A4 portrait, warm paper, blue ruling,
 * red vertical margin, compact top-right Date/Page No. metadata box,
 * clean unruled header, and aligned handwriting baselines.
 */
export const ASSIGNMENT_TEMPLATE = createTemplate({
  id: "assignment",
  name: "Assignment Sheet",
  category: "academic",
  badge: "Default",
  description: "Classic physical assignment sheet with top-right Date & Page box and red margin.",
  paper: "ruled",
  page: {
    size: "a4",
    orientation: "portrait",
    paperColor: "#fbfbf9",
    texture: "low",
    ruling: {
      enabled: true,
      type: "ruled",
      color: "#a7bfe8",
      opacity: 0.6,
      thickness: 1,
    },
    margin: {
      enabled: true,
      color: "#d77a7a",
      position: 100,
      thickness: 1.5,
    },
  },
  margins: {
    left: 120,
    top: 110,
    right: 90,
    bottom: 100,
  },
  header: {
    enabled: true,
    applyTo: "all",
    height: 140,
    borderTop: false,
    borderBottom: true,
    borderColor: "#a7bfe8",
    elements: [
      newElement("date", { slot: "right", row: 0 }),
      newElement("pageNumber", { slot: "right", row: 1, format: "n" }),
    ],
  },
  footer: {
    enabled: false,
    applyTo: "all",
    height: 100,
    borderTop: true,
    borderBottom: false,
    borderColor: "#a7bfe8",
    elements: [],
  },
});

/**
 * B. COLLEGE NOTEBOOK
 * Continuous ruled notebook with red left margin, subtle blue horizontal
 * ruling, and an uninterrupted writing area starting near the top.
 */
export const NOTEBOOK_TEMPLATE = createTemplate({
  id: "notebook",
  name: "College Notebook",
  category: "notebook",
  badge: "Notebook",
  description: "Continuous ruled notebook with red margin and uninterrupted writing area.",
  paper: "ruled",
  page: {
    size: "a4",
    orientation: "portrait",
    paperColor: "#fdfcf7",
    texture: "low",
    ruling: {
      enabled: true,
      type: "ruled",
      color: "#a7bfe8",
      opacity: 0.55,
      thickness: 1,
    },
    margin: {
      enabled: true,
      color: "#d77a7a",
      position: 96,
      thickness: 1.5,
    },
  },
  margins: {
    left: 120,
    top: 85,
    right: 90,
    bottom: 90,
  },
  header: {
    enabled: false,
    applyTo: "all",
    height: 0,
    borderTop: false,
    borderBottom: false,
    borderColor: "#a7bfe8",
    elements: [],
  },
  footer: {
    enabled: false,
    applyTo: "all",
    height: 0,
    borderTop: false,
    borderBottom: false,
    borderColor: "#a7bfe8",
    elements: [],
  },
});

/**
 * C. EXAM ANSWER SHEET
 * Structured formal examination sheet with deep red margin, structured
 * candidate metadata fields (Roll No, Enrollment, Subject, Date),
 * and invigilator signature area in the footer.
 */
export const EXAM_TEMPLATE = createTemplate({
  id: "exam",
  name: "Exam Answer Sheet",
  category: "exam",
  badge: "Exam",
  description: "Formal examination booklet with Roll No, Enrollment, Subject, Date and invigilator section.",
  paper: "exam",
  page: {
    size: "a4",
    orientation: "portrait",
    paperColor: "#ffffff",
    texture: "off",
    ruling: {
      enabled: true,
      type: "ruled",
      color: "#9aa0aa",
      opacity: 0.45,
      thickness: 1,
    },
    margin: {
      enabled: true,
      color: "#c0392b",
      position: 100,
      thickness: 1.8,
    },
  },
  margins: {
    left: 125,
    top: 180,
    right: 90,
    bottom: 90,
  },
  header: {
    enabled: true,
    applyTo: "all",
    height: 180,
    borderTop: false,
    borderBottom: true,
    borderColor: "#9aa0aa",
    elements: [
      newElement("roll", { slot: "left", row: 0 }),
      newElement("enrollment", { slot: "left", row: 1 }),
      newElement("subject", { slot: "left", row: 2 }),
      newElement("date", { slot: "right", row: 0 }),
      newElement("pageNumber", { slot: "right", row: 1, format: "page-n" }),
    ],
  },
  footer: {
    enabled: true,
    applyTo: "all",
    height: 90,
    borderTop: true,
    borderBottom: false,
    borderColor: "#9aa0aa",
    elements: [
      newElement("signature", { slot: "right", row: 0, label: "Invigilator's Sign" }),
    ],
  },
});

/**
 * Secondary / Specialty Templates
 */
export const PLAIN_TEMPLATE = createTemplate({
  id: "plain",
  name: "Plain Paper",
  category: "specialty",
  description: "Clean unruled plain paper without margin or headers.",
  paper: "plain",
  page: {
    size: "a4",
    paperColor: "#ffffff",
    texture: "off",
    ruling: { enabled: false, type: "plain", color: "#a7bfe8", opacity: 0, thickness: 1 },
    margin: { enabled: false, color: "#d77a7a", position: 96, thickness: 1.5 },
  },
  header: { enabled: false, height: 0, elements: [] },
  footer: { enabled: false, height: 0, elements: [] },
});

export const DOTTED_TEMPLATE = createTemplate({
  id: "dotted",
  name: "Dotted Journal",
  category: "specialty",
  description: "Soft dot grid journal paper with clean aesthetic.",
  paper: "dotted",
  page: {
    paperColor: "#fdfcf7",
    texture: "low",
    ruling: { enabled: true, type: "dotted", color: "#b9bec7", opacity: 0.5, thickness: 1.1 },
    margin: { enabled: false, color: "#d77a7a", position: 96, thickness: 1.5 },
  },
  header: { enabled: false, height: 0, elements: [] },
  footer: { enabled: false, height: 0, elements: [] },
});

export const GRAPH_TEMPLATE = createTemplate({
  id: "graph",
  name: "Graph Paper",
  category: "specialty",
  description: "Engineering graph paper with fine coordinate grid.",
  paper: "graph",
  page: {
    paperColor: "#ffffff",
    texture: "off",
    ruling: { enabled: true, type: "graph", color: "#a9c8b4", opacity: 0.45, thickness: 0.7 },
    margin: { enabled: true, color: "#8fb79c", position: 96, thickness: 1.2 },
  },
  header: { enabled: false, height: 0, elements: [] },
  footer: { enabled: false, height: 0, elements: [] },
});

export const CORNELL_TEMPLATE = createTemplate({
  id: "cornell",
  name: "Cornell Notes",
  category: "specialty",
  description: "Cornell notes with left cue column and summary section.",
  paper: "cornell",
  margins: { left: 380, top: 110, right: 90, bottom: 100 },
  page: {
    paperColor: "#ffffff",
    texture: "off",
    ruling: { enabled: true, type: "ruled", color: "#c9ced6", opacity: 0.5, thickness: 1 },
    margin: { enabled: false, color: "#c0392b", position: 340, thickness: 1.6 },
  },
  header: { enabled: false, height: 0, elements: [] },
  footer: { enabled: false, height: 0, elements: [] },
});

/* -------------------------------------------------------------------------- */
/*                         Central Registry & Lookup                          */
/* -------------------------------------------------------------------------- */

export const TEMPLATE_REGISTRY: Record<string, PageTemplate> = {
  assignment: ASSIGNMENT_TEMPLATE,
  notebook: NOTEBOOK_TEMPLATE,
  exam: EXAM_TEMPLATE,
  plain: PLAIN_TEMPLATE,
  dotted: DOTTED_TEMPLATE,
  graph: GRAPH_TEMPLATE,
  cornell: CORNELL_TEMPLATE,
};

export function getTemplate(id: string): PageTemplate {
  return TEMPLATE_REGISTRY[id] ?? ASSIGNMENT_TEMPLATE;
}

export function listTemplates(): PageTemplate[] {
  return [
    ASSIGNMENT_TEMPLATE,
    NOTEBOOK_TEMPLATE,
    EXAM_TEMPLATE,
    PLAIN_TEMPLATE,
    DOTTED_TEMPLATE,
    GRAPH_TEMPLATE,
    CORNELL_TEMPLATE,
  ];
}

export function applyTemplate(templateId: string, current: HandwritingSettings): HandwritingSettings {
  const t = getTemplate(templateId);
  return t.apply(current);
}

export const PAGE_TEMPLATES: PageTemplate[] = listTemplates();

