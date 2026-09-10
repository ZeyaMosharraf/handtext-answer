import { ArrowLeft, ChevronLeft, ChevronRight, Download, FileArchive, FileText, ZoomIn, ZoomOut } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Button, Card } from "@/components/ui/primitives";
import { downloadPdf, downloadPng, downloadZip, slugify } from "@/lib/export";
import type { GeneratedPage } from "@/lib/handwriting";
import { cn } from "@/lib/utils";

interface Props {
  pages: GeneratedPage[];
  projectName: string;
  onBack: () => void;
}

export function ResultView({ pages, projectName, onBack }: Props) {
  const [index, setIndex] = useState(0);
  const [zoom, setZoom] = useState(1);
  const page = pages[index]!;
  const name = slugify(projectName);

  const guard = async (fn: () => Promise<void> | void, label: string) => {
    try {
      await fn();
    } catch {
      toast.error(`We couldn't create your ${label}. Your pages are safe — please try again.`);
    }
  };

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <Button variant="ghost" size="sm" onClick={onBack} className="mb-4">
        <ArrowLeft className="size-4" /> Back to editor
      </Button>

      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">Your handwritten answer is ready</h1>
          <p className="text-sm text-muted-foreground">
            {pages.length} page{pages.length > 1 ? "s" : ""} · {projectName}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => guard(() => downloadPdf(pages, name), "PDF")}>
            <FileText className="size-4" /> Download PDF
          </Button>
          <Button variant="outline" onClick={() => guard(() => downloadPng(page, name), "image")}>
            <Download className="size-4" /> Download PNG
          </Button>
          {pages.length > 1 && (
            <Button variant="outline" onClick={() => guard(() => downloadZip(pages, name), "ZIP")}>
              <FileArchive className="size-4" /> All pages (ZIP)
            </Button>
          )}
        </div>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[160px_1fr]">
        <div className="flex gap-3 overflow-x-auto lg:flex-col lg:overflow-y-auto lg:pr-1">
          {pages.map((p, i) => (
            <button
              key={p.pageNumber}
              type="button"
              onClick={() => setIndex(i)}
              aria-current={i === index}
              className={cn(
                "shrink-0 overflow-hidden rounded-lg border-2 transition-all",
                i === index ? "border-primary" : "border-border opacity-80 hover:opacity-100",
              )}
            >
              <img src={p.dataUrl} alt={`Page ${p.pageNumber} thumbnail`} className="w-28 lg:w-full" loading="lazy" />
              <span className="block bg-card py-1 text-center text-xs">Page {p.pageNumber}</span>
            </button>
          ))}
        </div>

        <Card className="p-4">
          <div className="mb-3 flex items-center justify-between">
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                aria-label="Previous page"
                disabled={index === 0}
                onClick={() => setIndex((i) => Math.max(0, i - 1))}
              >
                <ChevronLeft className="size-4" />
              </Button>
              <span className="text-sm tabular-nums text-muted-foreground">
                Page {index + 1} of {pages.length}
              </span>
              <Button
                variant="ghost"
                size="icon"
                aria-label="Next page"
                disabled={index === pages.length - 1}
                onClick={() => setIndex((i) => Math.min(pages.length - 1, i + 1))}
              >
                <ChevronRight className="size-4" />
              </Button>
            </div>
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="icon" aria-label="Zoom out" onClick={() => setZoom((z) => Math.max(0.5, z - 0.25))}>
                <ZoomOut className="size-4" />
              </Button>
              <span className="w-12 text-center text-sm tabular-nums">{Math.round(zoom * 100)}%</span>
              <Button variant="ghost" size="icon" aria-label="Zoom in" onClick={() => setZoom((z) => Math.min(2.5, z + 0.25))}>
                <ZoomIn className="size-4" />
              </Button>
            </div>
          </div>
          <div className="max-h-[70vh] overflow-auto rounded-lg bg-surface p-4">
            <img
              src={page.dataUrl}
              alt={`Handwritten page ${page.pageNumber}`}
              style={{ width: `${zoom * 100}%` }}
              className="mx-auto block rounded shadow-lift"
            />
          </div>
        </Card>
      </div>
    </div>
  );
}
