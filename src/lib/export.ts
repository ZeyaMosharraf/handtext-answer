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

export async function downloadPdf(pages: GeneratedPage[], name: string) {
  const { jsPDF } = await import("jspdf");
  const first = pages[0]!;
  const pdf = new jsPDF({
    orientation: first.width > first.height ? "landscape" : "portrait",
    unit: "px",
    format: [first.width, first.height],
    compress: true,
  });
  pages.forEach((page, i) => {
    if (i > 0) pdf.addPage([page.width, page.height], page.width > page.height ? "landscape" : "portrait");
    pdf.addImage(page.dataUrl, "PNG", 0, 0, page.width, page.height);
  });
  pdf.save(`${name}.pdf`);
}

export async function downloadZip(pages: GeneratedPage[], name: string) {
  const JSZip = (await import("jszip")).default;
  const zip = new JSZip();
  pages.forEach((page) => {
    zip.file(`${name}-page-${page.pageNumber}.png`, page.dataUrl.split(",")[1]!, { base64: true });
  });
  const blob = await zip.generateAsync({ type: "blob" });
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
