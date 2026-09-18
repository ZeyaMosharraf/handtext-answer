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
    onProgress?.("Writing your answer...", 10);
    const pages: RenderedPage[] = await renderPages(input, (rendered, total) => {
      const pct = 10 + Math.round((rendered / total) * 75);
      onProgress?.(`Writing page ${rendered} of ${total}...`, pct);
    });
    onProgress?.("Formatting pages...", 88);
    const out: GeneratedPage[] = [];
    for (let i = 0; i < pages.length; i++) {
      const p = pages[i]!;
      out.push({
        pageNumber: p.pageNumber,
        dataUrl: p.canvas.toDataURL("image/png"),
        width: p.canvas.width,
        height: p.canvas.height,
      });
      // Clear canvas buffer to free GPU/CPU memory immediately
      p.canvas.width = 0;
      p.canvas.height = 0;
      if (i % 4 === 0 && i > 0 && typeof setTimeout !== "undefined") {
        await new Promise((resolve) => setTimeout(resolve, 0));
        const pct = 88 + Math.round((i / pages.length) * 11);
        onProgress?.(`Formatting page ${i + 1} of ${pages.length}...`, pct);
      }
    }
    onProgress?.("Your handwritten answer is ready.", 100);
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
export * from "./band-operations";
export * from "./templates";
export * from "./parse";
export {
  createPageCoordinateSystem,
  ensureFontsReady,
  getBaseline,
  getLineIndexAtPageY,
  getNearestBaseline,
  layoutDocument,
  lineCapacity,
  pageToScreen,
  renderPages,
  renderPageToCanvas,
  screenToPage,
  writingArea,
} from "./renderer";
export type { LayoutDocument, LayoutPage, LayoutPlacement, PageCoordinateSystem } from "./renderer";
