import { Link } from "@tanstack/react-router";
import {
  ArrowLeft,
  Bold,
  Check,
  Cloud,
  CloudOff,
  Highlighter,
  Italic,
  Loader2,
  PenLine,
  Redo2,
  Save,
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
import { RichContentEditor, type FormatState, type RichContentEditorHandle } from "@/components/editor/RichContentEditor";
import { Button, Card, Input, Spinner, Textarea } from "@/components/ui/primitives";
import {
  createPageCoordinateSystem,
  getBaseline,
  getGenerator,
  getLineIndexAtPageY,
  pageToScreen,
  renderPages,
  renderPageToCanvas,
  screenToPage,
  wordCount,
  writingArea,
  type GeneratedPage,
  type HandwritingSettings,
  type PageCoordinateSystem,
} from "@/lib/handwriting";
import { htmlToPlainText, migrateLegacyContentToHtml, plainTextToHtml } from "@/lib/handwriting/parse";
import { getLocalDraft, markLocalDraftSynced, saveLocalDraft } from "@/lib/local-drafts";
import {
  isProjectSnapshotEqual,
  recordUsage,
  updateProject,
  type Project,
  type ProjectSnapshot,
} from "@/lib/projects";
import { loadTemplates, persistTemplates, type SavedTemplate } from "@/lib/templates";
import { cn } from "@/lib/utils";

const AUTOSAVE_DELAY_MS = 3000;

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
  const [draft, setDraft] = useState<Draft>(() => ({
    question: project.question,
    content: migrateLegacyContentToHtml(project.content),
    settings: project.settings,
  }));
  const { question, content, settings } = draft;
  const [assignmentMode, setAssignmentMode] = useState(Boolean(project.question));
  const [tab, setTab] = useState<Tab>("content");

  const richEditorRef = useRef<RichContentEditorHandle>(null);
  const [formatState, setFormatState] = useState<FormatState>({
    bold: false,
    italic: false,
    underline: false,
    blackInk: false,
  });

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

  /* ---------------------- client-side persistence & local autosave ----------- */
  type SaveState = "saved" | "saved-locally" | "saving-cloud" | "error";
  const [saveState, setSaveState] = useState<SaveState>("saved");

  const initialSnapshot = useMemo<ProjectSnapshot>(
    () => ({
      name: project.name,
      question: project.question,
      content: migrateLegacyContentToHtml(project.content),
      settings: project.settings,
      assignmentMode: Boolean(project.question),
    }),
    [project.name, project.question, project.content, project.settings],
  );

  const lastCloudSavedSnapshotRef = useRef<ProjectSnapshot>(initialSnapshot);
  const lastLocalSavedSnapshotRef = useRef<ProjectSnapshot>(initialSnapshot);
  const currentDraftRef = useRef<ProjectSnapshot>(initialSnapshot);

  // Keep currentDraftRef updated with latest values for async access
  currentDraftRef.current = {
    name,
    question,
    content,
    settings,
    assignmentMode,
  };

  const autosaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isCloudSavingRef = useRef(false);
  const pendingCloudSaveRef = useRef(false);
  const isMountedRef = useRef(false);

  // Check and restore local draft from IndexedDB on initial load
  useEffect(() => {
    let isCancelled = false;

    async function checkAndRestoreLocalDraft() {
      try {
        const localRecord = await getLocalDraft(project.user_id, project.id);
        if (isCancelled || !localRecord || !localRecord.draft) return;

        const cloudUpdatedTimestamp = project.updated_at ? new Date(project.updated_at).getTime() : 0;
        const hasUnsyncedEdits = !localRecord.isSynced && !isProjectSnapshotEqual(localRecord.draft, initialSnapshot);
        const isLocalNewer = localRecord.savedAt > cloudUpdatedTimestamp && !isProjectSnapshotEqual(localRecord.draft, initialSnapshot);

        if (hasUnsyncedEdits || isLocalNewer) {
          setName(localRecord.draft.name);
          setDraft({
            question: localRecord.draft.question,
            content: localRecord.draft.content,
            settings: localRecord.draft.settings,
          });
          setAssignmentMode(localRecord.draft.assignmentMode);

          currentDraftRef.current = { ...localRecord.draft };
          lastLocalSavedSnapshotRef.current = { ...localRecord.draft };
          setSaveState("saved-locally");
          toast.info("Restored your local draft");
        }
      } catch (err) {
        console.error("Failed to restore local draft from IndexedDB:", err);
      }
    }

    void checkAndRestoreLocalDraft();

    return () => {
      isCancelled = true;
    };
  }, [project.id, project.user_id, project.updated_at, initialSnapshot]);

  const isDirtyLocally = useCallback((): boolean => {
    return !isProjectSnapshotEqual(currentDraftRef.current, lastLocalSavedSnapshotRef.current);
  }, []);

  const isDirtyCloud = useCallback((): boolean => {
    return !isProjectSnapshotEqual(currentDraftRef.current, lastCloudSavedSnapshotRef.current);
  }, []);

  // Autosave locally to IndexedDB - NEVER touches Supabase
  const performLocalSave = useCallback(async () => {
    const snapshotToPersist = { ...currentDraftRef.current };
    try {
      const isSynced = isProjectSnapshotEqual(snapshotToPersist, lastCloudSavedSnapshotRef.current);
      await saveLocalDraft(project.user_id, project.id, snapshotToPersist, {
        isSynced,
        cloudUpdatedAt: project.updated_at,
      });
      lastLocalSavedSnapshotRef.current = snapshotToPersist;
      setSaveState(isSynced ? "saved" : "saved-locally");
    } catch (err) {
      console.error("Failed to autosave locally:", err);
    }
  }, [project.id, project.user_id, project.updated_at]);

  // Explicit Save / Ctrl+S to Supabase - ONLY path that updates cloud
  const performCloudSave = useCallback(async (): Promise<boolean> => {
    // 1. Cancel pending debounce timer
    if (autosaveTimerRef.current) {
      clearTimeout(autosaveTimerRef.current);
      autosaveTimerRef.current = null;
    }

    const snapshotToPersist = { ...currentDraftRef.current };

    // 2. Ensure latest draft is in IndexedDB
    try {
      await saveLocalDraft(project.user_id, project.id, snapshotToPersist, {
        isSynced: false,
        cloudUpdatedAt: project.updated_at,
      });
      lastLocalSavedSnapshotRef.current = snapshotToPersist;
    } catch (err) {
      console.error("Failed to update local draft before cloud save:", err);
    }

    // 3. If already identical to confirmed cloud snapshot, skip Supabase PATCH
    if (isProjectSnapshotEqual(snapshotToPersist, lastCloudSavedSnapshotRef.current)) {
      setSaveState("saved");
      await markLocalDraftSynced(project.user_id, project.id, project.updated_at);
      return true;
    }

    // 4. Prevent concurrent cloud saves
    if (isCloudSavingRef.current) {
      pendingCloudSaveRef.current = true;
      return false;
    }

    isCloudSavingRef.current = true;
    setSaveState("saving-cloud");

    try {
      await updateProject(project.id, {
        name: snapshotToPersist.name.trim() || "Untitled answer",
        question: snapshotToPersist.assignmentMode ? snapshotToPersist.question : "",
        content: snapshotToPersist.content,
        settings: snapshotToPersist.settings,
      });

      lastCloudSavedSnapshotRef.current = snapshotToPersist;
      const nowIso = new Date().toISOString();
      await markLocalDraftSynced(project.user_id, project.id, nowIso);
      setSaveState("saved");
      toast.success("Saved");
      return true;
    } catch (error) {
      console.error("Failed to save project to Supabase:", error);
      setSaveState("error");
      toast.error("Could not save to cloud. Your draft is saved locally.");
      return false;
    } finally {
      isCloudSavingRef.current = false;
      if (pendingCloudSaveRef.current) {
        pendingCloudSaveRef.current = false;
        void performCloudSave();
      }
    }
  }, [project.id, project.user_id, project.updated_at]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey)) return;
      const key = e.key.toLowerCase();
      if (key === "z") {
        e.preventDefault();
        if (e.shiftKey) redo();
        else undo();
      } else if (key === "s") {
        e.preventDefault();
        void performCloudSave();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [undo, redo, performCloudSave]);

  // Safeguard against tab closure with unsaved cloud changes
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isDirtyCloud()) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [isDirtyCloud]);

  // Flush latest draft to IndexedDB on unmount
  useEffect(() => {
    return () => {
      if (autosaveTimerRef.current) {
        clearTimeout(autosaveTimerRef.current);
      }
      const snap = currentDraftRef.current;
      void saveLocalDraft(project.user_id, project.id, snap, {
        isSynced: isProjectSnapshotEqual(snap, lastCloudSavedSnapshotRef.current),
        cloudUpdatedAt: project.updated_at,
      }).catch(() => undefined);
    };
  }, [project.id, project.user_id, project.updated_at]);

  /* -------------------------------- templates ------------------------------- */
  const [templates, setTemplates] = useState<SavedTemplate[]>([]);
  useEffect(() => setTemplates(loadTemplates()), []);
  const saveTemplates = (next: SavedTemplate[]) => {
    setTemplates(next);
    persistTemplates(next);
  };

  /* ---------------------------------- state --------------------------------- */
  const previewCanvasRef = useRef<HTMLCanvasElement>(null);
  const activeCoordinatesRef = useRef<PageCoordinateSystem | null>(null);
  const renderRafRef = useRef<number | null>(null);
  const renderTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [renderedInitial, setRenderedInitial] = useState(false);
  const [previewPages, setPreviewPages] = useState(0);
  const [previewing, setPreviewing] = useState(false);

  const [generating, setGenerating] = useState(false);
  const [stage, setStage] = useState("");
  const [progress, setProgress] = useState(0);
  const [pages, setPages] = useState<GeneratedPage[] | null>(null);

  const [tableRows, setTableRows] = useState(4);
  const [tableCols, setTableCols] = useState(3);

  /* ----------------------------- write on the page --------------------------- */
  const [writeOnPage, setWriteOnPage] = useState(false);
  const pageBoxRef = useRef<HTMLDivElement>(null);
  const onPageRef = useRef<HTMLTextAreaElement>(null);
  const [pageScale, setPageScale] = useState(0);
  const [pointerGuide, setPointerGuide] = useState<{
    visible: boolean;
    screenX: number;
    screenY: number;
    lineIndex: number;
  } | null>(null);

  useLayoutEffect(() => {
    const el = pageBoxRef.current;
    if (!el) return;
    const observer = new ResizeObserver(() => setPageScale(el.clientWidth));
    observer.observe(el);
    setPageScale(el.clientWidth);
    return () => observer.disconnect();
  }, [writeOnPage]);

  /* --------------------------------- debounced local autosave ----------------- */
  useEffect(() => {
    if (!isMountedRef.current) {
      isMountedRef.current = true;
      return;
    }

    if (autosaveTimerRef.current) {
      clearTimeout(autosaveTimerRef.current);
      autosaveTimerRef.current = null;
    }

    // If draft has not changed from what is in IndexedDB, do nothing
    if (!isDirtyLocally()) {
      return;
    }

    autosaveTimerRef.current = setTimeout(() => {
      void performLocalSave();
    }, AUTOSAVE_DELAY_MS);

    return () => {
      if (autosaveTimerRef.current) {
        clearTimeout(autosaveTimerRef.current);
        autosaveTimerRef.current = null;
      }
    };
  }, [name, question, content, settings, assignmentMode, isDirtyLocally, performLocalSave]);

  /* -------------------------------- live preview ------------------------------ */
  const previewInput = useMemo(
    () => ({ content: content || PLACEHOLDER, question: assignmentMode ? question : "", settings }),
    [content, question, assignmentMode, settings],
  );

  const executeRender = useCallback(() => {
    const canvas = previewCanvasRef.current;
    if (!canvas) return;
    renderPageToCanvas(
      {
        content: previewInput.content,
        ...(previewInput.question ? { question: previewInput.question } : {}),
        settings: previewInput.settings,
      },
      canvas,
      0,
    )
      .then((res) => {
        setPreviewPages(res.totalPages);
        activeCoordinatesRef.current = res.coordinates;
        setRenderedInitial(true);
      })
      .catch(() => undefined)
      .finally(() => setPreviewing(false));
  }, [previewInput]);

  const scheduleRender = useCallback(
    (immediate = false) => {
      if (renderRafRef.current) cancelAnimationFrame(renderRafRef.current);
      if (renderTimeoutRef.current) clearTimeout(renderTimeoutRef.current);

      if (immediate) {
        renderRafRef.current = requestAnimationFrame(executeRender);
      } else {
        setPreviewing(true);
        renderTimeoutRef.current = setTimeout(() => {
          renderRafRef.current = requestAnimationFrame(executeRender);
        }, 120);
      }
    },
    [executeRender],
  );

  useEffect(() => {
    scheduleRender(writeOnPage);
    return () => {
      if (renderRafRef.current) cancelAnimationFrame(renderRafRef.current);
      if (renderTimeoutRef.current) clearTimeout(renderTimeoutRef.current);
    };
  }, [scheduleRender, writeOnPage]);

  /* --------------------------------- actions -------------------------------- */
  const insertTable = () => {
    richEditorRef.current?.insertTable(tableRows, tableCols);
    toast.success("Table added — edit the cells in your answer.");
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

    // Cancel pending autosave timer to prevent race conditions
    if (autosaveTimerRef.current) {
      clearTimeout(autosaveTimerRef.current);
      autosaveTimerRef.current = null;
    }

    // Persist to local IndexedDB to guarantee offline safety
    await saveLocalDraft(project.user_id, project.id, currentDraftRef.current, {
      isSynced: isProjectSnapshotEqual(currentDraftRef.current, lastCloudSavedSnapshotRef.current),
      cloudUpdatedAt: project.updated_at,
    });
    lastLocalSavedSnapshotRef.current = { ...currentDraftRef.current };

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
  }, [content, question, assignmentMode, settings, project.id, project.user_id, project.updated_at]);

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
            {saveState === "saving-cloud" && (
              <>
                <Loader2 className="size-3 animate-spin text-primary" />
                <span>Saving…</span>
              </>
            )}
            {saveState === "saved-locally" && (
              <>
                <span className="flex items-center gap-1 font-medium text-[color:var(--success)]">
                  <Check className="size-3" /> Saved locally
                </span>
                <span className="text-muted-foreground/60">·</span>
                <span className="flex items-center gap-1 text-muted-foreground">
                  <Cloud className="size-3" /> Unsaved to cloud
                </span>
              </>
            )}
            {saveState === "saved" && (
              <>
                <Check className="size-3 text-[color:var(--success)]" />
                <span>Saved</span>
              </>
            )}
            {saveState === "error" && (
              <>
                <CloudOff className="size-3 text-destructive" />
                <span className="text-destructive">Not saved to cloud</span>
              </>
            )}
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
            <Button
              variant="secondary"
              size="sm"
              onClick={() => void performCloudSave()}
              disabled={saveState === "saving-cloud"}
              title="Save to cloud (Ctrl+S)"
              className="h-9 gap-1.5"
            >
              {saveState === "saving-cloud" ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <Save className="size-3.5" />
              )}
              Save
            </Button>
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

          <div className="flex flex-wrap items-center gap-1.5 rounded-lg border border-border bg-card p-1.5 shadow-sm">
            <Button
              type="button"
              variant={formatState.bold ? "primary" : "secondary"}
              size="sm"
              onClick={() => richEditorRef.current?.toggleBold()}
              title="Bold (Ctrl+B)"
              className="h-8 gap-1.5 px-2.5 text-xs font-medium transition-all"
            >
              <Bold className="size-3.5" />
              <span>Bold</span>
            </Button>
            <Button
              type="button"
              variant={formatState.italic ? "primary" : "secondary"}
              size="sm"
              onClick={() => richEditorRef.current?.toggleItalic()}
              title="Italic (Ctrl+I)"
              className="h-8 gap-1.5 px-2.5 text-xs font-medium transition-all"
            >
              <Italic className="size-3.5" />
              <span>Italic</span>
            </Button>
            <Button
              type="button"
              variant={formatState.underline ? "primary" : "secondary"}
              size="sm"
              onClick={() => richEditorRef.current?.toggleUnderline()}
              title="Underline (Ctrl+U)"
              className="h-8 gap-1.5 px-2.5 text-xs font-medium transition-all"
            >
              <Underline className="size-3.5" />
              <span>Underline</span>
            </Button>
            <Button
              type="button"
              variant={formatState.blackInk ? "primary" : "secondary"}
              size="sm"
              onClick={() => richEditorRef.current?.toggleBlackInk()}
              title="Black ink emphasis"
              className="h-8 gap-1.5 px-2.5 text-xs font-medium transition-all"
            >
              <Highlighter className="size-3.5" />
              <span>Black ink</span>
            </Button>
          </div>

          <RichContentEditor
            ref={richEditorRef}
            value={content}
            onChange={(html) => commit((p) => ({ ...p, content: html }))}
            onFormatChange={setFormatState}
            placeholder="Write or paste your answer here..."
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
            Rich-text formatting: <code>Ctrl+B</code> for bold, <code>Ctrl+I</code> for italic, <code>Ctrl+U</code> for underline.
            Click toolbar buttons or use keyboard shortcuts to format text cleanly without markup markers.
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
            <div
              ref={pageBoxRef}
              onPointerMove={(e) => {
                if (!writeOnPage || !pageBoxRef.current) return;
                const rect = pageBoxRef.current.getBoundingClientRect();
                const screenX = e.clientX - rect.left;
                const screenY = e.clientY - rect.top;
                const coords = activeCoordinatesRef.current ?? createPageCoordinateSystem(settings);
                const { pageX, pageY } = screenToPage(screenX, screenY, rect, coords);
                const lineIndex = getLineIndexAtPageY(coords, pageY);
                const baselineY = getBaseline(coords, lineIndex);
                const { screenX: guideX, screenY: guideY } = pageToScreen(pageX, baselineY, rect, coords);
                setPointerGuide({ visible: true, screenX: guideX, screenY: guideY, lineIndex });
              }}
              onPointerLeave={() => setPointerGuide(null)}
              onClick={() => {
                if (writeOnPage) onPageRef.current?.focus();
              }}
              className="relative select-none"
            >
              <canvas
                ref={previewCanvasRef}
                className={cn("block w-full rounded transition-opacity", previewing && "opacity-90")}
                style={{ display: renderedInitial ? "block" : "none" }}
              />
              {!renderedInitial && (
                <div className="aspect-[1240/1754] w-full animate-pulse rounded bg-muted" aria-hidden />
              )}

              {writeOnPage &&
                (() => {
                  const area = writingArea(settings);
                  const px = pageScale / area.pageWidth;
                  return (
                    <>
                      <textarea
                        ref={onPageRef}
                        value={htmlToPlainText(content)}
                        onChange={(e) => {
                          const nextHtml = plainTextToHtml(e.target.value);
                          commit((p) => ({ ...p, content: nextHtml }));
                          scheduleRender(true);
                        }}
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
                      {pointerGuide && pointerGuide.visible && (
                        <div
                          className="pointer-events-none absolute z-10"
                          style={{
                            left: `${area.left * 100}%`,
                            top: `${pointerGuide.screenY}px`,
                            width: `${area.width * 100}%`,
                          }}
                        >
                          <div className="relative flex items-center">
                            <div className="h-[1.5px] w-full bg-primary/30" />
                            <div
                              className="absolute -top-3.5 flex items-center gap-1 rounded bg-primary px-1.5 py-0.5 text-[10px] font-semibold text-primary-foreground shadow"
                              style={{ left: `${Math.max(0, pointerGuide.screenX - 16)}px` }}
                            >
                              <PenLine className="size-2.5" />
                              <span>Line {pointerGuide.lineIndex + 1}</span>
                            </div>
                          </div>
                        </div>
                      )}
                    </>
                  );
                })()}
            </div>
          </Card>
          {writeOnPage && (
            <p className="text-xs text-muted-foreground">
              Type straight on the sheet — your handwriting appears as you pause. Use the Bold, Italic, Underline and Black ink
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
