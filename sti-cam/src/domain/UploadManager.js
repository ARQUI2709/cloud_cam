/**
 * Servicio de dominio: UploadManager
 * Orquesta la cola de subida con concurrencia controlada.
 */

const MAX_CONCURRENT = 2;

export class UploadManager {
  constructor({ driveService, onUpdate }) {
    this.driveService = driveService;
    this.onUpdate = onUpdate; // (id, updates) => void
    this.active = 0;
    this.waiting = [];
  }

  /**
   * Encola una foto para subir.
   * @param {object} photo - Entidad Photo
   * @param {string} folderId - ID de carpeta destino en Drive
   */
  enqueue(photo, folderId) {
    this.waiting.push({ photo, folderId });
    this._processNext();
  }

  async _processNext() {
    if (this.active >= MAX_CONCURRENT || this.waiting.length === 0) return;

    this.active++;
    const { photo, folderId } = this.waiting.shift();

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
