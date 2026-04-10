/**
 * Infraestructura: Google Drive API v3
 * Maneja la creación de carpetas y subida de archivos.
 */

import { getAccessToken } from './GoogleAuth.js';
import { DRIVE_ROOT_FOLDER } from '../config/google.js';

const DRIVE_API = 'https://www.googleapis.com/drive/v3';
const UPLOAD_API = 'https://www.googleapis.com/upload/drive/v3';

// Cache de folder IDs para no buscar repetidamente
const folderCache = new Map();

/**
 * Headers con el token de autenticación.
 */
async function authHeaders() {
  const token = await getAccessToken();
  return { Authorization: `Bearer ${token}` };
}

/**
 * Busca una carpeta por nombre dentro de un parent.
 * @returns {string|null} folder ID o null
 */
async function findFolder(name, parentId = 'root') {
  const cacheKey = `${parentId}/${name}`;
  if (folderCache.has(cacheKey)) return folderCache.get(cacheKey);

  const q = encodeURIComponent(
    `name='${name}' and mimeType='application/vnd.google-apps.folder' and '${parentId}' in parents and trashed=false`
  );
  const headers = await authHeaders();
  const res = await fetch(`${DRIVE_API}/files?q=${q}&fields=files(id,name)`, { headers });
  const data = await res.json();

  const id = data.files?.[0]?.id || null;
  if (id) folderCache.set(cacheKey, id);
  return id;
}

/**
 * Crea una carpeta en Drive.
 * @returns {string} folder ID
 */
async function createFolder(name, parentId = 'root') {
  const headers = await authHeaders();
  const res = await fetch(`${DRIVE_API}/files`, {
    method: 'POST',
    headers: { ...headers, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name,
      mimeType: 'application/vnd.google-apps.folder',
      parents: [parentId],
    }),
  });
  const data = await res.json();
  const cacheKey = `${parentId}/${name}`;
  folderCache.set(cacheKey, data.id);
  return data.id;
}

/**
 * Obtiene o crea la carpeta de un proyecto.
 * Estructura: STI-Fotos / {projectName}
 * @returns {string} folder ID del proyecto
 */
export async function getProjectFolderId(projectName) {
  // 1. Carpeta raíz STI-Fotos
  let rootId = await findFolder(DRIVE_ROOT_FOLDER, 'root');
  if (!rootId) {
    rootId = await createFolder(DRIVE_ROOT_FOLDER, 'root');
  }

  // 2. Subcarpeta del proyecto
  let projectId = await findFolder(projectName, rootId);
  if (!projectId) {
    projectId = await createFolder(projectName, rootId);
  }

  return projectId;
}

/**
 * Sube un archivo a Google Drive usando multipart upload.
 * @param {object} params
 * @param {Blob} params.blob - El archivo a subir
 * @param {string} params.fileName - Nombre del archivo
 * @param {string} params.folderId - ID de carpeta destino
 * @param {string} params.mimeType - Tipo MIME
 * @param {function} params.onProgress - Callback de progreso (0-1)
 * @returns {string} file ID del archivo subido
 */
export async function uploadFile({ blob, fileName, folderId, mimeType = 'image/jpeg', createdAt, location, captureInfo, onProgress }) {
  const token = await getAccessToken();

  const metadata = {
    name: fileName,
    mimeType,
    parents: [folderId],
    ...(createdAt && {
      createdTime: new Date(createdAt).toISOString(),
      modifiedTime: new Date(createdAt).toISOString(),
    }),
    ...((location || captureInfo) && {
      properties: {
        ...(location && {
          lat: String(location.latitude),
          lng: String(location.longitude),
          ...(location.altitude != null && { alt: String(location.altitude) }),
        }),
        ...(captureInfo || {}),
      },
    }),
  };

  // Usar multipart upload para archivos < 5MB, resumable para mayores
  if (blob.size < 5 * 1024 * 1024) {
    return _multipartUpload(token, metadata, blob, mimeType);
  }
  return _resumableUpload(token, metadata, blob, mimeType, onProgress);
}

