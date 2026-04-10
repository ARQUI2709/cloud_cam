/**
 * Entidad de dominio: Photo
 * Representa una foto capturada pendiente de subir o ya subida.
 */
export function createPhoto({ blob, projectId, sessionNumber, sourceDate, sourceName }) {
  const now = sourceDate ? new Date(sourceDate) : new Date();
  const timestamp = now.toISOString().replace(/[:.]/g, '-');
  // Derive a clean base name: strip extension from original file name if provided
  const baseName = sourceName
    ? sourceName.replace(/\.[^.]+$/, '').replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 40)
    : null;
  const fileName = baseName
    ? `STI_${timestamp}_${baseName}.jpg`
    : `STI_${timestamp}_${String(sessionNumber).padStart(3, '0')}.jpg`;

  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    projectId,
    fileName,
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
