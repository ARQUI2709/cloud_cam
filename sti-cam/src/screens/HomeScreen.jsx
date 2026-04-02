import { colors, font, spacing, radius, globalStyles } from '../styles/theme';
import { getProject as getProjectById } from '../config/projects';
import ProjectSelector from '../components/ProjectSelector';
import UploadStatusBar from '../components/UploadStatusBar';

const CamIconSmall = () => (
  <svg width="22" height="22" viewBox="0 0 48 48" fill="none">
    <rect x="4" y="14" width="40" height="28" rx="3" stroke={colors.accent} strokeWidth="2.5" fill="none"/>
    <circle cx="24" cy="28" r="8" stroke={colors.accent} strokeWidth="2.5" fill="none"/>
    <circle cx="24" cy="28" r="3" fill={colors.accent}/>
  </svg>
);

const CamIconLarge = () => (
  <svg width="40" height="40" viewBox="0 0 48 48" fill="none">
    <rect x="4" y="14" width="40" height="28" rx="3" stroke="white" strokeWidth="2.5" fill="none"/>
    <circle cx="24" cy="28" r="8" stroke="white" strokeWidth="2.5" fill="none"/>
    <circle cx="24" cy="28" r="3" fill="white"/>
    <rect x="14" y="8" width="20" height="6" rx="2" stroke="white" strokeWidth="2" fill="none"/>
  </svg>
);

export default function HomeScreen({
  user, selectedProject, onSelectProject,
  queue, sessionCount, onOpenCamera, onOpenGallery,
}) {
  const project = selectedProject ? getProjectById(selectedProject) : null;
  const uploadingCount = queue.filter((q) => q.status === 'uploading').length;
  const doneCount = queue.filter((q) => q.status === 'done').length;

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
          {sessionCount > 0 && (
            <span style={styles.countBadge}>{sessionCount} 📷</span>
          )}
          <div style={styles.driveBadge}>
            <span style={styles.driveDot} />Drive
          </div>
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
            ? '↑ Selecciona un proyecto primero'
            : sessionCount === 0
            ? 'Abrir cámara'
            : 'Continuar captura'}
        </p>
        {project && (
          <p style={styles.cameraDest}>📁 STI-Fotos / {project.name}</p>
        )}
        {selectedProject && (
          <button onClick={onOpenGallery} style={styles.galleryBtn}>
            🖼 Ver fotos
          </button>
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
  section: { padding: `${spacing.lg}px ${spacing.xl}px` },
  label: {
    fontSize: font.xs, fontWeight: 600, color: colors.textDim,
    letterSpacing: '0.08em', marginBottom: spacing.sm, display: 'block',
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
  galleryBtn: {
    padding: '10px 20px', borderRadius: radius.md,
    border: `1px solid ${colors.borderLight}`, background: colors.bgInput,
    color: colors.text, fontSize: font.base, cursor: 'pointer',
    fontFamily: font.family, marginTop: spacing.sm,
  },
};
