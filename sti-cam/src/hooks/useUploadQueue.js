import { useRef, useCallback } from 'react';
import { UploadManager } from '../domain/UploadManager';
import { uploadFile, getProjectFolderId } from '../infrastructure/GoogleDrive';
import { getProject } from '../config/projects';
import { GOOGLE_CLIENT_ID } from '../config/google';

/**
 * Hook que conecta el UploadManager con Google Drive.
 */
export function useUploadQueue({ updateQueueItem }) {
  const managerRef = useRef(null);
  const folderCacheRef = useRef(new Map());

  const getManager = useCallback(() => {
    if (!managerRef.current) {
      managerRef.current = new UploadManager({
        driveService: { uploadFile },
        onUpdate: updateQueueItem,
      });
    }
    return managerRef.current;
  }, [updateQueueItem]);

  /**
   * Encola una foto para subir.
   * Si Google no está configurado, simula el upload.
   */
  const enqueueUpload = useCallback(async (photo) => {
    const isConfigured = !!GOOGLE_CLIENT_ID;

    if (!isConfigured) {
      // Modo demo: simular upload
      updateQueueItem(photo.id, { status: 'uploading', progress: 10 });
      let p = 10;
      const interval = setInterval(() => {
        p += Math.random() * 20 + 10;
        if (p >= 100) {
          clearInterval(interval);
          updateQueueItem(photo.id, { status: 'done', progress: 100 });
        } else {
          updateQueueItem(photo.id, { progress: Math.round(p) });
        }
      }, 400);
      return;
    }

    // Producción: obtener/crear carpeta y subir
    try {
      const project = getProject(photo.projectId);
      let folderId = folderCacheRef.current.get(photo.projectId);

      if (!folderId) {
        folderId = await getProjectFolderId(project.name);
        folderCacheRef.current.set(photo.projectId, folderId);
      }

      getManager().enqueue(photo, folderId);
    } catch (err) {
      updateQueueItem(photo.id, { status: 'error', error: err.message });
    }
  }, [getManager, updateQueueItem]);

  return { enqueueUpload };
}
