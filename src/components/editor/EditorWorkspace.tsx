import { Link } from "@tanstack/react-router";
import {
  ArrowLeft,
  Bold,
  Check,
  CloudOff,
  Highlighter,
  Loader2,
  PenLine,
  Redo2,
  Sparkles,
  Table2,
  Underline,
  Undo2,
  Wand2,
} from "lucide-react";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import { AiAssistant } from "@/components/editor/AiAssistant";
import { DesignPanel } from "@/components/editor/DesignPanel";
import { ResultView } from "@/components/editor/ResultView";
import { Button, Card, Input, Spinner, Textarea } from "@/components/ui/primitives";
import {
  getGenerator,
  renderPages,
  wordCount,
  writingArea,
  type GeneratedPage,
  type HandwritingSettings,
} from "@/lib/handwriting";
import { recordUsage, updateProject, type Project } from "@/lib/projects";
import { loadTemplates, persistTemplates, type SavedTemplate } from "@/lib/templates";
import { cn } from "@/lib/utils";

type Tab = "content" | "preview" | "design";

const PLACEHOLDER = `# Advantages of Cloud Computing

Cloud computing provides several important advantages:

1. Scalability
Resources can be increased or decreased according to demand.

| Feature | Benefit |
| --- | --- |
| Elastic capacity | Pay only for what you use |
| Managed services | Less maintenance |`;

interface Draft {
  question: string;
  content: string;
  settings: HandwritingSettings;
}

