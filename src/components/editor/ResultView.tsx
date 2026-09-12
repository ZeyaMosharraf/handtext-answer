import {
  ArrowLeft,
  Check,
  ChevronLeft,
  ChevronRight,
  Download,
  FileArchive,
  FileText,
  RotateCcw,
  Sparkles,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { Badge, Button, Card } from "@/components/ui/primitives";
import { downloadPdf, downloadPng, downloadZip, slugify } from "@/lib/export";
import type { GeneratedPage } from "@/lib/handwriting";
import type { UserUsageInfo } from "@/lib/projects";
import { cn } from "@/lib/utils";

interface Props {
  pages: GeneratedPage[];
  projectName: string;
  onBack: () => void;
  usageInfo?: UserUsageInfo | null | undefined;
}

export function ResultView({ pages, projectName, onBack, usageInfo }: Props) {
  const [index, setIndex] = useState(0);
  const [zoom, setZoom] = useState(1);
  const thumbnailContainerRef = useRef<HTMLDivElement>(null);

  // Guard against out of bounds index
  const safeIndex = Math.min(Math.max(0, index), pages.length - 1);
  const page = pages[safeIndex] ?? pages[0]!;
  const name = slugify(projectName);

  // Keyboard navigation for document viewer
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        setIndex((i) => Math.max(0, i - 1));
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        setIndex((i) => Math.min(pages.length - 1, i + 1));
      } else if (e.key === "Home") {
        e.preventDefault();
        setIndex(0);
      } else if (e.key === "End") {
        e.preventDefault();
        setIndex(pages.length - 1);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [pages.length]);

  // Synchronize thumbnail scroll when current page changes
  useEffect(() => {
    const container = thumbnailContainerRef.current;
    if (!container) return;
    const activeThumb = container.querySelector(`[data-page-index="${safeIndex}"]`) as HTMLElement | null;
    if (activeThumb) {
      activeThumb.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "nearest" });
    }
  }, [safeIndex]);

  const handleDownloadPdf = async () => {
    const toastId = toast.loading("Preparing your multi-page PDF...");
    try {
      await downloadPdf(pages, name);
      toast.success(`Downloaded "${name}.pdf" (${pages.length} page${pages.length > 1 ? "s" : ""})`, {
        id: toastId,
      });
    } catch {
      toast.error("Could not create your PDF. Your pages are safe — please try again.", { id: toastId });
    }
  };

  const handleDownloadPng = async () => {
    const toastId = toast.loading(`Saving page ${page.pageNumber} as PNG...`);
    try {
      await downloadPng(page, name);
      toast.success(`Page ${page.pageNumber} downloaded`, { id: toastId });
    } catch {
      toast.error("Could not create PNG image. Please try again.", { id: toastId });
    }
  };

  const handleDownloadZip = async () => {
    const toastId = toast.loading(`Packaging ${pages.length} pages into ZIP...`);
    try {
      await downloadZip(pages, name);
      toast.success(`Downloaded all ${pages.length} pages as ZIP`, { id: toastId });
    } catch {
      toast.error("Could not create ZIP archive. Please try again.", { id: toastId });
    }
  };

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <Button variant="ghost" size="sm" onClick={onBack} className="gap-1.5">
          <ArrowLeft className="size-4" /> Back to editor
        </Button>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1 font-medium text-[color:var(--success)]">
            <Check className="size-3.5" /> Ready & saved to project
          </span>
        </div>
      </div>

      {/* Main title & export action bar */}
      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-border pb-6">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-extrabold tracking-tight">Your handwritten answer is ready</h1>
            <Badge className="gap-1 font-mono bg-secondary text-secondary-foreground">
              <Sparkles className="size-3 text-primary" />
              {pages.length} page{pages.length > 1 ? "s" : ""}
            </Badge>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            {projectName} · Use arrow keys <code>←</code> <code>→</code> or click thumbnails to navigate
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button variant="secondary" size="sm" onClick={onBack} className="gap-1.5">
            <RotateCcw className="size-3.5" /> Edit answer
          </Button>
          <Button onClick={handleDownloadPdf} className="gap-1.5">
            <FileText className="size-4" /> Download PDF
          </Button>
          <Button variant="outline" onClick={handleDownloadPng} className="gap-1.5">
            <Download className="size-4" /> Download Page {page.pageNumber} (PNG)
          </Button>
          {pages.length > 1 && (
            <Button variant="outline" onClick={handleDownloadZip} className="gap-1.5">
              <FileArchive className="size-4" /> All {pages.length} pages (ZIP)
            </Button>
          )}
        </div>
      </div>

      {/* Page usage allowance information bar */}
      {usageInfo && (
        <Card className="mt-4 flex flex-wrap items-center justify-between gap-3 bg-muted/40 px-4 py-2.5 text-xs text-muted-foreground">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-semibold capitalize text-foreground">{usageInfo.planName} plan</span>
            <span>·</span>
            <span>
              {usageInfo.pagesUsedThisMonth} page{usageInfo.pagesUsedThisMonth === 1 ? "" : "s"} used this month
            </span>
            {usageInfo.monthlyPageLimit !== null && (
              <>
                <span>of {usageInfo.monthlyPageLimit} included</span>
                <Badge
                  className={cn(
                    "text-xs",
                    usageInfo.pagesRemaining && usageInfo.pagesRemaining < 5
                      ? "bg-destructive/10 text-destructive border border-destructive/20"
                      : "bg-secondary text-secondary-foreground",
                  )}
                >
                  {usageInfo.pagesRemaining} remaining
                </Badge>
              </>
            )}
            {usageInfo.monthlyPageLimit === null && (
              <Badge className="bg-secondary text-secondary-foreground">Unlimited pages</Badge>
            )}
          </div>
          <div className="text-muted-foreground/80">
            This answer used {pages.length} page{pages.length > 1 ? "s" : ""}.
          </div>
        </Card>
      )}

      {/* Document Viewer */}
      <div className="mt-6 grid gap-6 lg:grid-cols-[170px_1fr]">
        {/* Thumbnails Sidebar */}
        <div
          ref={thumbnailContainerRef}
          className="flex gap-3 overflow-x-auto pb-2 lg:max-h-[72vh] lg:flex-col lg:overflow-y-auto lg:pb-0 lg:pr-2"
          role="region"
          aria-label="Page thumbnails"
        >
          {pages.map((p, i) => (
            <button
              key={p.pageNumber}
              type="button"
              data-page-index={i}
              onClick={() => setIndex(i)}
              aria-current={i === safeIndex}
              aria-label={`Go to page ${p.pageNumber}`}
              className={cn(
                "group relative shrink-0 cursor-pointer overflow-hidden rounded-lg border-2 text-left transition-all",
                i === safeIndex
                  ? "border-primary shadow-sm ring-2 ring-primary/20"
                  : "border-border opacity-75 hover:border-border hover:opacity-100",
              )}
            >
              <img
                src={p.dataUrl}
                alt={`Page ${p.pageNumber} thumbnail`}
                className="w-28 bg-white object-contain lg:w-full"
                loading="lazy"
              />
              <div
                className={cn(
                  "flex items-center justify-between px-2 py-1 text-xs font-medium",
                  i === safeIndex ? "bg-primary text-primary-foreground" : "bg-card text-muted-foreground",
                )}
              >
                <span>Page {p.pageNumber}</span>
                {i === safeIndex && <span className="size-1.5 rounded-full bg-primary-foreground" />}
              </div>
            </button>
          ))}
        </div>

        {/* Main Page Viewer */}
        <Card className="flex flex-col p-4 shadow-sm">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2 border-b border-border pb-3">
            {/* Page navigation controls */}
            <div className="flex items-center gap-1.5" role="toolbar" aria-label="Page navigation">
              <Button
                variant="ghost"
                size="icon"
                className="size-8"
                aria-label="Previous page"
                disabled={safeIndex === 0}
                onClick={() => setIndex((i) => Math.max(0, i - 1))}
              >
                <ChevronLeft className="size-4" />
              </Button>

              <span className="min-w-[100px] text-center text-sm font-semibold tabular-nums text-foreground">
                Page {safeIndex + 1} of {pages.length}
              </span>

              <Button
                variant="ghost"
                size="icon"
                className="size-8"
                aria-label="Next page"
                disabled={safeIndex >= pages.length - 1}
                onClick={() => setIndex((i) => Math.min(pages.length - 1, i + 1))}
              >
                <ChevronRight className="size-4" />
              </Button>

              {pages.length > 1 && (
                <span className="hidden text-xs text-muted-foreground sm:inline">
                  (Use <code>←</code> <code>→</code> keys)
                </span>
              )}
            </div>

            {/* Zoom controls */}
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                className="size-8"
                aria-label="Zoom out"
                onClick={() => setZoom((z) => Math.max(0.5, Math.round((z - 0.25) * 100) / 100))}
              >
                <ZoomOut className="size-4" />
              </Button>
              <span className="w-12 text-center text-xs font-semibold tabular-nums text-muted-foreground">
                {Math.round(zoom * 100)}%
              </span>
              <Button
                variant="ghost"
                size="icon"
                className="size-8"
                aria-label="Zoom in"
                onClick={() => setZoom((z) => Math.min(2.5, Math.round((z + 0.25) * 100) / 100))}
              >
                <ZoomIn className="size-4" />
              </Button>
            </div>
          </div>

          {/* Rendered Physical Page Canvas Container */}
          <div className="flex max-h-[72vh] min-h-[400px] items-center justify-center overflow-auto rounded-lg bg-surface/80 p-4">
            <img
              src={page.dataUrl}
              alt={`Handwritten answer page ${page.pageNumber} of ${pages.length}`}
              style={{ width: `${zoom * 100}%`, maxWidth: zoom <= 1 ? "100%" : "none" }}
              className="mx-auto block rounded shadow-lift transition-all duration-150"
            />
          </div>
        </Card>
      </div>
    </div>
  );
}