/**
 * Upload multipart (simple, para archivos pequeños).
 */
async function _multipartUpload(token, metadata, blob, mimeType) {
  const boundary = '---sti_cam_boundary_' + Date.now();
  const delimiter = `\r\n--${boundary}\r\n`;
  const closeDelimiter = `\r\n--${boundary}--`;

  const metaPart = delimiter +
    'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
    JSON.stringify(metadata);

  const reader = new FileReader();
  const base64 = await new Promise((resolve) => {
    reader.onload = () => resolve(reader.result.split(',')[1]);
    reader.readAsDataURL(blob);
  });

  const body = metaPart + delimiter +
    `Content-Type: ${mimeType}\r\n` +
    'Content-Transfer-Encoding: base64\r\n\r\n' +
    base64 + closeDelimiter;

  const res = await fetch(
    `${UPLOAD_API}/files?uploadType=multipart&fields=id`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': `multipart/related; boundary=${boundary}`,
      },
      body,
    }
  );

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.message || `Upload failed: ${res.status}`);
  }

  const data = await res.json();
  return data.id;
}

/**
 * Upload resumable (para archivos grandes, con progreso).
 */
async function _resumableUpload(token, metadata, blob, mimeType, onProgress) {
  // 1. Iniciar sesión resumable
  const initRes = await fetch(
    `${UPLOAD_API}/files?uploadType=resumable&fields=id`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json; charset=UTF-8',
        'X-Upload-Content-Type': mimeType,
        'X-Upload-Content-Length': blob.size,
      },
      body: JSON.stringify(metadata),
    }
  );

  const uploadUrl = initRes.headers.get('Location');
  if (!uploadUrl) throw new Error('No upload URL received');

  // 2. Subir por chunks
  const CHUNK_SIZE = 256 * 1024; // 256KB
  let offset = 0;

  while (offset < blob.size) {
    const end = Math.min(offset + CHUNK_SIZE, blob.size);
    const chunk = blob.slice(offset, end);

    const res = await fetch(uploadUrl, {
      method: 'PUT',
      headers: {
        'Content-Range': `bytes ${offset}-${end - 1}/${blob.size}`,
        'Content-Type': mimeType,
      },
      body: chunk,
    });

    if (res.status === 200 || res.status === 201) {
      onProgress?.(1);
      const data = await res.json();
      return data.id;
    }

    if (res.status !== 308) {
      throw new Error(`Upload chunk failed: ${res.status}`);
    }

    offset = end;
    onProgress?.(offset / blob.size);
  }

  throw new Error('Upload ended without completion');
}

/**
 * Lista archivos de imagen en una carpeta.
 * @param {string} folderId - ID de la carpeta
 * @returns {Promise<Array<{id, name, thumbnailLink, webViewLink, createdTime}>>}
 */
export async function listFiles(folderId) {
  const headers = await authHeaders();
  const q = encodeURIComponent(
    `'${folderId}' in parents and mimeType contains 'image/' and trashed=false`
  );
  const fields = `nextPageToken,files(id,name,thumbnailLink,webViewLink,createdTime,size,imageMediaMetadata,properties)`;
  const all = [];
  let pageToken = null;

  do {
    const url = `${DRIVE_API}/files?q=${q}&fields=${fields}&orderBy=createdTime desc&pageSize=1000${pageToken ? `&pageToken=${pageToken}` : ''}`;
    const res = await fetch(url, { headers });
    if (!res.ok) throw new Error(`Failed to list files: ${res.status}`);
    const data = await res.json();
    all.push(...(data.files || []));
    pageToken = data.nextPageToken || null;
  } while (pageToken);

  return all;
}

/**
 * Elimina un archivo de Google Drive.
 * @param {string} fileId - ID del archivo
 */
export async function deleteFile(fileId) {
  const headers = await authHeaders();
  const res = await fetch(`${DRIVE_API}/files/${fileId}`, {
    method: 'DELETE',
    headers,
  });
  if (!res.ok && res.status !== 204) {
    throw new Error(`Failed to delete file: ${res.status}`);
  }
}
