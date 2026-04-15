/**
 * Infrastructure: OfflineQueue
 * Persists pending photos to IndexedDB so they survive app close.
 *
 * Storage format (v2):
 *   { id, projectId, fileName, buffer (ArrayBuffer), mimeType,
 *     createdAt (ISO), location, captureInfo }
 *
 * Why ArrayBuffer instead of Blob: iOS Safari / PWA loses the backing bytes
 * of Blob objects stored in IndexedDB across sessions — reads throw
 * NotFoundError. Raw ArrayBuffers are not affected.
 *
 * Backward-compat: records written by v1 (with a `blob` field) are still
 * readable — loadQueue rehydrates them and drops any whose bytes are dead.
 */

import { logger } from './Logger.js';

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
 * Converts the Blob to ArrayBuffer so the bytes survive iOS PWA sessions.
 */
export async function saveToQueue(photo) {
  const buffer = await photo.blob.arrayBuffer();
  const mimeType = photo.blob.type || 'image/jpeg';

  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).put({
      id: photo.id,
      projectId: photo.projectId,
      fileName: photo.fileName,
      buffer,
      mimeType,
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
 * Returns all persisted queue entries with blobs rehydrated.
 * Drops records whose bytes are unreadable (old v1 iOS-corrupted records).
 */
export async function loadQueue() {
  const db = await openDB();
  const records = await new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly');
    const req = tx.objectStore(STORE).getAll();
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });

  const valid = [];
  const dead = [];

  for (const r of records) {
    if (r.buffer instanceof ArrayBuffer) {
      valid.push({
        ...r,
        blob: new Blob([r.buffer], { type: r.mimeType || 'image/jpeg' }),
      });
      continue;
    }

    if (r.blob instanceof Blob) {
      try {
        const buffer = await r.blob.arrayBuffer();
        valid.push({
          ...r,
          blob: new Blob([buffer], { type: r.blob.type || 'image/jpeg' }),
          buffer,
          mimeType: r.blob.type || 'image/jpeg',
        });
      } catch (err) {
        logger.warn(`[offline-queue] dropping corrupted record ${r.id}: ${err?.name || err}`);
        dead.push(r.id);
      }
      continue;
    }

    logger.warn(`[offline-queue] dropping unreadable record ${r.id}: no buffer or blob`);
    dead.push(r.id);
  }

  if (dead.length > 0) {
    const txDel = db.transaction(STORE, 'readwrite');
    const store = txDel.objectStore(STORE);
    dead.forEach((id) => store.delete(id));
  }

  return valid;
}

/**
 * Remove a single entry by id (call after successful upload or permanent failure).
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
