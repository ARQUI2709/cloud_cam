/**
 * Servicio de dominio: UploadManager
 * Orquesta la cola de subida con concurrencia controlada.
 *
 * v2: Adds automatic retry with exponential backoff for transient failures.
 */

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
    this._processNext();
  }

  async _processNext() {
    if (this.active >= MAX_CONCURRENT || this.waiting.length === 0) return;

    this.active++;
    const { photo, folderId, projectName, retryCount } = this.waiting.shift();

    this.onUpdate(photo.id, { status: 'uploading', progress: 10 });
    console.log(`[upload] starting ${photo.fileName} (attempt ${retryCount + 1})`);

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
          this.onUpdate(photo.id, { progress: Math.round(progress * 90) + 10 });
        },
      });

      console.log(`[upload] success ${photo.fileName} → ${fileId}`);
      this.onUpdate(photo.id, {
        status: 'done',
        progress: 100,
        driveFileId: fileId,
      });

      // Update project sheet
      if (this.sheetsService && projectName) {
        try {
          const spreadsheetId = await this.sheetsService.getOrCreateSheet(projectName, folderId);
          await this.sheetsService.appendPhotoRow(spreadsheetId, { ...photo, driveFileId: fileId });
        } catch (sheetErr) {
          console.warn('Sheet update failed (non-critical):', sheetErr);
        }
      }
    } catch (err) {
      console.error(`[upload] failed ${photo.fileName} (attempt ${retryCount + 1}):`, err);
      // Auth/network errors are transient — keep in IDB for retry, mark as offline
      // Permanent errors (e.g. bad file) mark as error and remove from IDB
      const isTransient = !err.message || /fetch|network|offline|401|403|token/i.test(err.message);

      if (isTransient && retryCount < MAX_RETRIES) {
        const delay = RETRY_DELAYS[retryCount] || RETRY_DELAYS[RETRY_DELAYS.length - 1];
        console.log(`[upload] scheduling retry ${retryCount + 1}/${MAX_RETRIES} in ${delay}ms for ${photo.fileName}`);
        this.onUpdate(photo.id, {
          status: 'offline',
          error: `Reintentando en ${Math.round(delay / 1000)}s...`,
        });
        setTimeout(() => {
          // Only retry if still online
          if (navigator.onLine) {
            this.waiting.push({ photo, folderId, projectName, retryCount: retryCount + 1 });
            this._processNext();
          } else {
            console.log(`[upload] offline — skipping retry for ${photo.fileName}`);
            this.onUpdate(photo.id, {
              status: 'offline',
              error: 'Sin conexión — se reintentará al reconectar',
            });
          }
        }, delay);
      } else {
        this.onUpdate(photo.id, {
          status: isTransient ? 'offline' : 'error',
          error: err.message || 'Upload failed',
        });
      }
    } finally {
      this.active--;
      this._processNext();
    }
  }
}
