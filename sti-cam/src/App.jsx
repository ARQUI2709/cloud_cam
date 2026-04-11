import { useState, useEffect, useCallback } from 'react';
import { useAuth } from './hooks/useAuth';
import { useUploadQueue } from './hooks/useUploadQueue';
import { CameraService } from './infrastructure/CameraService';
import { loadQueue } from './infrastructure/OfflineQueue';
import { hasValidToken, getAccessToken } from './infrastructure/GoogleAuth';
import AuthScreen from './screens/AuthScreen';
import HomeScreen from './screens/HomeScreen';
import CameraScreen from './screens/CameraScreen';
import { colors, font, radius } from './styles/theme';

export default function App() {
  const auth = useAuth();
  const [activeScreen, setActiveScreen] = useState('home'); // 'home' | 'camera'
  const [selectedProject, setSelectedProject] = useState(null);
  const [queue, setQueue] = useState([]);
  const [sessionCount, setSessionCount] = useState(0);
  const [offlineBanner, setOfflineBanner] = useState(null); // null | { count, needsAuth }

  const addToQueue = useCallback((item) => {
    setQueue((prev) => {
      // Avoid duplicates when retrying from IDB
      if (prev.some((q) => q.id === item.id)) return prev;
      return [item, ...prev];
    });
    setSessionCount((c) => c + 1);
  }, []);

  const updateQueueItem = useCallback((id, updates) => {
    setQueue((prev) =>
      prev.map((q) => (q.id === id ? { ...q, ...updates } : q))
    );
  }, []);

  const { retryOfflineQueue } = useUploadQueue({ updateQueueItem });

  /**
   * Check IDB for pending photos and decide what to show.
   * Called on mount (when online) and on every 'online' event.
   */
  const syncOfflineQueue = useCallback(async () => {
    if (!auth.isAuthenticated) return;
    let pending;
    try {
      pending = await loadQueue();
    } catch {
      return;
    }
    // Filter out items already in React state (already being processed)
    const inState = new Set(queue.map((q) => q.id));
    const fresh = pending.filter((p) => !inState.has(p.id));
    if (fresh.length === 0) return;

    const tokenValid = hasValidToken();
    if (tokenValid) {
      // Silent flush — upload immediately
      await retryOfflineQueue(fresh, addToQueue);
    } else {
      // Need re-auth — show banner
      setOfflineBanner({ count: fresh.length, needsAuth: true, items: fresh });
    }
  }, [auth.isAuthenticated, queue, retryOfflineQueue, addToQueue]);

  // On mount: if online, try to flush any IDB queue from a previous session
  useEffect(() => {
    if (navigator.onLine) syncOfflineQueue();
  }, [auth.isAuthenticated]); // re-run when user logs in

  // On reconnect: flush or show banner
  useEffect(() => {
    const handle = () => syncOfflineQueue();
    window.addEventListener('online', handle);
    return () => window.removeEventListener('online', handle);
  }, [syncOfflineQueue]);

  const handleReconnect = useCallback(async () => {
    if (!offlineBanner) return;
    try {
      await getAccessToken(false); // will prompt popup if expired
      await retryOfflineQueue(offlineBanner.items, addToQueue);
      setOfflineBanner(null);
    } catch {
      // User cancelled auth — keep banner
    }
  }, [offlineBanner, retryOfflineQueue, addToQueue]);

  if (!auth.isAuthenticated) {
    return <AuthScreen onSignIn={auth.signIn} />;
  }

  const screen = activeScreen === 'camera' && selectedProject
    ? (
      <CameraScreen
        project={selectedProject}
        queue={queue}
        sessionCount={sessionCount}
        addToQueue={addToQueue}
        updateQueueItem={updateQueueItem}
        onClose={() => setActiveScreen('home')}
      />
    )
    : (
      <HomeScreen
        user={auth.user}
        selectedProject={selectedProject}
        onSelectProject={setSelectedProject}
        queue={queue}
        sessionCount={sessionCount}
        onOpenCamera={() => setActiveScreen('camera')}
        onSignOut={() => { CameraService.release(); auth.signOut(); }}
      />
    );

  return (
    <>
      {screen}
      {offlineBanner && (
        <div style={styles.banner}>
          <span style={styles.bannerText}>
            {offlineBanner.count} foto{offlineBanner.count !== 1 ? 's' : ''} pendiente{offlineBanner.count !== 1 ? 's' : ''}
          </span>
          <button onClick={handleReconnect} style={styles.bannerBtn}>
            Sincronizar
          </button>
          <button onClick={() => setOfflineBanner(null)} style={styles.bannerDismiss}>✕</button>
        </div>
      )}
    </>
  );
}

const styles = {
  banner: {
    position: 'fixed', bottom: 72, left: 16, right: 16, zIndex: 200,
    background: '#2a2830', border: `1px solid ${colors.border}`,
    borderRadius: radius.md, padding: '12px 16px',
    display: 'flex', alignItems: 'center', gap: 10,
    boxShadow: '0 4px 20px rgba(0,0,0,0.5)',
  },
  bannerText: {
    flex: 1, fontSize: font.sm, color: colors.text, fontFamily: font.family,
  },
  bannerBtn: {
    padding: '6px 14px', borderRadius: radius.sm,
    background: colors.accent, border: 'none',
    color: 'white', fontSize: font.sm, fontWeight: 600, cursor: 'pointer',
    fontFamily: font.family,
  },
  bannerDismiss: {
    background: 'none', border: 'none', color: colors.textMuted,
    fontSize: 16, cursor: 'pointer', padding: '0 4px', lineHeight: 1,
  },
};
