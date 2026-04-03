import { useState, useRef, useEffect, useCallback } from 'react';
import { useCamera } from '../hooks/useCamera';
import { useUploadQueue } from '../hooks/useUploadQueue';
import { createPhoto } from '../domain/Photo';
import { getProject } from '../config/projects';
import AspectPicker from '../components/AspectPicker';
import ShutterButton from '../components/ShutterButton';
import UploadQueueSheet from '../components/UploadQueueSheet';
import Footer from '../components/Footer';
import { colors, font, radius, globalStyles } from '../styles/theme';

const ASPECTS = ['4:3', '16:9', '1:1', 'full'];

export default function CameraScreen({
  project, queue, sessionCount, addToQueue, updateQueueItem, onClose,
}) {
  const videoRef = useRef(null);
  const camera = useCamera();
  const { enqueueUpload } = useUploadQueue({ updateQueueItem });

  const [aspect, setAspect] = useState('4:3');
  const [flashAnim, setFlashAnim] = useState(false);
  const [lastThumb, setLastThumb] = useState(null);
  const [showQueue, setShowQueue] = useState(false);

  const projectInfo = getProject(project);
  const uploadingCount = queue.filter((q) => q.status === 'uploading').length;
  const doneCount = queue.filter((q) => q.status === 'done').length;

  useEffect(() => {
    if (videoRef.current) {
      camera.start(videoRef.current);
    }
    return () => camera.stop();
  }, []);

  const handleCapture = useCallback(async () => {
    if (!camera.isReady) return;

    const blob = await camera.capture(aspect);
    if (!blob) return;

    setFlashAnim(true);
    setTimeout(() => setFlashAnim(false), 150);

    const num = sessionCount + 1;
    const photo = createPhoto({ blob, projectId: project, sessionNumber: num });

    setLastThumb(photo.thumbUrl);
    addToQueue({
      id: photo.id,
      projectId: photo.projectId,
      name: photo.fileName,
      size: photo.sizeLabel,
      thumb: photo.thumbUrl,
      status: 'pending',
      progress: 0,
    });

    enqueueUpload(photo);
  }, [camera, aspect, project, sessionCount, addToQueue, enqueueUpload]);

  return (
    <div style={styles.fullscreen}>
      <style>{globalStyles}</style>

      <video ref={videoRef} playsInline muted autoPlay style={styles.video} />

      {/* Aspect ratio crop overlay */}
      {aspect !== 'full' && (
        <div style={styles.cropOverlay}>
          <div style={styles.cropLetterbox} />
          <div style={{
            ...styles.cropCenter,
            aspectRatio: aspect === '4:3' ? '3/4' : aspect === '16:9' ? '9/16' : '1/1',
          }} />
          <div style={styles.cropLetterbox} />
        </div>
      )}

      {flashAnim && <div style={styles.flash} />}

      {/* Top bar */}
      <div style={styles.topBar}>
        <button onClick={onClose} style={styles.closeBtn}>✕</button>
        <div style={styles.projectBadge}>
          {projectInfo?.icon} {projectInfo?.name}
        </div>
        {(sessionCount) > 0 && (
          <div style={styles.countBadge}>{sessionCount}</div>
        )}
      </div>

      <AspectPicker aspects={ASPECTS} selected={aspect} onChange={setAspect} />

      {/* Bottom controls */}
      <div style={styles.bottomBar}>
        <div style={styles.thumbSlot}>
          {lastThumb && (
            <div onClick={() => setShowQueue(true)} style={styles.lastThumb}>
              <img src={lastThumb} alt="" style={styles.thumbImg} />
              {uploadingCount > 0 && (
                <div style={styles.thumbBadge}>{uploadingCount}</div>
              )}
            </div>
          )}
        </div>

        <ShutterButton onPress={handleCapture} disabled={!camera.isReady} />

        <div style={styles.statusSlot}>
          {queue.length > 0 && (
            <div style={styles.miniStatus}>
              <span style={{ color: uploadingCount > 0 ? colors.accent : colors.success, fontSize: 11, fontWeight: 600 }}>
                {uploadingCount > 0 ? `⬆${uploadingCount}` : '✓'}
              </span>
              <span style={{ color: colors.textMuted, fontSize: 10 }}>
                {doneCount}/{queue.length}
              </span>
            </div>
          )}
        </div>
      </div>

      {showQueue && <UploadQueueSheet queue={queue} onClose={() => setShowQueue(false)} />}

      {camera.error && (
        <div style={styles.errorOverlay}>
          <p style={styles.errorText}>{camera.error}</p>
          <button onClick={onClose} style={styles.errorBtn}>Volver</button>
        </div>
      )}

      {!camera.isReady && !camera.error && (
        <div style={styles.loadingOverlay}>
          <div style={styles.spinner} />
          <p style={{ color: colors.textMuted, fontSize: 13 }}>Iniciando cámara...</p>
        </div>
      )}
      <Footer styleContent={{ position: 'absolute', bottom: 0, padding: '8px 16px', zIndex: 30 }} />
    </div>
  );
}

