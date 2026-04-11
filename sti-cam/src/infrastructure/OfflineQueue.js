/**
 * Infrastructure: OfflineQueue
 * Persists pending photos to IndexedDB so they survive app close.
 *
 * Schema per record:
 *   id, projectId, fileName, blob, createdAt (ISO string),
 *   location, captureInfo
 */

const DB_NAME = 'sti-cam-offline';
const DB_VERSION = 1;
const STORE = 'queue';

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (e) => {
      e.target.result.createObjectStore(STORE, { keyPath: 'id' });
    };
    req.onsuccess = (e) => resolve(e.target.result);
    req.onerror = () => reject(req.error);
  });
}

/**
 * Persist a photo to the offline queue.
 * Stores only what is needed to reconstruct the upload — no thumbUrl (blob URL).
 */
export async function saveToQueue(photo) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).put({
      id: photo.id,
      projectId: photo.projectId,
      fileName: photo.fileName,
      blob: photo.blob,
      createdAt: photo.createdAt instanceof Date
        ? photo.createdAt.toISOString()
        : photo.createdAt,
      location: photo.location || null,
      captureInfo: photo.captureInfo || null,
    });
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

/**
 * Returns all persisted queue entries.
 */
export async function loadQueue() {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly');
    const req = tx.objectStore(STORE).getAll();
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

/**
 * Remove a single entry by id (call after successful upload).
 */
export async function removeFromQueue(id) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}
