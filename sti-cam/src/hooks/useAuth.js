import { useState, useEffect, useCallback } from 'react';
import { initAuth, requestAccessToken, revokeToken, hasValidToken } from '../infrastructure/GoogleAuth';
import { GOOGLE_CLIENT_ID } from '../config/google';

/**
 * Hook de autenticación con Google.
 * Maneja login, logout, y estado del usuario.
 */
export function useAuth() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Verificar si el Client ID está configurado
  const isConfigured = !!GOOGLE_CLIENT_ID;

  useEffect(() => {
    if (!isConfigured) {
      setLoading(false);
      return;
    }
    initAuth()
      .then(() => setLoading(false))
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  }, [isConfigured]);

  const signIn = useCallback(async () => {
    if (!isConfigured) {
      // Modo demo sin Google configurado
      setUser({ email: 'demo@sticam.local', name: 'Modo Demo', picture: null });
      return;
    }

    setError(null);
    try {
      const result = await requestAccessToken();
      setUser({
        email: result.email,
        name: result.name,
        picture: result.picture,
      });
    } catch (err) {
      setError(err.message);
    }
  }, [isConfigured]);

  const signOut = useCallback(() => {
    revokeToken();
    setUser(null);
  }, []);

  return {
    user,
    loading,
    error,
    isConfigured,
    isAuthenticated: !!user,
    signIn,
    signOut,
  };
}
