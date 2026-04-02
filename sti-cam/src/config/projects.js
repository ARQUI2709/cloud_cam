/**
 * Gestión de proyectos con persistencia en localStorage.
 */

const STORAGE_KEY = 'sti-cam-projects';

function loadProjects() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveProjects(projects) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(projects));
}

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
  saveProjects(projects);
  return project;
}

export function removeProject(id) {
  const projects = loadProjects().filter((p) => p.id !== id);
  saveProjects(projects);
}
