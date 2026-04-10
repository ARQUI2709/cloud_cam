/**
 * Infraestructura: Google Sheets API v4
 * Mantiene una hoja por proyecto con columnas:
 *   A: Nombre del archivo
 *   B: Fecha
 *   C: Tamaño
 *   D: =IMAGE(url)  — previsualización en Sheets
 *   E: File ID (oculto, usado para localizar filas al eliminar)
 */

import { getAccessToken } from './GoogleAuth.js';

const SHEETS_API = 'https://sheets.googleapis.com/v4/spreadsheets';
const DRIVE_API  = 'https://www.googleapis.com/drive/v3';

// Cache: projectName → spreadsheetId
const sheetCache = new Map();

async function authHeaders() {
  const token = await getAccessToken();
  return {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  };
}

/**
 * Finds an existing Sheet by name inside STI-Fotos, or creates one.
 * The sheet lives alongside the photo folder in Drive.
 * @param {string} projectName
 * @param {string} folderId - Drive folder ID of the project
 * @returns {string} spreadsheetId
 */
export async function getOrCreateSheet(projectName, folderId) {
  if (sheetCache.has(projectName)) return sheetCache.get(projectName);

  const headers = await authHeaders();
  const sheetName = `STI_${projectName}`;

  // Search for existing sheet in the project folder
  const q = encodeURIComponent(
    `name='${sheetName}' and mimeType='application/vnd.google-apps.spreadsheet' and '${folderId}' in parents and trashed=false`
  );
  const search = await fetch(`${DRIVE_API}/files?q=${q}&fields=files(id)`, { headers });
  const { files } = await search.json();

  if (files?.length) {
    sheetCache.set(projectName, files[0].id);
    return files[0].id;
  }

  // Create new spreadsheet
  const createRes = await fetch(SHEETS_API, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      properties: { title: sheetName },
      sheets: [{
        properties: { title: 'Fotos', gridProperties: { frozenRowCount: 1 } },
      }],
    }),
  });
  const sheet = await createRes.json();
  const spreadsheetId = sheet.spreadsheetId;

  // Move into the project folder
  const fileRes = await fetch(`${DRIVE_API}/files/${spreadsheetId}?addParents=${folderId}&fields=id`, {
    method: 'PATCH',
    headers,
  });
  await fileRes.json();

  // Write header row
  await _writeHeader(spreadsheetId, headers);

  sheetCache.set(projectName, spreadsheetId);
  return spreadsheetId;
}

async function _writeHeader(spreadsheetId, headers) {
  await fetch(`${SHEETS_API}/${spreadsheetId}/values/Fotos!A1:E1?valueInputOption=USER_ENTERED`, {
    method: 'PUT',
    headers,
    body: JSON.stringify({
      values: [['Archivo', 'Fecha', 'Tamaño', 'Imagen', 'File ID']],
    }),
  });

  // Bold + freeze header via batchUpdate
  const sheetRes = await fetch(`${SHEETS_API}/${spreadsheetId}?fields=sheets.properties`, { headers });
  const { sheets } = await sheetRes.json();
  const sheetId = sheets[0].properties.sheetId;

  await fetch(`${SHEETS_API}/${spreadsheetId}:batchUpdate`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      requests: [
        {
          repeatCell: {
            range: { sheetId, startRowIndex: 0, endRowIndex: 1 },
            cell: { userEnteredFormat: { textFormat: { bold: true }, backgroundColor: { red: 0.1, green: 0.1, blue: 0.12 } } },
            fields: 'userEnteredFormat(textFormat,backgroundColor)',
          },
        },
        // Hide column E (File ID) — set width to 0
        {
          updateDimensionProperties: {
            range: { sheetId, dimension: 'COLUMNS', startIndex: 4, endIndex: 5 },
            properties: { hiddenByUser: true },
            fields: 'hiddenByUser',
          },
        },
        // Set row height for image rows (60px)
        {
          updateDimensionProperties: {
            range: { sheetId, dimension: 'ROWS', startIndex: 1 },
            properties: { pixelSize: 120 },
            fields: 'pixelSize',
          },
        },
        // Set column D (image) width
        {
          updateDimensionProperties: {
            range: { sheetId, dimension: 'COLUMNS', startIndex: 3, endIndex: 4 },
            properties: { pixelSize: 180 },
            fields: 'pixelSize',
          },
        },
      ],
    }),
  });
}

/**
 * Appends a photo row to the project sheet.
 * Called after a successful upload.
 */
export async function appendPhotoRow(spreadsheetId, photo) {
  const headers = await authHeaders();
  const imageUrl = `https://drive.google.com/thumbnail?id=${photo.driveFileId}&sz=w400`;
  const date = photo.createdAt
    ? new Date(photo.createdAt).toLocaleString('es-CO')
    : '';
  const size = photo.sizeLabel || '';

  await fetch(`${SHEETS_API}/${spreadsheetId}/values/Fotos!A:E:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      values: [[
        photo.fileName,
        date,
        size,
        `=IMAGE("${imageUrl}")`,
        photo.driveFileId,
      ]],
    }),
  });
}

/**
 * Removes a photo row from the sheet by matching the Drive file ID in column E.
 * @param {string} spreadsheetId
 * @param {string} driveFileId
 */
export async function removePhotoRow(spreadsheetId, driveFileId) {
  const headers = await authHeaders();

  // Read all file IDs from column E
  const res = await fetch(`${SHEETS_API}/${spreadsheetId}/values/Fotos!E:E`, { headers });
  const { values = [] } = await res.json();

  const rowIndex = values.findIndex((row) => row[0] === driveFileId);
  if (rowIndex < 1) return; // not found or header row

  // Get sheetId
  const sheetRes = await fetch(`${SHEETS_API}/${spreadsheetId}?fields=sheets.properties`, { headers });
  const { sheets } = await sheetRes.json();
  const sheetId = sheets[0].properties.sheetId;

  await fetch(`${SHEETS_API}/${spreadsheetId}:batchUpdate`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      requests: [{
        deleteDimension: {
          range: { sheetId, dimension: 'ROWS', startIndex: rowIndex, endIndex: rowIndex + 1 },
        },
      }],
    }),
  });
}
