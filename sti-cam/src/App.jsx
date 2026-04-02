import { useState } from 'react';
import { useAuth } from './hooks/useAuth';
import AuthScreen from './screens/AuthScreen';
import HomeScreen from './screens/HomeScreen';
import CameraScreen from './screens/CameraScreen';
import GalleryScreen from './screens/GalleryScreen';

export default function App() {
  const auth = useAuth();
  const [activeScreen, setActiveScreen] = useState('home'); // 'home' | 'camera' | 'gallery'
  const [selectedProject, setSelectedProject] = useState(null);
  const [queue, setQueue] = useState([]);
  const [sessionCount, setSessionCount] = useState(0);

  const addToQueue = (item) => {
    setQueue((prev) => [item, ...prev]);
    setSessionCount((c) => c + 1);
  };

  const updateQueueItem = (id, updates) => {
    setQueue((prev) =>
      prev.map((q) => (q.id === id ? { ...q, ...updates } : q))
    );
  };

  if (!auth.isAuthenticated) {
    return <AuthScreen onSignIn={auth.signIn} />;
  }

  if (activeScreen === 'gallery' && selectedProject) {
    return (
      <GalleryScreen
        project={selectedProject}
        onClose={() => setActiveScreen('home')}
      />
    );
  }

  if (activeScreen === 'camera' && selectedProject) {
    return (
      <CameraScreen
        project={selectedProject}
        queue={queue}
        sessionCount={sessionCount}
        addToQueue={addToQueue}
        updateQueueItem={updateQueueItem}
        onClose={() => setActiveScreen('home')}
      />
    );
  }

  return (
    <HomeScreen
      user={auth.user}
      selectedProject={selectedProject}
      onSelectProject={setSelectedProject}
      queue={queue}
      sessionCount={sessionCount}
      onOpenCamera={() => setActiveScreen('camera')}
      onOpenGallery={() => setActiveScreen('gallery')}
      onSignOut={auth.signOut}
    />
  );
}
