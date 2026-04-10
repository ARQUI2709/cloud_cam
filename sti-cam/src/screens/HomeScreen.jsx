import { useState, useEffect, useRef, useCallback } from 'react';
import { colors, font, spacing, radius, globalStyles } from '../styles/theme';
import { getProject as getProjectById } from '../config/projects';
import { getProjectFolderId, listFiles, deleteFile } from '../infrastructure/GoogleDrive';
import { GOOGLE_CLIENT_ID } from '../config/google';
import { getAccessToken } from '../infrastructure/GoogleAuth';
import ProjectSelector from '../components/ProjectSelector';
import UploadStatusBar from '../components/UploadStatusBar';
import Footer from '../components/Footer';
import cameraImg from '../assets/camera.png';
import shareImg from '../assets/share.png';
import infoImg from '../assets/info.png';
import deleteImg from '../assets/delete.png';
import logoutImg from '../assets/logout.png';

const CamIconSmall = () => (
  <img src={cameraImg} alt="STI Cam" style={{ width: 36, height: 36, objectFit: 'contain' }} />
);

const CamIconLarge = () => (
  <svg width="40" height="40" viewBox="0 0 48 48" fill="none">
    <rect x="4" y="14" width="40" height="28" rx="3" stroke="white" strokeWidth="2.5" fill="none"/>
    <circle cx="24" cy="28" r="8" stroke="white" strokeWidth="2.5" fill="none"/>
    <circle cx="24" cy="28" r="3" fill="white"/>
    <rect x="14" y="8" width="20" height="6" rx="2" stroke="white" strokeWidth="2" fill="none"/>
  </svg>
);

function groupByDate(photos) {
  const groups = {};
  for (const photo of photos) {
    const date = photo.createdTime
      ? new Date(photo.createdTime).toLocaleDateString('es-CO', {
          weekday: 'short', day: 'numeric', month: 'short', year: 'numeric',
        })
      : 'Sin fecha';
    if (!groups[date]) groups[date] = [];
    groups[date].push(photo);
  }
  return Object.entries(groups);
}

