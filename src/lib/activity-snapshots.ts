import type { LessonDocument } from '@/types/lesson';

const DB_NAME = 'lectern-history';
const DB_VERSION = 1;
const STORE = 'snapshots';
export const ACTIVITY_HEAD_SNAPSHOT = '__head__';

function snapshotKey(lessonId: string, eventId: string): string {
  return `${lessonId}::${eventId}`;
}

export function cloneLessonSnapshot(lesson: LessonDocument): LessonDocument {
  return structuredClone(lesson);
}

function openHistoryDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onerror = () => reject(request.error ?? new Error('History IndexedDB unavailable.'));
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE);
      }
    };
    request.onsuccess = () => resolve(request.result);
  });
}

export async function putActivitySnapshot(
  lessonId: string,
  eventId: string,
  lesson: LessonDocument,
): Promise<void> {
  if (!lessonId || typeof indexedDB === 'undefined') return;
  const db = await openHistoryDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.oncomplete = () => {
      db.close();
      resolve();
    };
    tx.onerror = () => {
      db.close();
      reject(tx.error ?? new Error('History snapshot write failed.'));
    };
    tx.objectStore(STORE).put(
      { lessonId, eventId, savedAt: new Date().toISOString(), lesson },
      snapshotKey(lessonId, eventId),
    );
  });
}

export async function getActivitySnapshot(
  lessonId: string,
  eventId: string,
): Promise<LessonDocument | null> {
  if (!lessonId || typeof indexedDB === 'undefined') return null;
  try {
    const db = await openHistoryDb();
    return await new Promise<LessonDocument | null>((resolve, reject) => {
      const tx = db.transaction(STORE, 'readonly');
      tx.oncomplete = () => db.close();
      tx.onerror = () => {
        db.close();
        reject(tx.error ?? new Error('History snapshot read failed.'));
      };
      const request = tx.objectStore(STORE).get(snapshotKey(lessonId, eventId));
      request.onsuccess = () => {
        const value = request.result as { lesson?: LessonDocument } | undefined;
        resolve(value?.lesson?.meta ? value.lesson : null);
      };
      request.onerror = () => reject(request.error ?? new Error('History snapshot read failed.'));
    });
  } catch {
    return null;
  }
}

export async function deleteActivitySnapshots(lessonId: string, eventIds: string[]): Promise<void> {
  if (!lessonId || eventIds.length === 0 || typeof indexedDB === 'undefined') return;
  try {
    const db = await openHistoryDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite');
      tx.oncomplete = () => {
        db.close();
        resolve();
      };
      tx.onerror = () => {
        db.close();
        reject(tx.error ?? new Error('History snapshot delete failed.'));
      };
      const store = tx.objectStore(STORE);
      for (const eventId of eventIds) {
        store.delete(snapshotKey(lessonId, eventId));
      }
    });
  } catch {
    /* quota / private mode */
  }
}

export async function clearLessonActivitySnapshots(lessonId: string): Promise<void> {
  if (!lessonId || typeof indexedDB === 'undefined') return;
  try {
    const db = await openHistoryDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite');
      tx.oncomplete = () => {
        db.close();
        resolve();
      };
      tx.onerror = () => {
        db.close();
        reject(tx.error ?? new Error('History snapshot clear failed.'));
      };
      const store = tx.objectStore(STORE);
      const request = store.openCursor();
      request.onsuccess = () => {
        const cursor = request.result;
        if (!cursor) return;
        const key = String(cursor.key);
        if (key.startsWith(`${lessonId}::`)) cursor.delete();
        cursor.continue();
      };
    });
  } catch {
    /* private mode */
  }
}
