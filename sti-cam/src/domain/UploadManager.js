/**
 * Servicio de dominio: UploadManager
 * Orquesta la cola de subida con concurrencia controlada.
 */

const MAX_CONCURRENT = 2;

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
    this.waiting.push({ photo, folderId, projectName });
    this._processNext();
  }

  async _processNext() {
    if (this.active >= MAX_CONCURRENT || this.waiting.length === 0) return;

    this.active++;
    const { photo, folderId, projectName } = this.waiting.shift();

    this.onUpdate(photo.id, { status: 'uploading', progress: 10 });

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
      console.error(`Upload failed for ${photo.fileName}:`, err);
      this.onUpdate(photo.id, {
        status: 'error',
        error: err.message || 'Upload failed',
      });
    } finally {
      this.active--;
      this._processNext();
    }
  }
}
