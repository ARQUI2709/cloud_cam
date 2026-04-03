/**
 * Infraestructura: Google OAuth 2.0
 * Usa Google Identity Services (GIS) Token Model.
 *
 * El script de GIS se carga dinámicamente.
 * Token y user info persisten en localStorage.
 */

import { GOOGLE_CLIENT_ID, GOOGLE_SCOPES } from '../config/google.js';

const STORAGE_KEY = 'sti-cam-auth';

let tokenClient = null;
let accessToken = null;
let tokenExpiresAt = 0;

// Restore from localStorage on load
try {
  const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
  if (saved && saved.token && saved.expiresAt > Date.now()) {
    accessToken = saved.token;
    tokenExpiresAt = saved.expiresAt;
  }
} catch {}

function persistSession(user) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({
    token: accessToken,
    expiresAt: tokenExpiresAt,
    user,
  }));
}

/**
 * Carga el script de Google Identity Services.
 */
function loadGisScript() {
  return new Promise((resolve, reject) => {
    if (window.google?.accounts?.oauth2) {
      resolve();
      return;
    }
    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.onload = resolve;
    script.onerror = () => reject(new Error('Failed to load Google Identity Services'));
    document.head.appendChild(script);
  });
}

/**
 * Inicializa el token client de OAuth.
 */
export async function initAuth() {
  if (!GOOGLE_CLIENT_ID) {
    throw new Error(
      'VITE_GOOGLE_CLIENT_ID no configurado. Crea un archivo .env con tu Client ID.'
    );
  }
  await loadGisScript();
}

/**
 * Returns saved user info if session is still valid.
 */
export function getSavedUser() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (saved && saved.user && saved.expiresAt > Date.now()) {
      return saved.user;
    }
  } catch {}
  return null;
}

/**
 * Solicita token de acceso al usuario (popup de Google).
 */
export function requestAccessToken() {
  return new Promise((resolve, reject) => {
    tokenClient = window.google.accounts.oauth2.initTokenClient({
      client_id: GOOGLE_CLIENT_ID,
      scope: GOOGLE_SCOPES,
      callback: (response) => {
        if (response.error) {
          reject(new Error(response.error_description || response.error));
          return;
        }
        accessToken = response.access_token;
        tokenExpiresAt = Date.now() + (response.expires_in || 3600) * 1000;

        fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
          headers: { Authorization: `Bearer ${accessToken}` },
        })
          .then((r) => r.json())
          .then((info) => {
            const user = {
              email: info.email,
              name: info.name || info.email,
              picture: info.picture,
            };
            persistSession(user);
            resolve({ accessToken, ...user });
          })
          .catch(() => {
            persistSession(null);
            resolve({ accessToken, email: '', name: '' });
          });
      },
      error_callback: (err) => {
        reject(new Error(err.message || 'Auth error'));
      },
    });

    tokenClient.requestAccessToken();
  });
}

/**
 * Devuelve el access token actual, renovándolo si es necesario.
 */
export async function getAccessToken() {
  if (accessToken && Date.now() < tokenExpiresAt - 60000) {
    return accessToken;
  }
  const result = await requestAccessToken();
  return result.accessToken;
}

/**
 * Revoca el token y cierra sesión.
 */
export function revokeToken() {
  if (accessToken) {
    window.google?.accounts?.oauth2?.revoke(accessToken);
    accessToken = null;
    tokenExpiresAt = 0;
  }
  localStorage.removeItem(STORAGE_KEY);
}

/**
 * Verifica si hay un token válido.
 */
export function hasValidToken() {
  return !!accessToken && Date.now() < tokenExpiresAt;
}
