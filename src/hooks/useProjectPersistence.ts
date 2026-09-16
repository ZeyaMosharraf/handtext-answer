/**
 * useProjectPersistence — manages all persistence for a project draft.
 *
 * Responsibility:
 *   - IndexedDB autosave (debounced, local only)
 *   - Supabase cloud save (explicit, via performCloudSave)
 *   - Dirty tracking (local vs cloud)
 *   - Local draft restoration on mount
 *   - Keyboard shortcut Ctrl+S / Cmd+S
 *   - beforeunload guard for unsaved cloud changes
 *   - Unmount flush to IndexedDB
 *
 * Does NOT own: undo/redo, preview loop, write-on-page overlay, generate action.
 */

import { type QueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { migrateLegacyContentToHtml } from "@/lib/handwriting/parse";
import { getLocalDraft, markLocalDraftSynced, saveLocalDraft } from "@/lib/local-drafts";
import {
  isProjectSnapshotEqual,
  updateProject,
  type Project,
  type ProjectSnapshot,
} from "@/lib/projects";

const AUTOSAVE_DELAY_MS = 3000;

export type SaveState = "saved" | "saved-locally" | "saving-cloud" | "error";

interface UsePersistenceOptions {
  project: Project;
  queryClient: QueryClient;
  /** Ref kept in sync with the latest draft snapshot by the caller. */
  currentDraftRef: React.MutableRefObject<ProjectSnapshot>;
  /** Called after restoration to apply the restored snapshot to component state. */
  onRestore: (snapshot: ProjectSnapshot) => void;
}

interface UsePersistenceResult {
  saveState: SaveState;
  performLocalSave: () => Promise<void>;
  performCloudSave: () => Promise<boolean>;
  /** Used by EditorWorkspace for debounced local autosave. */
  isDirtyLocally: () => boolean;
  autosaveTimerRef: React.MutableRefObject<ReturnType<typeof setTimeout> | null>;
  isMountedRef: React.MutableRefObject<boolean>;
}

export function useProjectPersistence({
  project,
  queryClient,
  currentDraftRef,
  onRestore,
}: UsePersistenceOptions): UsePersistenceResult {
  const [saveState, setSaveState] = useState<SaveState>("saved");

  const initialSnapshot = useMemo<ProjectSnapshot>(
    () => ({
      name: project.name,
      question: project.question,
      content: migrateLegacyContentToHtml(project.content),
      settings: project.settings,
      assignmentMode: Boolean(project.question),
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [project.name, project.question, project.content, project.settings],
  );

  const initialSnapshotRef = useRef<ProjectSnapshot>(initialSnapshot);
  initialSnapshotRef.current = initialSnapshot;

  const onRestoreRef = useRef(onRestore);
  onRestoreRef.current = onRestore;

  const lastCloudSavedSnapshotRef = useRef<ProjectSnapshot>(initialSnapshot);
  const lastLocalSavedSnapshotRef = useRef<ProjectSnapshot>(initialSnapshot);

  const autosaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isCloudSavingRef = useRef(false);
  const pendingCloudSaveRef = useRef(false);
  const isMountedRef = useRef(false);
  const isRestorationCompleteRef = useRef(false);
  const restoredProjectIdRef = useRef<string | null>(null);

  // ── Dirty checks ─────────────────────────────────────────────────────────

  const isDirtyLocally = useCallback((): boolean => {
    return !isProjectSnapshotEqual(currentDraftRef.current, lastLocalSavedSnapshotRef.current);
  }, [currentDraftRef]);

  const isDirtyCloud = useCallback((): boolean => {
    return !isProjectSnapshotEqual(currentDraftRef.current, lastCloudSavedSnapshotRef.current);
  }, [currentDraftRef]);

  // ── Local draft restoration on mount ─────────────────────────────────────

  useEffect(() => {
    // Prevent duplicate restoration runs for the same project in this component lifecycle
    if (restoredProjectIdRef.current === project.id) {
      return;
    }

    let isCancelled = false;

    async function checkAndRestoreLocalDraft() {
      try {
        const localRecord = await getLocalDraft(project.user_id, project.id);
        if (isCancelled) return;

        if (!localRecord || !localRecord.draft) {
          restoredProjectIdRef.current = project.id;
          isRestorationCompleteRef.current = true;
          return;
        }

        const snapshot = initialSnapshotRef.current;
        const cloudUpdatedTimestamp = project.updated_at ? new Date(project.updated_at).getTime() : 0;
        const hasUnsyncedEdits = !localRecord.isSynced && !isProjectSnapshotEqual(localRecord.draft, snapshot);
        const isLocalNewer =
          localRecord.savedAt > cloudUpdatedTimestamp &&
          !isProjectSnapshotEqual(localRecord.draft, snapshot);

        if (hasUnsyncedEdits || isLocalNewer) {
          if (isCancelled) return;
          restoredProjectIdRef.current = project.id;
          onRestoreRef.current(localRecord.draft);
          lastLocalSavedSnapshotRef.current = { ...localRecord.draft };
          setSaveState("saved-locally");
          toast.info("Restored your local draft", { id: `restore-draft-${project.id}` });
        } else {
          restoredProjectIdRef.current = project.id;
        }
      } catch (err) {
        console.error("Failed to restore local draft from IndexedDB:", err);
      } finally {
        if (!isCancelled) {
          isRestorationCompleteRef.current = true;
        }
      }
    }

    void checkAndRestoreLocalDraft();

    return () => {
      isCancelled = true;
      // In development StrictMode replay, if unmounted before completion, allow subsequent mount to restore
      if (!isRestorationCompleteRef.current) {
        restoredProjectIdRef.current = null;
      }
    };
  }, [project.id, project.user_id, project.updated_at]);

  // ── Local save (IndexedDB only — never Supabase) ──────────────────────────

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
  }, [currentDraftRef, project.id, project.user_id, project.updated_at]);

  // ── Cloud save (Supabase — explicit only) ─────────────────────────────────

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
      const updated = await updateProject(project.id, {
        name: snapshotToPersist.name.trim() || "Untitled answer",
        question: snapshotToPersist.assignmentMode ? snapshotToPersist.question : "",
        content: snapshotToPersist.content,
        settings: snapshotToPersist.settings,
      });

      queryClient.setQueryData(["project", project.id], updated);
      queryClient.invalidateQueries({ queryKey: ["projects"] });

      lastCloudSavedSnapshotRef.current = snapshotToPersist;
      await markLocalDraftSynced(project.user_id, project.id, updated.updated_at);
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
  }, [currentDraftRef, project.id, project.user_id, project.updated_at, queryClient]);

  // ── Ctrl+S handler ────────────────────────────────────────────────────────

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey)) return;
      if (e.key.toLowerCase() === "s") {
        e.preventDefault();
        void performCloudSave();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [performCloudSave]);

  // ── beforeunload guard ────────────────────────────────────────────────────

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

  // ── Debounced local autosave effect ───────────────────────────────────────
  // NOTE: This effect is driven by a deps string from the caller (see EditorWorkspace).
  // We expose the timer ref and isDirtyLocally so EditorWorkspace can drive it.
  // For simplicity we expose performLocalSave and let EditorWorkspace own the debounce.

  // ── Unmount flush ─────────────────────────────────────────────────────────

  useEffect(() => {
    return () => {
      if (autosaveTimerRef.current) {
        clearTimeout(autosaveTimerRef.current);
      }
      if (!isRestorationCompleteRef.current) return;
      const snap = currentDraftRef.current;
      if (!isProjectSnapshotEqual(snap, lastLocalSavedSnapshotRef.current)) {
        void saveLocalDraft(project.user_id, project.id, snap, {
          isSynced: isProjectSnapshotEqual(snap, lastCloudSavedSnapshotRef.current),
          cloudUpdatedAt: project.updated_at,
        }).catch(() => undefined);
      }
    };
  }, [currentDraftRef, project.id, project.user_id, project.updated_at]);

  return {
    saveState,
    performLocalSave,
    performCloudSave,
    isDirtyLocally,
    autosaveTimerRef,
    isMountedRef,
  };
}