const styles = {
  fullscreen: {
    position: 'fixed', inset: 0, background: '#000', zIndex: 100,
    display: 'flex', flexDirection: 'column', overflow: 'hidden',
    fontFamily: font.family,
  },
  video: { position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' },
  cropOverlay: {
    position: 'absolute', inset: 0, zIndex: 5,
    display: 'flex', flexDirection: 'column', pointerEvents: 'none',
  },
  cropLetterbox: {
    flex: 1, background: 'rgba(0,0,0,0.5)',
  },
  cropCenter: {
    width: '100%', flexShrink: 0,
    boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.3)',
  },
  flash: {
    position: 'absolute', inset: 0, background: 'white', zIndex: 10,
    animation: 'flashFade 0.15s ease forwards', pointerEvents: 'none',
  },
  topBar: {
    position: 'absolute', top: 0, left: 0, right: 0, zIndex: 20,
    display: 'flex', alignItems: 'center', gap: 10,
    padding: 'max(52px, calc(env(safe-area-inset-top, 0px) + 12px)) 16px 12px',
    background: 'linear-gradient(to bottom, rgba(0,0,0,0.6), transparent)',
  },
  closeBtn: {
    width: 36, height: 36, borderRadius: '50%',
    background: 'rgba(255,255,255,0.15)', border: 'none',
    color: 'white', fontSize: 18, cursor: 'pointer',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    backdropFilter: 'blur(8px)',
  },
  projectBadge: {
    flex: 1, fontSize: 13, color: 'white', fontWeight: 500,
    background: 'rgba(255,255,255,0.1)', padding: '6px 12px',
    borderRadius: radius.md, backdropFilter: 'blur(8px)', textAlign: 'center',
  },
  countBadge: {
    minWidth: 28, height: 28, borderRadius: 14,
    background: colors.accent, color: 'white',
    fontSize: 13, fontWeight: 700,
    display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 8px',
  },
  bottomBar: {
    position: 'absolute', bottom: 0, left: 0, right: 0, zIndex: 20,
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '16px 32px 48px',
    background: 'linear-gradient(to top, rgba(0,0,0,0.7), transparent)',
  },
  thumbSlot: { width: 56 },
  lastThumb: {
    width: 52, height: 52, borderRadius: 10, overflow: 'hidden',
    border: '2px solid rgba(255,255,255,0.3)', position: 'relative',
    cursor: 'pointer', animation: 'popIn 0.2s ease',
  },
  thumbImg: { width: '100%', height: '100%', objectFit: 'cover', display: 'block' },
  thumbBadge: {
    position: 'absolute', top: -6, right: -6,
    minWidth: 18, height: 18, borderRadius: 9,
    background: colors.accent, color: 'white',
    fontSize: 10, fontWeight: 700,
    display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 4px',
  },
  statusSlot: { width: 56, display: 'flex', justifyContent: 'flex-end' },
  miniStatus: {
    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
    background: 'rgba(0,0,0,0.4)', padding: '6px 10px', borderRadius: radius.md,
    backdropFilter: 'blur(4px)',
  },
  errorOverlay: {
    position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.9)',
    display: 'flex', flexDirection: 'column', alignItems: 'center',
    justifyContent: 'center', zIndex: 40, color: colors.text, gap: 16,
  },
  errorText: { fontSize: 14, textAlign: 'center', padding: 24, margin: 0 },
  errorBtn: {
    padding: '12px 24px', borderRadius: radius.md, background: colors.accent,
    border: 'none', color: 'white', fontSize: 14, fontWeight: 600, cursor: 'pointer',
  },
  loadingOverlay: {
    position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.8)',
    display: 'flex', flexDirection: 'column', alignItems: 'center',
    justifyContent: 'center', zIndex: 30, gap: 16,
  },
  spinner: {
    width: 36, height: 36, border: '3px solid rgba(255,255,255,0.2)',
    borderTopColor: colors.accent, borderRadius: '50%',
    animation: 'spin 0.8s linear infinite',
  },
};
