import { useState, useEffect } from 'react';
import { getProject } from '../config/projects';
import { getProjectFolderId, listFiles } from '../infrastructure/GoogleDrive';
import { getAccessToken } from '../infrastructure/GoogleAuth';
import { colors, font, radius, globalStyles } from '../styles/theme';

export default function GalleryScreen({ project, onClose }) {
  const [photos, setPhotos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selected, setSelected] = useState(null);
  const [copied, setCopied] = useState(false);

  const projectInfo = getProject(project);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const folderId = await getProjectFolderId(projectInfo.name);
        const files = await listFiles(folderId);
        if (!cancelled) setPhotos(files);
      } catch (err) {
        if (!cancelled) setError(err.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [project]);

  const handleShare = async (photo) => {
    const shareUrl = photo.webViewLink || `https://drive.google.com/file/d/${photo.id}/view`;
    if (navigator.share) {
      try {
        await navigator.share({ title: photo.name, url: shareUrl });
      } catch { /* user cancelled */ }
    } else {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const getThumbnailUrl = (photo) => {
    if (photo.thumbnailLink) {
      return photo.thumbnailLink.replace(/=s\d+/, '=s400');
    }
    return `https://drive.google.com/thumbnail?id=${photo.id}&sz=w400`;
  };

  const getFullUrl = (photo) => {
    return `https://drive.google.com/thumbnail?id=${photo.id}&sz=w1200`;
  };

  return (
    <div style={styles.container}>
      <style>{globalStyles}</style>

      {/* Header */}
      <div style={styles.header}>
        <button onClick={onClose} style={styles.backBtn}>← Volver</button>
        <span style={styles.headerTitle}>{projectInfo?.icon} {projectInfo?.name}</span>
        <span style={styles.count}>{photos.length} fotos</span>
      </div>

      {/* Content */}
      {loading && (
        <div style={styles.center}>
          <div style={styles.spinner} />
          <p style={{ color: colors.textMuted, fontSize: 13 }}>Cargando fotos...</p>
        </div>
      )}

      {error && (
        <div style={styles.center}>
          <p style={{ color: colors.error, fontSize: 13 }}>{error}</p>
        </div>
      )}

      {!loading && !error && photos.length === 0 && (
        <div style={styles.center}>
          <p style={{ color: colors.textDim, fontSize: 14 }}>Sin fotos en este proyecto</p>
          <p style={{ color: colors.textDim, fontSize: 12 }}>Toma fotos desde la camara para verlas aqui</p>
        </div>
      )}

      {!loading && !error && photos.length > 0 && (
        <div style={styles.grid}>
          {photos.map((photo) => (
            <div key={photo.id} onClick={() => setSelected(photo)} style={styles.gridItem}>
              <img src={getThumbnailUrl(photo)} alt={photo.name} style={styles.gridImg} loading="lazy" />
            </div>
          ))}
        </div>
      )}

      {/* Fullscreen viewer */}
      {selected && (
        <div style={styles.viewer} onClick={() => setSelected(null)}>
          <div style={styles.viewerHeader}>
            <button onClick={() => setSelected(null)} style={styles.viewerClose}>✕</button>
            <span style={styles.viewerName}>{selected.name}</span>
            <button
              onClick={(e) => { e.stopPropagation(); handleShare(selected); }}
              style={styles.shareBtn}
            >
              {copied ? '✓ Copiado' : 'Compartir'}
            </button>
          </div>
          <div style={styles.viewerBody} onClick={(e) => e.stopPropagation()}>
            <img src={getFullUrl(selected)} alt={selected.name} style={styles.viewerImg} />
          </div>
        </div>
      )}
    </div>
  );
}

const styles = {
  container: {
    fontFamily: font.family, background: colors.bg,
    minHeight: '100dvh', color: colors.text,
    maxWidth: 480, margin: '0 auto',
    display: 'flex', flexDirection: 'column',
  },
  header: {
    display: 'flex', alignItems: 'center', gap: 10,
    padding: '14px 16px', borderBottom: `1px solid ${colors.border}`,
    position: 'sticky', top: 0, background: colors.bg, zIndex: 10,
  },
  backBtn: {
    background: 'none', border: 'none', color: colors.accent,
    fontSize: font.base, cursor: 'pointer', fontFamily: font.family, padding: 0,
  },
  headerTitle: {
    flex: 1, fontSize: font.base, fontWeight: 600, color: colors.textWhite,
  },
  count: {
    fontSize: font.sm, color: colors.textMuted,
  },
  center: {
    flex: 1, display: 'flex', flexDirection: 'column',
    alignItems: 'center', justifyContent: 'center', gap: 12, padding: 32,
  },
  spinner: {
    width: 32, height: 32, border: '3px solid rgba(255,255,255,0.2)',
    borderTopColor: colors.accent, borderRadius: '50%',
    animation: 'spin 0.8s linear infinite',
  },
  grid: {
    display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 2,
    padding: 2,
  },
  gridItem: {
    aspectRatio: '1', overflow: 'hidden', cursor: 'pointer',
    background: colors.bgCard,
  },
  gridImg: {
    width: '100%', height: '100%', objectFit: 'cover', display: 'block',
  },
  viewer: {
    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.95)',
    zIndex: 100, display: 'flex', flexDirection: 'column',
  },
  viewerHeader: {
    display: 'flex', alignItems: 'center', gap: 10,
    padding: '14px 16px', zIndex: 10,
  },
  viewerClose: {
    background: 'none', border: 'none', color: 'white',
    fontSize: 20, cursor: 'pointer', padding: '4px 8px',
  },
  viewerName: {
    flex: 1, fontSize: font.sm, color: colors.textMuted,
    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
  },
  shareBtn: {
    padding: '8px 16px', borderRadius: radius.md, border: 'none',
    background: colors.accent, color: 'white',
    fontSize: font.sm, fontWeight: 600, cursor: 'pointer', fontFamily: font.family,
  },
  viewerBody: {
    flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
    padding: 16, overflow: 'auto',
  },
  viewerImg: {
    maxWidth: '100%', maxHeight: '100%', objectFit: 'contain', borderRadius: radius.md,
  },
};
