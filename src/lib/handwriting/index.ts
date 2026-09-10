import { renderPages, type RenderInput, type RenderedPage } from "./renderer";

/**
 * Provider abstraction. The UI only ever talks to a `HandwritingGenerator`, so
 * the local canvas renderer below can later be swapped for an AI/handwriting
 * model or an external generation API without touching the app.
 */
export interface HandwritingGenerator {
  id: string;
  label: string;
  generate(input: RenderInput, onProgress?: (stage: string, pct: number) => void): Promise<GeneratedPage[]>;
}

export interface GeneratedPage {
  pageNumber: number;
  dataUrl: string;
  width: number;
  height: number;
}

/** MVP renderer: browser canvas with controlled human-like randomness. */
export const canvasGenerator: HandwritingGenerator = {
  id: "canvas-local",
  label: "Local handwriting renderer",
  async generate(input, onProgress) {
    onProgress?.("Writing your answer...", 15);
    const pages: RenderedPage[] = await renderPages(input);
    onProgress?.("Creating natural handwriting...", 55);
    const out = pages.map((p) => ({
      pageNumber: p.pageNumber,
      dataUrl: p.canvas.toDataURL("image/png"),
      width: p.canvas.width,
      height: p.canvas.height,
    }));
    onProgress?.("Formatting pages...", 90);
    return out;
  },
};

const registry = new Map<string, HandwritingGenerator>([[canvasGenerator.id, canvasGenerator]]);

export function registerGenerator(generator: HandwritingGenerator) {
  registry.set(generator.id, generator);
}

export function getGenerator(id = canvasGenerator.id): HandwritingGenerator {
  return registry.get(id) ?? canvasGenerator;
}

export * from "./types";
export * from "./templates";
export * from "./parse";
export {
  createPageCoordinateSystem,
  ensureFontsReady,
  getBaseline,
  getNearestBaseline,
  layoutDocument,
  renderPages,
  writingArea,
} from "./renderer";
export type { LayoutDocument, LayoutPage, LayoutPlacement, PageCoordinateSystem } from "./renderer";
