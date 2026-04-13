/**
 * Infraestructura: Google OAuth 2.0
 * Usa Google Identity Services (GIS) Token Model.
 *
 * El script de GIS se carga dinámicamente.
 * Token y user info persisten en localStorage.
 *
 * v2: Improved PWA resilience — retries silent renewal once after 1s delay,
 *     exposes silentRenewalFailed flag for callers.
 */

import { GOOGLE_CLIENT_ID, GOOGLE_SCOPES } from '../config/google.js';

const STORAGE_KEY = 'sti-cam-auth';

let tokenClient = null;
let accessToken = null;
let tokenExpiresAt = 0;

/**
 * Module-level flag — set to true when prompt:'none' renewal fails in PWA mode.
 * Callers (like syncOfflineQueue) can check this to know they need to show a
 * manual re-auth UI.
 */
export let silentRenewalFailed = false;

// Restore from localStorage on load
try {
  const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
  if (saved && saved.token && saved.expiresAt > Date.now() && saved.grantedScopes === GOOGLE_SCOPES) {
    accessToken = saved.token;
    tokenExpiresAt = saved.expiresAt;
  }
} catch {}

function persistSession(user) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({
    token: accessToken,
    expiresAt: tokenExpiresAt,
    grantedScopes: GOOGLE_SCOPES,
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
    // Also return user if session exists but token expired (offline resume)
    if (saved && saved.user) {
      return saved.user;
    }
  } catch {}
  return null;
}

/**
 * Returns true when running as an installed PWA (standalone display mode).
 * In this context Google popups are blocked — token renewal must be silent.
 */
function isPWA() {
  return window.matchMedia('(display-mode: standalone)').matches
    || window.navigator.standalone === true; // iOS Safari
}

/**
 * Solicita token de acceso al usuario.
 * @param {boolean} forceConsent - Si true, fuerza pantalla de consentimiento
 *
 * In PWA mode, always uses prompt:'' (no UI) so GIS renews silently using the
 * browser's existing Google session cookie — no popup needed.
 * Falls back to showing a UI prompt only in regular browser tabs.
 */
export function requestAccessToken(forceConsent = false) {
  return new Promise((resolve, reject) => {
    // In PWA, never show consent/account-picker UI — silent renewal only
    const prompt = (isPWA() && !forceConsent) ? 'none' : (forceConsent ? 'consent' : '');

    tokenClient = window.google.accounts.oauth2.initTokenClient({
      client_id: GOOGLE_CLIENT_ID,
      scope: GOOGLE_SCOPES,
      prompt,
      callback: (response) => {
        if (response.error) {
          reject(new Error(response.error_description || response.error));
          return;
        }
        // Silent renewal succeeded — clear the failure flag
        silentRenewalFailed = false;
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
 * In PWA mode, attempts silent renewal first — never opens a popup mid-upload.
 * If prompt:'none' fails, retries once after 1s (GIS iframe may not be ready yet).
 */
export async function getAccessToken(forceConsent = false) {
  if (!forceConsent && accessToken && Date.now() < tokenExpiresAt - 60000) {
    return accessToken;
  }

  console.log('[auth] token expired or missing — attempting renewal', {
    isPWA: isPWA(),
    forceConsent,
  });

  try {
    const result = await requestAccessToken(forceConsent);
    console.log('[auth] token renewal succeeded');
    return result.accessToken;
  } catch (firstErr) {
    // In PWA mode with silent renewal, retry once after 1s
    // GIS iframe sometimes isn't ready immediately after coming online
    if (isPWA() && !forceConsent) {
      console.log('[auth] silent renewal failed, retrying in 1s...', firstErr.message);
      await new Promise((r) => setTimeout(r, 1000));
      try {
        const result = await requestAccessToken(false);
        console.log('[auth] retry succeeded');
        return result.accessToken;
      } catch (retryErr) {
        console.warn('[auth] silent renewal failed after retry:', retryErr.message);
        silentRenewalFailed = true;
        throw retryErr;
      }
    }
    throw firstErr;
  }
}

/**
 * Invalida el token en memoria y en localStorage, forzando re-auth en la próxima llamada.
 * Útil cuando una API retorna 401/403 por scopes insuficientes.
 */
export function clearToken() {
  accessToken = null;
  tokenExpiresAt = 0;
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (saved) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...saved, token: null, expiresAt: 0 }));
    }
  } catch {}
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
