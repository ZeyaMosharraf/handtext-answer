import { isProjectSnapshotEqual, type ProjectSnapshot } from "../src/lib/projects";

console.log("\n=== Testing Draft Restoration Lifecycle & Idempotency Logic ===\n");

let passed = 0;
let failed = 0;

function assert(condition: boolean, testName: string, detail?: string) {
  if (condition) {
    console.log(`PASS: ${testName}`);
    passed++;
  } else {
    console.error(`FAIL: ${testName} - ${detail ?? "assertion failed"}`);
    failed++;
  }
}

// Emulate the restoration controller logic implemented in useProjectPersistence
class SimulatedPersistenceController {
  public restoredProjectId: string | null = null;
  public isRestorationComplete = false;
  public restorationCount = 0;
  public toastCount = 0;
  public lastToastId: string | null = null;
  public lastLocalSavedSnapshot: ProjectSnapshot;

  constructor(
    public project: { id: string; user_id: string; updated_at?: string },
    public initialSnapshot: ProjectSnapshot,
    public onRestore: (draft: ProjectSnapshot) => void,
    public toastInfo: (msg: string, opts?: { id?: string }) => void,
  ) {
    this.lastLocalSavedSnapshot = initialSnapshot;
  }

  // Simulates the useEffect hook run
  public runEffect(options?: {
    mockLocalRecord?: { draft: ProjectSnapshot; isSynced: boolean; savedAt: number } | null;
    strictModeCancelBeforeFinish?: boolean;
  }): { cancelled: boolean; completed: boolean } {
    if (this.restoredProjectId === this.project.id) {
      return { cancelled: false, completed: false };
    }

    let isCancelled = false;

    if (options?.strictModeCancelBeforeFinish) {
      // StrictMode Mount 1 cleanup fires before async resolution
      isCancelled = true;
      if (!this.isRestorationComplete) {
        this.restoredProjectId = null;
      }
      return { cancelled: true, completed: false };
    }

    const localRecord = options?.mockLocalRecord;
    if (isCancelled) return { cancelled: true, completed: false };

    if (!localRecord || !localRecord.draft) {
      this.restoredProjectId = this.project.id;
      this.isRestorationComplete = true;
      return { cancelled: false, completed: true };
    }

    const cloudUpdatedTimestamp = this.project.updated_at ? new Date(this.project.updated_at).getTime() : 0;
    const hasUnsyncedEdits = !localRecord.isSynced && !isProjectSnapshotEqual(localRecord.draft, this.initialSnapshot);
    const isLocalNewer =
      localRecord.savedAt > cloudUpdatedTimestamp &&
      !isProjectSnapshotEqual(localRecord.draft, this.initialSnapshot);

    if (hasUnsyncedEdits || isLocalNewer) {
      if (isCancelled) return { cancelled: true, completed: false };
      this.restoredProjectId = this.project.id;
      this.restorationCount++;
      this.onRestore(localRecord.draft);
      this.lastLocalSavedSnapshot = { ...localRecord.draft };
      this.toastCount++;
      this.toastInfo("Restored your local draft", { id: `restore-draft-${this.project.id}` });
    } else {
      this.restoredProjectId = this.project.id;
    }

    this.isRestorationComplete = true;
    return { cancelled: false, completed: true };
  }
}

const mockInitialSnapshot: ProjectSnapshot = {
  name: "Original Title",
  question: "Original Question",
  content: "<p>Original Server Content</p>",
  settings: {} as any,
  assignmentMode: true,
};

const mockLocalDraft: ProjectSnapshot = {
  name: "Modified Local Title",
  question: "Original Question",
  content: "<p>Unsaved Local Content with extra changes</p>",
  settings: {} as any,
  assignmentMode: true,
};

// Test 1: Single mount with unsynced local draft triggers restoration once
{
  let onRestoreCalled = 0;
  let toastMsg = "";
  let toastId = "";

  const controller = new SimulatedPersistenceController(
    { id: "proj-1", user_id: "user-1", updated_at: "2026-09-01T00:00:00Z" },
    mockInitialSnapshot,
    () => { onRestoreCalled++; },
    (msg, opts) => { toastMsg = msg; toastId = opts?.id || ""; },
  );

  controller.runEffect({
    mockLocalRecord: {
      draft: mockLocalDraft,
      isSynced: false,
      savedAt: Date.now(),
    },
  });

  assert(controller.restorationCount === 1, "Restoration executed exactly once on mount");
  assert(controller.toastCount === 1, "Toast triggered exactly once on mount");
  assert(onRestoreCalled === 1, "onRestore callback fired exactly once");
  assert(toastId === "restore-draft-proj-1", "Toast has dedicated project-scoped deduplication id");
}