export function EditorWorkspace({ project }: { project: Project }) {
  const [name, setName] = useState(project.name);
  const [draft, setDraft] = useState<Draft>({
    question: project.question,
    content: project.content,
    settings: project.settings,
  });
  const { question, content, settings } = draft;
  const [assignmentMode, setAssignmentMode] = useState(Boolean(project.question));
  const [tab, setTab] = useState<Tab>("content");

  const past = useRef<Draft[]>([]);
  const future = useRef<Draft[]>([]);
  const lastPush = useRef(0);
  const [historyTick, setHistoryTick] = useState(0);

  const commit = useCallback((next: Draft | ((prev: Draft) => Draft)) => {
    setDraft((prev) => {
      const value = typeof next === "function" ? next(prev) : next;
      const now = Date.now();
      if (now - lastPush.current > 500) {
        past.current = [...past.current.slice(-49), prev];
        future.current = [];
        lastPush.current = now;
        setHistoryTick((t) => t + 1);
      }
      return value;
    });
  }, []);

  const undo = useCallback(() => {
    setDraft((prev) => {
      const previous = past.current.pop();
      if (!previous) return prev;
      future.current = [prev, ...future.current.slice(0, 49)];
      lastPush.current = 0;
      setHistoryTick((t) => t + 1);
      return previous;
    });
  }, []);

  const redo = useCallback(() => {
    setDraft((prev) => {
      const [next, ...rest] = future.current;
      if (!next) return prev;
      future.current = rest;
      past.current = [...past.current, prev];
      lastPush.current = 0;
      setHistoryTick((t) => t + 1);
      return next;
    });
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey) || e.key.toLowerCase() !== "z") return;
      e.preventDefault();
      if (e.shiftKey) redo();
      else undo();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [undo, redo]);

  /* -------------------------------- templates ------------------------------- */
  const [templates, setTemplates] = useState<SavedTemplate[]>([]);
  useEffect(() => setTemplates(loadTemplates()), []);
  const saveTemplates = (next: SavedTemplate[]) => {
    setTemplates(next);
    persistTemplates(next);
  };

  /* ---------------------------------- state --------------------------------- */
  const [previewSrc, setPreviewSrc] = useState<string | null>(null);
  const [previewPages, setPreviewPages] = useState(0);
  const [previewing, setPreviewing] = useState(false);

  const [generating, setGenerating] = useState(false);
  const [stage, setStage] = useState("");
  const [progress, setProgress] = useState(0);
  const [pages, setPages] = useState<GeneratedPage[] | null>(null);

  const [saveState, setSaveState] = useState<"saved" | "saving" | "error">("saved");
  const firstRun = useRef(true);

  const contentRef = useRef<HTMLTextAreaElement>(null);
  const [tableRows, setTableRows] = useState(4);
  const [tableCols, setTableCols] = useState(3);

  /* ----------------------------- write on the page --------------------------- */
  const [writeOnPage, setWriteOnPage] = useState(false);
  const pageBoxRef = useRef<HTMLDivElement>(null);
  const onPageRef = useRef<HTMLTextAreaElement>(null);
  const [pageScale, setPageScale] = useState(0);

  useLayoutEffect(() => {
    const el = pageBoxRef.current;
    if (!el) return;
    const observer = new ResizeObserver(() => setPageScale(el.clientWidth));
    observer.observe(el);
    setPageScale(el.clientWidth);
    return () => observer.disconnect();
  }, [writeOnPage]);

  /* --------------------------------- autosave -------------------------------- */
  useEffect(() => {
    if (firstRun.current) {
      firstRun.current = false;
      return;
    }
    setSaveState("saving");
    const timer = setTimeout(() => {
      updateProject(project.id, {
        name: name.trim() || "Untitled answer",
        question: assignmentMode ? question : "",
        content,
        settings,
      })
        .then(() => setSaveState("saved"))
        .catch(() => setSaveState("error"));
    }, 1000);
    return () => clearTimeout(timer);
  }, [name, question, content, settings, assignmentMode, project.id]);

  /* -------------------------------- live preview ------------------------------ */
  const previewInput = useMemo(
    () => ({ content: content || PLACEHOLDER, question: assignmentMode ? question : "", settings }),
    [content, question, assignmentMode, settings],
  );

  useEffect(() => {
    let cancelled = false;
    setPreviewing(true);
    const timer = setTimeout(() => {
      renderPages({
        content: previewInput.content,
        ...(previewInput.question ? { question: previewInput.question } : {}),
        settings: previewInput.settings,
      })
        .then((rendered) => {
          if (cancelled) return;
          setPreviewPages(rendered.length);
          if (rendered[0]) setPreviewSrc(rendered[0].canvas.toDataURL("image/png"));
        })
        .catch(() => undefined)
        .finally(() => !cancelled && setPreviewing(false));
    }, 450);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [previewInput]);

  /* --------------------------------- actions -------------------------------- */
  const insertTable = () => {
    const rows = Math.max(1, Math.min(20, tableRows));
    const cols = Math.max(1, Math.min(8, tableCols));
    const header = Array.from({ length: cols }, (_, c) => `Column ${c + 1}`);
    const lines = [`| ${header.join(" | ")} |`, `|${header.map(() => "---").join("|")}|`];
    for (let r = 1; r < rows; r++) lines.push(`| ${Array.from({ length: cols }, () => " ").join("| ")}|`);
    const snippet = `\n${lines.join("\n")}\n`;
    const el = contentRef.current;
    const at = el ? el.selectionStart : content.length;
    commit((prev) => ({ ...prev, content: prev.content.slice(0, at) + snippet + prev.content.slice(at) }));
    toast.success("Table added — edit the cells in your answer.");
  };

  /** Wraps the selected words in an inline marker: **bold**, __underline__, ==black==. */
  const applyFormat = (marker: "**" | "__" | "==") => {
    const el = writeOnPage && onPageRef.current ? onPageRef.current : contentRef.current;
    if (!el) return;
    const start = el.selectionStart;
    const end = el.selectionEnd;
    if (start === end) {
      toast.info("Select the words you want to change first.");
      el.focus();
      return;
    }
    const selected = content.slice(start, end);
    const next = `${content.slice(0, start)}${marker}${selected}${marker}${content.slice(end)}`;
    commit((p) => ({ ...p, content: next }));
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(start + marker.length, end + marker.length);
    });
  };

  const generate = useCallback(async () => {
    if (!content.trim()) {
      toast.error("Write or paste your answer first.");
      setTab("content");
      return;
    }
    if (content.length > 60000) {
      toast.error("That answer is very long. Try splitting it into two projects.");
      return;
    }
    setGenerating(true);
    setProgress(5);
    setStage("Writing your answer...");
    try {
      const result = await getGenerator().generate(
        {
          content,
          ...(assignmentMode && question.trim() ? { question } : {}),
          settings,
        },
        (nextStage, pct) => {
          setStage(nextStage);
          setProgress(pct);
        },
      );
      setProgress(100);
      setStage("Your handwritten answer is ready.");
      setPages(result);
      await updateProject(project.id, { page_count: result.length, status: "generated" });
      await recordUsage(result.length);
    } catch (error) {
      console.error(error);
      toast.error("We couldn't generate your pages right now. Your answer is safe — please try again.");
    } finally {
      setTimeout(() => setGenerating(false), 350);
    }
  }, [content, question, assignmentMode, settings, project.id]);

  if (pages) {
    return <ResultView pages={pages} projectName={name} onBack={() => setPages(null)} />;
  }

  const words = wordCount(content);
  void historyTick;

  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-30 border-b border-border bg-background/90 px-4 py-3 backdrop-blur">
        <div className="mx-auto flex max-w-[1600px] flex-wrap items-center gap-3">
          <h1 className="sr-only">{name?.trim() || "Untitled project"} — handwriting editor</h1>
          <Link to="/dashboard" aria-label="Back to dashboard">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="size-4" />
            </Button>
          </Link>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            aria-label="Project name"
            className="h-9 max-w-xs flex-1 border-transparent bg-transparent px-2 text-base font-semibold hover:border-border"
          />
          <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
            {saveState === "saving" && <Loader2 className="size-3 animate-spin" />}
            {saveState === "saved" && <Check className="size-3 text-[color:var(--success)]" />}
            {saveState === "error" && <CloudOff className="size-3 text-destructive" />}
            {saveState === "saving" ? "Saving" : saveState === "saved" ? "Saved" : "Not saved"}
          </span>
          <div className="ml-auto flex items-center gap-2">
            <Button variant="ghost" size="icon" aria-label="Undo" onClick={undo} disabled={past.current.length === 0}>
              <Undo2 className="size-4" />
            </Button>
            <Button variant="ghost" size="icon" aria-label="Redo" onClick={redo} disabled={future.current.length === 0}>
              <Redo2 className="size-4" />
            </Button>
            <span className="hidden text-xs text-muted-foreground sm:block">
              {words} words · {Math.max(previewPages, 1)} page{previewPages > 1 ? "s" : ""}
            </span>
            <Button onClick={generate} disabled={generating}>
              {generating ? <Spinner /> : <Wand2 className="size-4" />}
              Generate
            </Button>
          </div>
        </div>
      </header>

      {/* mobile tabs */}
      <div className="flex gap-1 border-b border-border bg-card px-4 py-2 lg:hidden" role="tablist">
        {(["content", "preview", "design"] as Tab[]).map((t) => (
          <button
            key={t}
            role="tab"
            aria-selected={tab === t}
            onClick={() => setTab(t)}
            className={cn(
              "flex-1 rounded-lg px-3 py-2 text-sm font-medium capitalize",
              tab === t ? "bg-accent text-accent-foreground" : "text-muted-foreground",
            )}
          >
            {t}
          </button>
        ))}
      </div>

      <div className="mx-auto grid w-full max-w-[1600px] flex-1 gap-6 p-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,520px)_400px]">
        {/* Content */}
        <section className={cn("space-y-3", tab !== "content" && "hidden lg:block")} aria-label="Answer content">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold">Content</h2>
            <label className="flex items-center gap-2 text-xs text-muted-foreground">
              <input
                type="checkbox"
                className="size-4 accent-primary"
                checked={assignmentMode}
                onChange={(e) => setAssignmentMode(e.target.checked)}
              />
              Assignment mode
            </label>
          </div>

          {assignmentMode && (
            <Textarea
              value={question}
              onChange={(e) => commit((p) => ({ ...p, question: e.target.value }))}
              aria-label="Question"
              placeholder="Q1. Explain the OSI model and its seven layers."
              className="min-h-20"
            />
          )}

          <div className="flex flex-wrap items-center gap-2">
            <Button variant="secondary" size="sm" onClick={() => applyFormat("**")} title="Bold the selected words">
              <Bold className="size-4" />
              Bold
            </Button>
            <Button variant="secondary" size="sm" onClick={() => applyFormat("__")} title="Underline the selected words">
              <Underline className="size-4" />
              Underline
            </Button>
            <Button variant="secondary" size="sm" onClick={() => applyFormat("==")} title="Write the selection in black">
              <Highlighter className="size-4" />
              Black ink
            </Button>
          </div>

          <Textarea
            ref={contentRef}
            value={content}
            onChange={(e) => commit((p) => ({ ...p, content: e.target.value }))}
            aria-label="Answer"
            placeholder={PLACEHOLDER}
            className="min-h-[40vh] lg:min-h-[52vh]"
          />

          <Card className="flex flex-wrap items-end gap-2 p-3">
            <div className="space-y-1">
              <label htmlFor="rows" className="block text-xs text-muted-foreground">
                Rows
              </label>
              <Input
                id="rows"
                type="number"
                min={1}
                max={20}
                value={tableRows}
                onChange={(e) => setTableRows(Number(e.target.value))}
                className="w-20"
              />
            </div>
            <div className="space-y-1">
              <label htmlFor="cols" className="block text-xs text-muted-foreground">
                Columns
              </label>
              <Input
                id="cols"
                type="number"
                min={1}
                max={8}
                value={tableCols}
                onChange={(e) => setTableCols(Number(e.target.value))}
                className="w-20"
              />
            </div>
            <Button variant="secondary" onClick={insertTable}>
              <Table2 className="size-4" />
              Add table
            </Button>
          </Card>

          <p className="text-xs text-muted-foreground">
            Use <code># Heading</code>, <code>## Subheading</code>, <code>- bullet</code>, <code>1. numbered</code>,{" "}
            <code>&gt; quote</code>, <code>---</code> for a divider and <code>| a | b |</code> rows for handwritten tables.
            For emphasis: <code>**bold**</code>, <code>__underline__</code>, <code>==black ink==</code>.
          </p>

          <AiAssistant answer={content} onUse={(text) => commit((p) => ({ ...p, content: text }))} />
        </section>

        {/* Preview */}
        <section className={cn("space-y-3", tab !== "preview" && "hidden lg:block")} aria-label="Live page preview">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-sm font-semibold">Page preview</h2>
            <div className="flex items-center gap-2">
              <Button
                variant={writeOnPage ? "primary" : "secondary"}
                size="sm"
                aria-pressed={writeOnPage}
                onClick={() => setWriteOnPage((v) => !v)}
              >
                <PenLine className="size-4" />
                {writeOnPage ? "Writing on page" : "Write on page"}
              </Button>
              <span className="text-xs text-muted-foreground">
                {previewing ? "Updating…" : `Page 1 of ${Math.max(previewPages, 1)}`}
              </span>
            </div>
          </div>
          <Card className="overflow-hidden p-2 lg:sticky lg:top-24">
            <div ref={pageBoxRef} className="relative">
              {previewSrc ? (
                <img
                  src={previewSrc}
                  alt="Live handwritten preview of page 1"
                  className={cn("block w-full rounded transition-opacity", previewing && "opacity-60")}
                />
              ) : (
                <div className="aspect-[1240/1754] w-full animate-pulse rounded bg-muted" aria-hidden />
              )}

              {writeOnPage &&
                (() => {
                  const area = writingArea(settings);
                  const px = pageScale / area.pageWidth;
                  return (
                    <textarea
                      ref={onPageRef}
                      value={content}
                      onChange={(e) => commit((p) => ({ ...p, content: e.target.value }))}
                      aria-label="Write directly on the page"
                      spellCheck={false}
                      autoFocus
                      className="absolute resize-none border-0 bg-transparent p-0 text-transparent caret-primary outline-none selection:bg-primary/20"
                      style={{
                        left: `${area.left * 100}%`,
                        top: `${area.top * 100}%`,
                        width: `${area.width * 100}%`,
                        height: `${area.height * 100}%`,
                        fontFamily: `"${settings.fontFamily}", cursive`,
                        fontSize: `${area.fontSize * px}px`,
                        lineHeight: `${area.lineHeight * px}px`,
                      }}
                    />
                  );
                })()}
            </div>
          </Card>
          {writeOnPage && (
            <p className="text-xs text-muted-foreground">
              Type straight on the sheet — your handwriting appears as you pause. Use the Bold, Underline and Black ink
              buttons on the left for emphasis.
            </p>
          )}
        </section>

        {/* Design */}
        <aside className={cn("space-y-3", tab !== "design" && "hidden lg:block")} aria-label="Page and handwriting design">
          <h2 className="text-sm font-semibold">Design</h2>
          <div className="lg:max-h-[calc(100vh-9rem)] lg:overflow-y-auto lg:pr-2">
            <DesignPanel
              settings={settings}
              onChange={(next) => commit((p) => ({ ...p, settings: next }))}
              templates={templates}
              onSaveTemplate={(templateName) =>
                saveTemplates([
                  ...templates,
                  { id: `tpl_${Date.now().toString(36)}`, name: templateName, settings },
                ])
              }
              onLoadTemplate={(id) => {
                const found = templates.find((t) => t.id === id);
                if (found) commit((p) => ({ ...p, settings: found.settings }));
              }}
              onDeleteTemplate={(id) => saveTemplates(templates.filter((t) => t.id !== id))}
            />
          </div>
        </aside>
      </div>

      {generating && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm"
          role="status"
          aria-live="polite"
        >
          <Card className="w-[min(92vw,380px)] p-6 text-center">
            <Sparkles className="mx-auto size-6 text-primary" />
            <p className="mt-3 font-semibold">{stage}</p>
            <div className="mt-4 h-1.5 w-full overflow-hidden rounded-full bg-secondary">
              <div
                className="h-full rounded-full bg-primary transition-all duration-500"
                style={{ width: `${progress}%` }}
              />
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
