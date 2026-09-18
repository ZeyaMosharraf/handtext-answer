import type { GeneratedPage } from "./handwriting";

function download(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function dataUrlToBlob(dataUrl: string) {
  const [meta, b64] = dataUrl.split(",");
  const mime = /:(.*?);/.exec(meta!)?.[1] ?? "image/png";
  const bin = atob(b64!);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new Blob([bytes], { type: mime });
}

export function downloadPng(page: GeneratedPage, name: string) {
  download(dataUrlToBlob(page.dataUrl), `${name}-page-${page.pageNumber}.png`);
}

/**
 * Builds a jsPDF document containing all rendered A4 handwritten pages in sequential order.
 * Yields periodically to keep browser UI responsive during long-document export.
 */
export async function createPdfDocument(
  pages: GeneratedPage[],
  onProgress?: (current: number, total: number) => void,
) {
  if (!pages || pages.length === 0) {
    throw new Error("No pages available to generate PDF.");
  }
  const { jsPDF } = await import("jspdf");
  const first = pages[0]!;
  const pdf = new jsPDF({
    orientation: first.width > first.height ? "landscape" : "portrait",
    unit: "px",
    format: [first.width, first.height],
    compress: true,
  });

  for (let i = 0; i < pages.length; i++) {
    const page = pages[i]!;
    if (i > 0) {
      pdf.addPage(
        [page.width, page.height],
        page.width > page.height ? "landscape" : "portrait",
      );
    }
    // Using FAST compression avoids main-thread freezes on large multi-page documents
    pdf.addImage(page.dataUrl, "PNG", 0, 0, page.width, page.height, undefined, "FAST");
    onProgress?.(i + 1, pages.length);

    // Yield every 3 pages so browser UI remains interactive and updates toast progress
    if (i % 3 === 0 && i > 0 && typeof setTimeout !== "undefined") {
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
  }

  return pdf;
}

export async function downloadPdf(
  pages: GeneratedPage[],
  name: string,
  onProgress?: (current: number, total: number) => void,
) {
  const pdf = await createPdfDocument(pages, onProgress);
  pdf.save(`${name}.pdf`);
}

/**
 * Builds a ZIP archive blob containing all rendered pages as zero-padded PNG files
 * (e.g. page-001.png, page-002.png, ... page-039.png).
 */
export async function createZipBlob(
  pages: GeneratedPage[],
  name: string,
  onProgress?: (percent: number) => void,
) {
  if (!pages || pages.length === 0) {
    throw new Error("No pages available to create ZIP archive.");
  }
  const JSZip = (await import("jszip")).default;
  const zip = new JSZip();
  const padLength = Math.max(3, String(pages.length).length);

  for (let i = 0; i < pages.length; i++) {
    const page = pages[i]!;
    const padded = String(page.pageNumber).padStart(padLength, "0");
    const base64Data = page.dataUrl.split(",")[1] ?? "";
    zip.file(`${name}-page-${padded}.png`, base64Data, { base64: true });
  }

  return await zip.generateAsync({ type: "blob" }, (metadata) => {
    onProgress?.(Math.round(metadata.percent));
  });
}

export async function downloadZip(
  pages: GeneratedPage[],
  name: string,
  onProgress?: (percent: number) => void,
) {
  const blob = await createZipBlob(pages, name, onProgress);
  download(blob, `${name}-pages.zip`);
}

export function slugify(name: string) {
  return (
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "") || "handtext"
  );
}
