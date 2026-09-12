import type { ProjectSnapshot } from "@/lib/projects";

export interface LocalDraftRecord {
  key: string;
  userId: string;
  projectId: string;
  draft: ProjectSnapshot;
  savedAt: number;
  cloudUpdatedAt?: string | undefined;
  isSynced: boolean;
}

const DB_NAME = "handtext-local";
const STORE_NAME = "drafts";
const DB_VERSION = 2;

let dbPromise: Promise<IDBDatabase | null> | null = null;

function getDb(): Promise<IDBDatabase | null> {
  if (typeof window === "undefined" || !("indexedDB" in window)) {
    return Promise.resolve(null);
  }

  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve, reject) => {
    try {
      const request = window.indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME, { keyPath: "key" });
        }
      };

      request.onsuccess = () => {
        const db = request.result;
        db.onversionchange = () => {
          db.close();
          dbPromise = null;
        };
        resolve(db);
      };

      request.onerror = () => {
        dbPromise = null;
        reject(request.error);
      };

      request.onblocked = () => {
        console.warn("IndexedDB open blocked: please close other tabs with this site open.");
      };
    } catch (err) {
      dbPromise = null;
      reject(err);
    }
  });

  return dbPromise;
}

export function getDraftKey(userId: string, projectId: string): string {
  return `handtext:draft:${userId}:${projectId}`;
}

/**
 * Persists an editable project draft to browser IndexedDB.
 */
export async function saveLocalDraft(
  userId: string,
  projectId: string,
  draft: ProjectSnapshot,
  options?: { isSynced?: boolean; cloudUpdatedAt?: string },
): Promise<LocalDraftRecord | null> {
  if (!userId || !projectId) return null;

  const db = await getDb();
  if (!db) return null;

  const key = getDraftKey(userId, projectId);
  const record: LocalDraftRecord = {
    key,
    userId,
    projectId,
    draft,
    savedAt: Date.now(),
    cloudUpdatedAt: options?.cloudUpdatedAt,
    isSynced: options?.isSynced ?? false,
  };

  return new Promise((resolve, reject) => {
    try {
      const tx = db.transaction(STORE_NAME, "readwrite");
      const store = tx.objectStore(STORE_NAME);
      const req = store.put(record);

      req.onsuccess = () => resolve(record);
      req.onerror = () => reject(req.error);
      tx.onerror = () => reject(tx.error);
    } catch (err) {
      reject(err);
    }
  });
}

/**
 * Retrieves the local draft record for a given user and project.
 */
export async function getLocalDraft(
  userId: string,
  projectId: string,
): Promise<LocalDraftRecord | null> {
  if (!userId || !projectId) return null;

  const db = await getDb();
  if (!db) return null;

  const key = getDraftKey(userId, projectId);

  return new Promise((resolve, reject) => {
    try {
      const tx = db.transaction(STORE_NAME, "readonly");
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(key);

      req.onsuccess = () => resolve((req.result as LocalDraftRecord) || null);
      req.onerror = () => reject(req.error);
      tx.onerror = () => reject(tx.error);
    } catch (err) {
      reject(err);
    }
  });
}

/**
 * Marks an existing local draft as synced with the cloud.
 */
export async function markLocalDraftSynced(
  userId: string,
  projectId: string,
  cloudUpdatedAt?: string,
): Promise<void> {
  if (!userId || !projectId) return;

  const db = await getDb();
  if (!db) return;

  const existing = await getLocalDraft(userId, projectId);
  if (!existing) return;

  const updated: LocalDraftRecord = {
    ...existing,
    isSynced: true,
    cloudUpdatedAt: cloudUpdatedAt ?? existing.cloudUpdatedAt,
  };

  return new Promise((resolve, reject) => {
    try {
      const tx = db.transaction(STORE_NAME, "readwrite");
      const store = tx.objectStore(STORE_NAME);
      const req = store.put(updated);

      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
      tx.onerror = () => reject(tx.error);
    } catch (err) {
      reject(err);
    }
  });
}

/**
 * Deletes a local draft record from IndexedDB.
 */
export async function deleteLocalDraft(
  userId: string,
  projectId: string,
): Promise<void> {
  if (!userId || !projectId) return;

  const db = await getDb();
  if (!db) return;

  const key = getDraftKey(userId, projectId);

  return new Promise((resolve, reject) => {
    try {
      const tx = db.transaction(STORE_NAME, "readwrite");
      const store = tx.objectStore(STORE_NAME);
      const req = store.delete(key);

      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
      tx.onerror = () => reject(tx.error);
    } catch (err) {
      reject(err);
    }
  });
}
