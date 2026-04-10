/**
 * Entidad de dominio: Photo
 * Representa una foto capturada pendiente de subir o ya subida.
 */
export function createPhoto({ blob, projectId, sessionNumber }) {
  const now = new Date();
  const timestamp = now.toISOString().replace(/[:.]/g, '-');
  
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    projectId,
    fileName: `STI_${timestamp}_${String(sessionNumber).padStart(3, '0')}.jpg`,
    blob,
    size: blob.size,
    sizeLabel: `${(blob.size / 1024 / 1024).toFixed(1)} MB`,
    thumbUrl: URL.createObjectURL(blob),
    status: 'pending',    // 'pending' | 'uploading' | 'done' | 'error'
    progress: 0,
    driveFileId: null,
    error: null,
    createdAt: now,
  };
}

export function releasePhoto(photo) {
  if (photo.thumbUrl) {
    URL.revokeObjectURL(photo.thumbUrl);
  }
}