export default function HomeScreen({
  user, selectedProject, onSelectProject,
  queue, sessionCount, onOpenCamera, onSignOut,
}) {
  const project = selectedProject ? getProjectById(selectedProject) : null;
  const uploadingCount = queue.filter((q) => q.status === 'uploading').length;
  const doneCount = queue.filter((q) => q.status === 'done').length;

  const [photos, setPhotos] = useState([]);
  const [loadingPhotos, setLoadingPhotos] = useState(false);
  const [refreshTick, setRefreshTick] = useState(0);
  const [viewerIndex, setViewerIndex] = useState(null);
  const [copied, setCopied] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmDeletePhoto, setConfirmDeletePhoto] = useState(false);
  const [showInfo, setShowInfo] = useState(false);
  const touchStartX = useRef(0);
  const touchDelta = useRef(0);
  const thumbStripRef = useRef(null);

  useEffect(() => {
    if (!selectedProject || !project || !GOOGLE_CLIENT_ID) {
      setPhotos([]);
      return;
    }
    let cancelled = false;
    setLoadingPhotos(true);
    getProjectFolderId(project.name)
      .then((folderId) => listFiles(folderId))
      .then((files) => { if (!cancelled) setPhotos(files); })
      .catch(() => { if (!cancelled) setPhotos([]); })
      .finally(() => { if (!cancelled) setLoadingPhotos(false); });
    return () => { cancelled = true; };
  }, [selectedProject, refreshTick]);

  const getThumbnailUrl = (photo) => {
    if (photo.thumbnailLink) return photo.thumbnailLink.replace(/=s\d+/, '=s400');
    return `https://drive.google.com/thumbnail?id=${photo.id}&sz=w400`;
  };

  const getFullUrl = (photo) => {
    if (photo.thumbnailLink) return photo.thumbnailLink.replace(/=s\d+/, '=s1200');
    return `https://drive.google.com/thumbnail?id=${photo.id}&sz=w1200`;
  };

  const handleShare = async (photo) => {
    setSharing(true);
    try {
      // Download actual file from Drive API
      const token = await getAccessToken();
      const res = await fetch(
        `https://www.googleapis.com/drive/v3/files/${photo.id}?alt=media`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const blob = await res.blob();
      const file = new File([blob], 'foto.jpg', { type: 'image/jpeg' });

      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file] });
      } else if (navigator.share) {
        // Fallback: share link if file sharing not supported
        const shareUrl = photo.webViewLink || `https://drive.google.com/file/d/${photo.id}/view`;
        await navigator.share({ url: shareUrl });
      } else {
        const shareUrl = photo.webViewLink || `https://drive.google.com/file/d/${photo.id}/view`;
        await navigator.clipboard.writeText(shareUrl);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }
    } catch { /* user cancelled or error */ }
    setSharing(false);
  };

  const handleDeletePhoto = async (photo) => {
    setDeleting(true);
    try {
      await deleteFile(photo.id);
      setPhotos((prev) => prev.filter((p) => p.id !== photo.id));
      // Adjust viewer index
      if (viewerIndex >= photos.length - 1) {
        setViewerIndex(photos.length > 1 ? photos.length - 2 : null);
      }
      setConfirmDeletePhoto(false);
    } catch (e) {
      console.error('[gallery] delete failed:', e);
    }
    setDeleting(false);
  };

  const handleTouchStart = useCallback((e) => {
    touchStartX.current = e.touches[0].clientX;
    touchDelta.current = 0;
  }, []);

  const handleTouchMove = useCallback((e) => {
    touchDelta.current = e.touches[0].clientX - touchStartX.current;
  }, []);

  const handleTouchEnd = useCallback(() => {
    const threshold = 60;
    if (touchDelta.current > threshold && viewerIndex > 0) {
      setViewerIndex(viewerIndex - 1);
    } else if (touchDelta.current < -threshold && viewerIndex < photos.length - 1) {
      setViewerIndex(viewerIndex + 1);
    }
    touchDelta.current = 0;
  }, [viewerIndex, photos.length]);

  // Scroll thumbnail strip to keep active thumb visible
  useEffect(() => {
    if (viewerIndex === null || !thumbStripRef.current) return;
    const strip = thumbStripRef.current;
    const thumb = strip.children[viewerIndex];
    if (thumb) {
      thumb.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
    }
  }, [viewerIndex]);

  const dateGroups = groupByDate(photos);

  return (
    <div style={styles.container}>
      <style>{globalStyles}</style>

      {/* Header */}
      <div style={styles.header}>
        <div style={styles.headerLeft}>
          <CamIconSmall />
          <span style={styles.headerTitle}>STI Cam</span>
        </div>
        <div style={styles.headerRight}>
          {uploadingCount > 0 && (
            <span style={styles.countBadge}>{uploadingCount}</span>
          )}
          <div style={styles.driveBadge}>
            <span style={{ ...styles.driveDot, background: (user && GOOGLE_CLIENT_ID) ? colors.success : colors.error }} />
            Drive
          </div>
          <button onClick={() => setShowLogoutConfirm(true)} style={styles.logoutBtn} title="Cerrar sesión">
            <img src={logoutImg} alt="Logout" style={{ width: 20, height: 20, objectFit: 'contain', opacity: 0.8 }} />
          </button>
        </div>
      </div>

      {/* Project Selector */}
      <div style={styles.section}>
        <label style={styles.label}>PROYECTO ACTIVO</label>
        <ProjectSelector
          selected={selectedProject}
          onSelect={onSelectProject}
        />
      </div>

      {/* Camera Button */}
      <div style={styles.cameraSection}>
        <button
          onClick={onOpenCamera}
          disabled={!selectedProject}
          style={{
            ...styles.cameraBtn,
            ...(selectedProject ? {} : styles.cameraBtnOff),
          }}
        >
          <CamIconLarge />
        </button>
        <p style={styles.cameraLabel}>
          {!selectedProject
            ? 'Selecciona un proyecto primero'
            : sessionCount === 0
            ? 'Abrir camara'
            : 'Continuar captura'}
        </p>
        {project && (
          <p style={styles.cameraDest}>STI-Fotos / {project.name}</p>
        )}
      </div>

      {/* Upload Status */}
      {queue.length > 0 && (
        <UploadStatusBar
          queue={queue}
          uploadingCount={uploadingCount}
          doneCount={doneCount}
        />
      )}

      {/* Inline Gallery */}
      {selectedProject && (
        <div style={styles.gallerySection}>
          <div style={styles.gallerySectionHeader}>
            <label style={styles.label}>FOTOS DEL PROYECTO</label>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              {photos.length > 0 && (
                <span style={styles.photoCount}>{photos.length} fotos</span>
              )}
              <button
                onClick={() => setRefreshTick((t) => t + 1)}
                disabled={loadingPhotos}
                style={styles.refreshBtn}
                title="Actualizar galería"
              >
                {loadingPhotos ? '...' : '↻'}
              </button>
            </div>
          </div>

          {loadingPhotos && (
            <div style={styles.galleryLoading}>
              <div style={styles.spinner} />
            </div>
          )}

          {!loadingPhotos && photos.length === 0 && (
            <p style={styles.galleryEmpty}>Sin fotos aun. Toma la primera.</p>
          )}

          {!loadingPhotos && dateGroups.map(([date, groupPhotos]) => (
            <div key={date}>
              <div style={styles.dateHeader}>{date}</div>
              <div style={styles.grid}>
                {groupPhotos.map((photo) => {
                  const idx = photos.indexOf(photo);
                  return (
                    <div key={photo.id} onClick={() => setViewerIndex(idx)} style={styles.gridItem}>
                      <img src={getThumbnailUrl(photo)} alt="" style={styles.gridImg} loading="lazy" referrerPolicy="no-referrer" />
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Photo Viewer Overlay */}
      {viewerIndex !== null && photos[viewerIndex] && (
        <div style={styles.viewer}>
          {/* Header estilo iPhone */}
          <div style={styles.viewerHeader}>
            <button onClick={() => { setViewerIndex(null); setConfirmDeletePhoto(false); }} style={styles.viewerBack}>
              ‹
            </button>
            <div style={styles.viewerHeaderCenter}>
              <span style={styles.viewerTitle}>
                {new Date(photos[viewerIndex].createdTime).toLocaleDateString('es-CO', {
                  weekday: 'long', day: 'numeric', month: 'long',
                })}
              </span>
              <span style={styles.viewerSubtitle}>
                {new Date(photos[viewerIndex].createdTime).toLocaleTimeString('es-CO', {
                  hour: '2-digit', minute: '2-digit',
                })}
              </span>
            </div>
            <div style={{ width: 36 }} />
          </div>

          {/* Foto principal con swipe */}
          <div
            style={styles.viewerBody}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
          >
            <img
              key={photos[viewerIndex].id}
              src={getFullUrl(photos[viewerIndex])}
              alt={photos[viewerIndex].name}
              style={styles.viewerImg}
              referrerPolicy="no-referrer"
            />
          </div>

          {/* Tira de thumbnails */}
          <div style={styles.thumbStrip} ref={thumbStripRef}>
            {photos.map((photo, idx) => (
              <div
                key={photo.id}
                onClick={() => setViewerIndex(idx)}
                style={{
                  ...styles.thumbItem,
                  ...(idx === viewerIndex ? styles.thumbItemActive : {}),
                }}
              >
                <img
                  src={getThumbnailUrl(photo)}
                  alt=""
                  style={styles.thumbItemImg}
                  referrerPolicy="no-referrer"
                  loading="lazy"
                />
              </div>
            ))}
          </div>

          {/* Footer con acciones */}
          <div style={styles.viewerFooter}>
            <button onClick={() => handleShare(photos[viewerIndex])} style={styles.actionBtn} title="Compartir">
              <img src={shareImg} alt="Compartir" style={{ ...styles.actionIcon, opacity: (sharing || copied) ? 0.4 : 0.8 }} />
            </button>
            <button onClick={() => setShowInfo(true)} style={styles.actionBtn} title="Informacion">
              <img src={infoImg} alt="Info" style={styles.actionIcon} />
            </button>
            <button onClick={() => setConfirmDeletePhoto(true)} style={styles.actionBtn} title="Eliminar">
              <img src={deleteImg} alt="Eliminar" style={styles.actionIcon} />
            </button>
          </div>

          {/* Info panel */}
          {showInfo && photos[viewerIndex] && (() => {
            const p = photos[viewerIndex];
            const m = p.imageMediaMetadata || {};
            const pr = p.properties || {};
            const loc = m.location ||
              (pr.lat && pr.lng
                ? { latitude: parseFloat(pr.lat), longitude: parseFloat(pr.lng) }
                : null);
            const sizeKB = p.size ? (p.size / 1024).toFixed(0) : null;
            const sizeMB = p.size && p.size > 1024 * 1024 ? (p.size / 1024 / 1024).toFixed(1) + ' MB' : sizeKB ? sizeKB + ' KB' : null;
            // Prefer EXIF values, fall back to captured properties
            const device   = m.cameraMake ? `${m.cameraMake} ${m.cameraModel || ''}`.trim() : pr.device;
            const lens     = m.lens || pr.lens;
            const width    = m.width  || (pr.width  ? parseInt(pr.width)  : null);
            const height   = m.height || (pr.height ? parseInt(pr.height) : null);
            const iso      = m.isoSpeed;
            const focal    = m.focalLength;
            const aperture = m.aperture;
            const shutter  = m.exposureTime;
            const rows = [
              device                   && { label: 'Cámara',     value: device },
              lens                     && { label: 'Lente',      value: lens },
              (width && height)        && { label: 'Resolución', value: `${width} × ${height}` },
              sizeMB                   && { label: 'Tamaño',     value: sizeMB },
              iso                      && { label: 'ISO',        value: iso },
              focal                    && { label: 'Focal',      value: `${focal} mm` },
              aperture                 && { label: 'Apertura',   value: `ƒ${aperture}` },
              shutter                  && { label: 'Obturador',  value: `1/${Math.round(1 / shutter)} s` },
            ].filter(Boolean);

            return (
              <div style={styles.infoOverlay} onClick={() => setShowInfo(false)}>
                <div style={styles.infoSheet} onClick={(e) => e.stopPropagation()}>
                  <div style={styles.infoHandle} />

                  {/* Date & filename */}
                  <p style={styles.infoDate}>
                    {new Date(p.createdTime).toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                    {' · '}
                    {new Date(p.createdTime).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })}
                  </p>
                  <p style={styles.infoFilename}>{p.name}</p>

                  {/* EXIF table */}
                  {rows.length > 0 && (
                    <div style={styles.infoCard}>
                      {rows.map(({ label, value }, i) => (
                        <div key={label} style={{ ...styles.infoRow, ...(i < rows.length - 1 ? styles.infoRowBorder : {}) }}>
                          <span style={styles.infoLabel}>{label}</span>
                          <span style={styles.infoValue}>{value}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Map */}
                  {loc && (
                    <div style={styles.infoCard}>
                      <iframe
                        title="location"
                        width="100%"
                        height="180"
                        style={{ display: 'block', borderRadius: radius.lg, border: 'none' }}
                        src={`https://www.openstreetmap.org/export/embed.html?bbox=${loc.longitude - 0.003},${loc.latitude - 0.003},${loc.longitude + 0.003},${loc.latitude + 0.003}&layer=mapnik&marker=${loc.latitude},${loc.longitude}`}
                      />
                      <div style={styles.infoMapCoords}>
                        <span>📍</span>
                        <span>{loc.latitude.toFixed(6)}, {loc.longitude.toFixed(6)}</span>
                        <a
                          href={`https://maps.google.com/?q=${loc.latitude},${loc.longitude}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={styles.infoMapLink}
                        >
                          Abrir en Maps
                        </a>
                      </div>
                    </div>
                  )}

                  <button onClick={() => setShowInfo(false)} style={styles.infoCloseBtn}>Cerrar</button>
                </div>
              </div>
            );
          })()}

          {/* Delete confirmation */}
          {confirmDeletePhoto && (
            <div style={styles.deleteOverlay}>
              <div style={styles.logoutDialog}>
                <p style={styles.logoutText}>Eliminar foto?</p>
                <p style={styles.logoutSubtext}>Se eliminara de Google Drive</p>
                <div style={styles.logoutActions}>
                  <button onClick={() => setConfirmDeletePhoto(false)} style={styles.logoutCancel}>Cancelar</button>
                  <button
                    onClick={() => handleDeletePhoto(photos[viewerIndex])}
                    disabled={deleting}
                    style={styles.logoutConfirm}
                  >
                    {deleting ? '...' : 'Eliminar'}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
      {/* Logout confirmation */}
      {showLogoutConfirm && (
        <div style={styles.logoutOverlay}>
          <div style={styles.logoutDialog}>
            <p style={styles.logoutText}>Cerrar sesion?</p>
            <p style={styles.logoutSubtext}>{user?.email}</p>
            <div style={styles.logoutActions}>
              <button onClick={() => setShowLogoutConfirm(false)} style={styles.logoutCancel}>Cancelar</button>
              <button onClick={() => { setShowLogoutConfirm(false); onSignOut(); }} style={styles.logoutConfirm}>Salir</button>
            </div>
          </div>
        </div>
      )}

      <Footer />
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
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    padding: `${spacing.lg - 2}px ${spacing.xl}px`,
    paddingTop: `max(${spacing.lg - 2}px, env(safe-area-inset-top, 0px))`,
    borderBottom: `1px solid ${colors.border}`,
    position: 'sticky', top: 0, background: colors.bg, zIndex: 10,
  },
  headerLeft: { display: 'flex', alignItems: 'center', gap: spacing.sm },
  headerTitle: { fontSize: font.xl, fontWeight: 700, color: colors.textWhite },
  headerRight: { display: 'flex', alignItems: 'center', gap: spacing.sm },
  countBadge: {
    fontSize: font.sm, color: colors.textWhite, background: colors.accent,
    padding: '2px 8px', borderRadius: radius.xl, fontWeight: 600,
  },
  driveBadge: {
    display: 'flex', alignItems: 'center', gap: 6, fontSize: font.sm,
    color: colors.textMuted, background: colors.successBg,
    padding: '4px 10px', borderRadius: radius.round,
    border: `1px solid ${colors.successBorder}`,
  },
  driveDot: {
    width: 6, height: 6, borderRadius: '50%',
    background: colors.success, display: 'inline-block',
  },
  logoutBtn: {
    width: 32, height: 32, borderRadius: '50%', border: `1px solid ${colors.borderLight}`,
    background: 'transparent', cursor: 'pointer', padding: 0,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  },
  logoutOverlay: {
    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    zIndex: 200, fontFamily: font.family,
  },
  logoutDialog: {
    background: colors.bgCard, borderRadius: radius.lg, padding: '24px',
    width: 280, textAlign: 'center',
    border: `1px solid ${colors.borderLight}`,
  },
  logoutText: {
    fontSize: font.lg, fontWeight: 600, color: colors.textWhite, margin: '0 0 4px',
  },
  logoutSubtext: {
    fontSize: font.sm, color: colors.textDim, margin: '0 0 20px',
  },
  logoutActions: {
    display: 'flex', gap: 10,
  },
  logoutCancel: {
    flex: 1, padding: '10px', borderRadius: radius.md,
    border: `1px solid ${colors.borderLight}`, background: 'transparent',
    color: colors.text, fontSize: font.base, cursor: 'pointer', fontFamily: font.family,
  },
  logoutConfirm: {
    flex: 1, padding: '10px', borderRadius: radius.md,
    border: 'none', background: colors.error, color: 'white',
    fontSize: font.base, fontWeight: 600, cursor: 'pointer', fontFamily: font.family,
  },
  section: { padding: `${spacing.lg}px ${spacing.xl}px` },
  label: {
    fontSize: font.xs, fontWeight: 600, color: colors.textDim,
    letterSpacing: '0.08em', marginBottom: 0, display: 'block',
  },
  cameraSection: {
    display: 'flex', flexDirection: 'column', alignItems: 'center',
    padding: `${spacing.xxl}px ${spacing.xl}px ${spacing.lg}px`, gap: spacing.sm + 2,
  },
  cameraBtn: {
    width: 96, height: 96, borderRadius: '50%',
    border: `3px solid ${colors.accent}`, background: colors.accentLight,
    cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
    boxShadow: `0 0 30px ${colors.accentGlow}`,
  },
  cameraBtnOff: {
    border: `3px solid ${colors.borderLight}`,
    background: 'rgba(55,65,81,0.2)', boxShadow: 'none', opacity: 0.5,
  },
  cameraLabel: { fontSize: font.base, color: colors.textMuted, textAlign: 'center', margin: 0 },
  cameraDest: {
    fontSize: font.sm, color: colors.textDim, background: colors.bgInput,
    padding: '5px 12px', borderRadius: radius.sm, margin: 0,
  },
  // Gallery section
  gallerySection: {
    padding: `${spacing.lg}px 0`,
    borderTop: `1px solid ${colors.border}`,
  },
  gallerySectionHeader: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    padding: `0 ${spacing.xl}px ${spacing.sm}px`,
  },
  photoCount: { fontSize: font.sm, color: colors.textDim },
  refreshBtn: {
    background: 'transparent', border: `1px solid ${colors.borderLight}`,
    color: colors.textMuted, borderRadius: '50%',
    width: 28, height: 28, fontSize: 16, cursor: 'pointer',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    lineHeight: 1,
  },
  galleryLoading: {
    display: 'flex', justifyContent: 'center', padding: spacing.xxl,
  },
  spinner: {
    width: 28, height: 28, border: '3px solid rgba(255,255,255,0.15)',
    borderTopColor: colors.accent, borderRadius: '50%',
    animation: 'spin 0.8s linear infinite',
  },
  galleryEmpty: {
    padding: `${spacing.lg}px ${spacing.xl}px`,
    color: colors.textDim, fontSize: font.base, textAlign: 'center',
  },
  dateHeader: {
    fontSize: font.sm, fontWeight: 600, color: colors.textMuted,
    padding: `${spacing.sm}px ${spacing.xl}px`,
    textTransform: 'capitalize',
  },
  grid: {
    display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 2,
    padding: '0 2px',
  },
  gridItem: {
    aspectRatio: '1', overflow: 'hidden', cursor: 'pointer',
    background: colors.bgCard,
  },
  gridImg: {
    width: '100%', height: '100%', objectFit: 'cover', display: 'block',
  },
  // Viewer overlay
  viewer: {
    position: 'fixed', inset: 0, background: '#000',
    zIndex: 100, display: 'flex', flexDirection: 'column',
    fontFamily: font.family, overscrollBehavior: 'contain',
  },
  viewerHeader: {
    display: 'flex', alignItems: 'center',
    padding: '10px 8px 8px',
    paddingTop: 'max(10px, env(safe-area-inset-top, 0px))',
    flexShrink: 0, background: 'rgba(0,0,0,0.6)',
    backdropFilter: 'blur(12px)',
  },
  viewerBack: {
    width: 36, height: 36, borderRadius: '50%',
    background: colors.bg, border: 'none', color: colors.accent,
    fontSize: 24, cursor: 'pointer',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    flexShrink: 0,
  },
  viewerHeaderCenter: {
    flex: 1, display: 'flex', flexDirection: 'column',
    alignItems: 'center', gap: 1,
  },
  viewerTitle: {
    fontSize: font.sm, fontWeight: 600, color: 'white',
    textTransform: 'capitalize',
  },
  viewerSubtitle: {
    fontSize: font.xs, color: colors.textMuted,
  },
  viewerBody: {
    flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
    overflow: 'hidden', touchAction: 'pan-x',
  },
  viewerImg: {
    maxWidth: '100%', maxHeight: '100%', objectFit: 'contain',
    userSelect: 'none', pointerEvents: 'none',
  },
  thumbStrip: {
    display: 'flex', flexDirection: 'row', gap: 3,
    overflowX: 'auto', overflowY: 'hidden',
    padding: '8px 8px 4px',
    flexShrink: 0, scrollbarWidth: 'none',
    background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(12px)',
  },
  thumbItem: {
    width: 56, height: 56, flexShrink: 0,
    borderRadius: 6, overflow: 'hidden', cursor: 'pointer',
    border: '2px solid transparent', boxSizing: 'border-box',
    opacity: 0.6,
  },
  thumbItemActive: {
    border: `2px solid white`, opacity: 1,
  },
  thumbItemImg: {
    width: '100%', height: '100%', objectFit: 'cover', display: 'block',
  },
  actionBtn: {
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    width: 56, height: 56, borderRadius: 20, background: 'rgba(255,255,255,0.06)',
    border: 'none', cursor: 'pointer', overflow: 'hidden', padding: 0,
  },
  actionIcon: { width: 56, height: 56, objectFit: 'cover', opacity: 0.8, display: 'block' },
  viewerFooter: {
    display: 'flex', justifyContent: 'space-around', alignItems: 'center',
    padding: '12px 0',
    paddingBottom: 'max(12px, env(safe-area-inset-bottom, 0px))',
    flexShrink: 0, background: '#131618',
  },
  deleteOverlay: {
    position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.7)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    zIndex: 10,
  },
  // Info panel
  infoOverlay: {
    position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.5)',
    display: 'flex', alignItems: 'flex-end', zIndex: 20,
  },
  infoSheet: {
    width: '100%', background: colors.bgCard,
    borderRadius: '16px 16px 0 0',
    padding: '12px 16px 32px',
    maxHeight: '75vh', overflowY: 'auto',
    display: 'flex', flexDirection: 'column', gap: 12,
    fontFamily: font.family,
  },
  infoHandle: {
    width: 36, height: 4, borderRadius: 2,
    background: colors.borderLight, alignSelf: 'center', marginBottom: 4,
  },
  infoDate: {
    fontSize: font.base, fontWeight: 600, color: colors.textWhite,
    margin: 0, textTransform: 'capitalize',
  },
  infoFilename: {
    fontSize: font.sm, color: colors.textDim, margin: 0,
    wordBreak: 'break-all',
  },
  infoCard: {
    background: colors.bgInput, borderRadius: radius.lg,
    overflow: 'hidden',
  },
  infoRow: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    padding: '10px 14px',
  },
  infoRowBorder: {
    borderBottom: `1px solid ${colors.border}`,
  },
  infoLabel: {
    fontSize: font.sm, color: colors.textMuted,
  },
  infoValue: {
    fontSize: font.sm, color: colors.textWhite, fontWeight: 500,
    textAlign: 'right', maxWidth: '60%',
  },
  infoMapCoords: {
    display: 'flex', alignItems: 'center', gap: 8,
    padding: '10px 14px', fontSize: font.sm, color: colors.textMuted,
  },
  infoMapLink: {
    marginLeft: 'auto', fontSize: font.sm, color: colors.accent,
    textDecoration: 'none', fontWeight: 500,
  },
  infoCloseBtn: {
    marginTop: 4, padding: '12px', borderRadius: radius.md,
    background: colors.bgInput, border: 'none',
    color: colors.text, fontSize: font.base,
    cursor: 'pointer', fontFamily: font.family,
  },
};
