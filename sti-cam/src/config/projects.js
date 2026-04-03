/**
 * Gestión de proyectos con persistencia en localStorage + Google Drive sync.
 * localStorage acts as fast cache; Drive is the source of truth across devices.
 */

import { getAccessToken } from '../infrastructure/GoogleAuth';
import { DRIVE_ROOT_FOLDER } from './google';

const STORAGE_KEY = 'sti-cam-projects';
const DRIVE_FILE_NAME = 'sti-cam-projects.json';
const DRIVE_API = 'https://www.googleapis.com/drive/v3';
const UPLOAD_API = 'https://www.googleapis.com/upload/drive/v3';

// In-memory cache of the Drive file ID for projects.json
let projectsFileId = null;

function loadProjects() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveProjectsLocal(projects) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(projects));
}

/**
 * Find the STI-Fotos root folder ID.
 */
async function getRootFolderId() {
  const token = await getAccessToken();
  const q = encodeURIComponent(
    `name='${DRIVE_ROOT_FOLDER}' and mimeType='application/vnd.google-apps.folder' and 'root' in parents and trashed=false`
  );
  const res = await fetch(`${DRIVE_API}/files?q=${q}&fields=files(id)`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = await res.json();
  return data.files?.[0]?.id || null;
}

/**
 * Find the projects.json file inside STI-Fotos.
 */
async function findProjectsFile(rootId) {
  if (projectsFileId) return projectsFileId;
  const token = await getAccessToken();
  const q = encodeURIComponent(
    `name='${DRIVE_FILE_NAME}' and '${rootId}' in parents and trashed=false`
  );
  const res = await fetch(`${DRIVE_API}/files?q=${q}&fields=files(id)`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = await res.json();
  projectsFileId = data.files?.[0]?.id || null;
  return projectsFileId;
}

/**
 * Upload/update the projects.json file on Drive.
 */
async function saveProjectsToDrive(projects, rootId) {
  const token = await getAccessToken();
  const content = JSON.stringify(projects);
  const fileId = await findProjectsFile(rootId);

  if (fileId) {
    // Update existing file
    await fetch(`${UPLOAD_API}/files/${fileId}?uploadType=media`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: content,
    });
  } else {
    // Create new file
    const boundary = '---sti_projects_' + Date.now();
    const metadata = JSON.stringify({
      name: DRIVE_FILE_NAME,
      mimeType: 'application/json',
      parents: [rootId],
    });
    const body =
      `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${metadata}\r\n` +
      `--${boundary}\r\nContent-Type: application/json\r\n\r\n${content}\r\n` +
      `--${boundary}--`;

    const res = await fetch(`${UPLOAD_API}/files?uploadType=multipart&fields=id`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': `multipart/related; boundary=${boundary}`,
      },
      body,
    });
    const data = await res.json();
    projectsFileId = data.id;
  }
}

// ---- Public API ----

export function getProjects() {
  return loadProjects();
}

export function getProject(id) {
  return loadProjects().find((p) => p.id === id);
}

export function addProject(name, icon) {
  const projects = loadProjects();
  const id = crypto.randomUUID?.() || `p_${Date.now()}`;
  const project = { id, name, icon, folderId: null };
  projects.push(project);
  saveProjectsLocal(projects);
  // Fire-and-forget Drive sync
  syncProjectsToDrive(projects);
  return project;
}

export function removeProject(id) {
  const projects = loadProjects().filter((p) => p.id !== id);
  saveProjectsLocal(projects);
  // Fire-and-forget Drive sync
  syncProjectsToDrive(projects);
}

/**
 * Sync current projects to Drive (fire-and-forget).
 */
async function syncProjectsToDrive(projects) {
  try {
    let rootId = await getRootFolderId();
    if (!rootId) {
      // Create root folder if needed (via getProjectFolderId with a dummy — or directly)
      // Just use a temporary project call to ensure root exists
      const token = await getAccessToken();
      const res = await fetch(`${DRIVE_API}/files`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: DRIVE_ROOT_FOLDER,
          mimeType: 'application/vnd.google-apps.folder',
          parents: ['root'],
        }),
      });
      const data = await res.json();
      rootId = data.id;
    }
    await saveProjectsToDrive(projects, rootId);
  } catch {
    // Silently fail — localStorage still has the data
  }
}

/**
 * Pull projects from Drive and merge with localStorage.
 * Call this on app start after auth.
 * @returns {Promise<Array>} merged projects list
 */
export async function syncProjectsFromDrive() {
  try {
    const rootId = await getRootFolderId();
    if (!rootId) return loadProjects();

    const fileId = await findProjectsFile(rootId);
    if (!fileId) {
      // No remote file yet — push local to Drive
      const local = loadProjects();
      if (local.length > 0) {
        await saveProjectsToDrive(local, rootId);
      }
      return local;
    }

    // Download remote projects
    const token = await getAccessToken();
    const res = await fetch(`${DRIVE_API}/files/${fileId}?alt=media`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const remote = await res.json();

    // Merge: use remote as base, add any local-only projects
    const local = loadProjects();
    const remoteIds = new Set(remote.map((p) => p.id));
    const merged = [...remote];
    for (const lp of local) {
      if (!remoteIds.has(lp.id)) {
        merged.push(lp);
      }
    }

    saveProjectsLocal(merged);
    // Push merged back if we added local-only items
    if (merged.length > remote.length) {
      await saveProjectsToDrive(merged, rootId);
    }

    return merged;
  } catch {
    return loadProjects();
  }
}
