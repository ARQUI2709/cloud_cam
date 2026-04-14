/**
 * Servicio de dominio: UploadManager
 * Orquesta la cola de subida con concurrencia controlada.
 *
 * v2: Adds automatic retry with exponential backoff for transient failures.
 */

import { logger } from '../infrastructure/Logger.js';

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

      // Update project sheet
      if (this.sheetsService && projectName) {
        try {
          const spreadsheetId = await this.sheetsService.getOrCreateSheet(projectName, folderId);
          await this.sheetsService.appendPhotoRow(spreadsheetId, { ...photo, driveFileId: fileId });
        } catch (sheetErr) {
          logger.warn('Sheet update failed (non-critical):', sheetErr);
        }
      }
    } catch (err) {
      logger.error(`[upload] failed ${photo.fileName} (attempt ${retryCount + 1}):`, err);
      // Auth/network errors are transient — keep in IDB for retry, mark as offline
      // Permanent errors (e.g. bad file) mark as error and remove from IDB
      const isTransient = !err.message
        || err.name === 'AbortError'
        || /fetch|network|offline|abort|401|403|token/i.test(err.message);

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
        try {
          this.onUpdate(photo.id, {
            status: isTransient ? 'offline' : 'error',
            error: err.message || 'Upload failed',
          });
        } catch (_) {}
      }
    } finally {
      this.active--;
      this._drainQueue();
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
