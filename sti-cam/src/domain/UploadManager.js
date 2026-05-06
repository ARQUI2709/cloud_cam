/**
 * Servicio de dominio: UploadManager
 * Orquesta la cola de subida con concurrencia controlada.
 *
 * v2: Adds automatic retry with exponential backoff for transient failures.
 */

import { logger } from '../infrastructure/Logger.js';
import { removeFromQueue } from '../infrastructure/OfflineQueue.js';

const MAX_CONCURRENT = 2;
const MAX_RETRIES = 3;
const RETRY_DELAYS = [3000, 10000, 30000]; // 3s, 10s, 30s

export class UploadManager {
  constructor({ driveService, sheetsService, onUpdate }) {
    this.driveService = driveService;
    this.sheetsService = sheetsService;  // { getOrCreateSheet, appendPhotoRow }
    this.onUpdate = onUpdate; // (id, updates) => void
    this.active = 0;
    this.waiting = [];
  }

  /**
   * Encola una foto para subir.
   * @param {object} photo - Entidad Photo
   * @param {string} folderId - ID de carpeta destino en Drive
   * @param {string} projectName - Nombre del proyecto (para la hoja)
   */
  enqueue(photo, folderId, projectName) {
    if (this.waiting.some((w) => w.photo.id === photo.id)) {
      logger.warn(`[upload] duplicate enqueue ignored for ${photo.fileName}`);
      return;
    }
    this.waiting.push({ photo, folderId, projectName, retryCount: 0 });
    this._drainQueue();
  }

  async _processNext() {
    if (this.active >= MAX_CONCURRENT || this.waiting.length === 0) return;

    this.active++;
    const { photo, folderId, projectName, retryCount } = this.waiting.shift();

    try {
      this.onUpdate(photo.id, { status: 'uploading', progress: 10 });
    } catch (e) {
      logger.warn('[upload] onUpdate threw during status set:', e);
    }
    logger.log(`[upload] starting ${photo.fileName} (attempt ${retryCount + 1})`);

    try {
      const fileId = await this.driveService.uploadFile({
        blob: photo.blob,
        fileName: photo.fileName,
        folderId,
        mimeType: 'image/jpeg',
        createdAt: photo.createdAt,
        location: photo.location,
        captureInfo: photo.captureInfo,
        onProgress: (progress) => {
          try {
            this.onUpdate(photo.id, { progress: Math.round(progress * 90) + 10 });
          } catch (_) {}
        },
      });

      logger.log(`[upload] success ${photo.fileName} → ${fileId}`);
      try {
        this.onUpdate(photo.id, {
          status: 'done',
          progress: 100,
          driveFileId: fileId,
        });
      } catch (_) {}

      // Update project sheet — retry up to 3× with backoff
      if (this.sheetsService && projectName) {
        await this._appendSheetWithRetry(photo, fileId, projectName, folderId);
      }
    } catch (err) {
      logger.error(`[upload] failed ${photo.fileName} (attempt ${retryCount + 1}):`, err);
      // Only NotFoundError (iOS PWA dead blob — bytes gone, unrecoverable) is
      // treated as permanent. Everything else — network failures, timeouts,
      // "Load failed" (iOS Safari fetch error), auth errors — is transient and
      // should be retried with backoff so photos are never silently discarded.
      const isDeadBlob = err.name === 'NotFoundError'
        || /object can ?not be found/i.test(err.message || '');

      const isTransient = !isDeadBlob;

      if (isTransient && retryCount < MAX_RETRIES) {
        const delay = RETRY_DELAYS[retryCount] || RETRY_DELAYS[RETRY_DELAYS.length - 1];
        logger.log(`[upload] scheduling retry ${retryCount + 1}/${MAX_RETRIES} in ${delay}ms for ${photo.fileName}`);
        try {
          this.onUpdate(photo.id, {
            status: 'offline',
            error: `Reintentando en ${Math.round(delay / 1000)}s...`,
          });
        } catch (_) {}
        setTimeout(() => {
          // Only retry if still online
          if (navigator.onLine) {
            this.waiting.push({ photo, folderId, projectName, retryCount: retryCount + 1 });
            this._drainQueue();
          } else {
            logger.log(`[upload] offline — skipping retry for ${photo.fileName}`);
            try {
              this.onUpdate(photo.id, {
                status: 'offline',
                error: 'Sin conexión — se reintentará al reconectar',
              });
            } catch (_) {}
          }
        }, delay);
      } else {
        const permanent = isDeadBlob || !isTransient;
        try {
          this.onUpdate(photo.id, {
            status: permanent ? 'error' : 'offline',
            error: isDeadBlob
              ? 'Foto corrupta en almacenamiento offline — no recuperable'
              : err.message || 'Upload failed',
          });
        } catch (_) {}
        if (permanent) {
          removeFromQueue(photo.id).catch((e) => {
            logger.warn(`[upload] failed to remove dead record ${photo.id}:`, e);
          });
        }
      }
    } finally {
      this.active--;
      this._drainQueue();
    }
  }

  /** Append a row to the project sheet, retrying up to 3× on transient failure. */
  async _appendSheetWithRetry(photo, fileId, projectName, folderId) {
    const DELAYS = [2000, 5000, 10000];
    for (let attempt = 0; attempt <= DELAYS.length; attempt++) {
      try {
        const spreadsheetId = await this.sheetsService.getOrCreateSheet(projectName, folderId);
        await this.sheetsService.appendPhotoRow(spreadsheetId, { ...photo, driveFileId: fileId });
        if (attempt > 0) logger.log(`[sheet] append succeeded on attempt ${attempt + 1}`);
        return;
      } catch (err) {
        if (attempt < DELAYS.length) {
          logger.warn(`[sheet] append failed (attempt ${attempt + 1}), retrying in ${DELAYS[attempt] / 1000}s:`, err);
          await new Promise((r) => setTimeout(r, DELAYS[attempt]));
        } else {
          logger.warn('[sheet] append failed after all retries (non-critical):', err);
        }
      }
    }
  }

  /** Safe wrapper — ensures _processNext never throws unhandled */
  _drainQueue() {
    try {
      this._processNext().catch((e) => {
        logger.warn('[upload] _processNext rejected:', e);
      });
    } catch (e) {
      logger.warn('[upload] _processNext threw:', e);
    }
  }
}
