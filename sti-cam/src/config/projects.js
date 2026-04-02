/**
 * Lista de proyectos activos.
 * Edita este archivo para agregar/quitar proyectos.
 * 
 * folderId: (opcional) ID de la carpeta en Google Drive.
 *           Si se omite, se crea automáticamente en STI-Fotos/
 */
export const PROJECTS = [
  { id: 'fsfb',      name: 'FSFB Bloque B',               icon: '🏥', folderId: null },
  { id: 'compensar', name: 'Compensar - Complejo Acuático', icon: '🏊', folderId: null },
  { id: 'entrerios', name: 'Entre Ríos',                   icon: '🏘️', folderId: null },
  { id: 'portal',    name: 'Portal de la Autopista',       icon: '🏢', folderId: null },
];

export const getProject = (id) => PROJECTS.find((p) => p.id === id);