// Test 2: Normal React re-renders (state changes, typing, formatting) do NOT re-trigger restoration
{
  let onRestoreCalled = 0;
  const controller = new SimulatedPersistenceController(
    { id: "proj-1", user_id: "user-1", updated_at: "2026-09-01T00:00:00Z" },
    mockInitialSnapshot,
    () => { onRestoreCalled++; },
    () => {},
  );

  const localRecord = {
    draft: mockLocalDraft,
    isSynced: false,
    savedAt: Date.now(),
  };

  // Mount
  controller.runEffect({ mockLocalRecord: localRecord });

  // Simulate 20 subsequent re-renders caused by typing, formatting, resizing, autosave state changes
  for (let i = 0; i < 20; i++) {
    controller.runEffect({ mockLocalRecord: localRecord });
  }

  assert(controller.restorationCount === 1, "After 20 re-renders, restoration count is strictly 1");
  assert(controller.toastCount === 1, "After 20 re-renders, toast count is strictly 1");
  assert(onRestoreCalled === 1, "After 20 re-renders, onRestore was only called once");
}

// Test 3: React StrictMode simulation (Mount 1 aborted -> Mount 2 completes)
{
  let onRestoreCalled = 0;
  let toastCount = 0;

  const controller = new SimulatedPersistenceController(
    { id: "proj-strict", user_id: "user-1", updated_at: "2026-09-01T00:00:00Z" },
    mockInitialSnapshot,
    () => { onRestoreCalled++; },
    () => { toastCount++; },
  );

  const localRecord = {
    draft: mockLocalDraft,
    isSynced: false,
    savedAt: Date.now(),
  };

  // Mount 1: cancelled before completion (StrictMode unmount)
  controller.runEffect({ mockLocalRecord: localRecord, strictModeCancelBeforeFinish: true });
  assert(controller.restorationCount === 0, "Mount 1 cancelled before completion: 0 restorations");

  // Mount 2: StrictMode replay
  controller.runEffect({ mockLocalRecord: localRecord });
  assert(controller.restorationCount === 1, "Mount 2 (StrictMode replay) completes: exactly 1 restoration");
  assert(toastCount === 1, "StrictMode replay produces exactly 1 toast");
}

// Test 4: Project ID switch (navigating from project A to project B) resets and restores project B
{
  let restoredProjects: string[] = [];

  const controllerA = new SimulatedPersistenceController(
    { id: "proj-A", user_id: "user-1" },
    mockInitialSnapshot,
    () => { restoredProjects.push(controllerA.project.id); },
    () => {},
  );

  controllerA.runEffect({
    mockLocalRecord: { draft: mockLocalDraft, isSynced: false, savedAt: Date.now() },
  });

  // Switch project
  controllerA.project = { id: "proj-B", user_id: "user-1" };
  controllerA.runEffect({
    mockLocalRecord: { draft: mockLocalDraft, isSynced: false, savedAt: Date.now() },
  });

  assert(controllerA.restorationCount === 2, "Restoration executed for both proj-A and proj-B upon switch");
  assert(restoredProjects.join(",") === "proj-A,proj-B", "Both projects received legitimate restoration");
}

// Test 5: Clean reload without un-synced edits does NOT toast
{
  let toastCount = 0;
  const controller = new SimulatedPersistenceController(
    { id: "proj-synced", user_id: "user-1", updated_at: "2026-09-01T00:00:00Z" },
    mockInitialSnapshot,
    () => {},
    () => { toastCount++; },
  );

  // Local draft is identical to server initialSnapshot and marked synced
  controller.runEffect({
    mockLocalRecord: {
      draft: mockInitialSnapshot,
      isSynced: true,
      savedAt: new Date("2026-09-01T00:00:00Z").getTime(),
    },
  });

  assert(controller.restorationCount === 0, "Zero restorations when draft matches server exactly");
  assert(toastCount === 0, "Zero toasts when draft matches server exactly");
}

console.log(`\nSimulation Results: ${passed} passed, ${failed} failed.\n`);
if (failed > 0) process.exit(1);
