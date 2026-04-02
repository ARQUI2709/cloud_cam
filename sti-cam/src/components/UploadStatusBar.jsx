import { colors, radius } from '../styles/theme';

export default function UploadStatusBar({ queue, uploadingCount, doneCount }) {
  return (
    <div style={styles.wrapper}>
      <div style={styles.bar}>
        <div style={styles.left}>
          <div style={styles.thumbStack}>
            {queue.slice(0, 3).map((q, i) => (
              <div key={q.id} style={{
                ...styles.thumb,
                zIndex: 3 - i,
                marginLeft: i > 0 ? -10 : 0,
                opacity: 1 - i * 0.2,
                border: `2px solid ${q.status === 'uploading' ? colors.accent : colors.success}`,
              }}>
                <img src={q.thumb} alt="" style={styles.img} />
              </div>
            ))}
          </div>
          <div style={styles.text}>
            <span style={{ color: uploadingCount > 0 ? colors.accent : colors.success, fontSize: 13, fontWeight: 500 }}>
              {uploadingCount > 0 ? `⬆ ${uploadingCount} subiendo...` : '✓ Todo listo'}
            </span>
            <span style={{ fontSize: 11, color: colors.textDim }}>
              {doneCount}/{queue.length} en Drive
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

const styles = {
  wrapper: { padding: '0 16px 12px', marginTop: 'auto' },
  bar: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    width: '100%', padding: '10px 14px', borderRadius: radius.xl,
    border: `1px solid ${colors.border}`, background: colors.bgCard,
  },
  left: { display: 'flex', alignItems: 'center', gap: 12 },
  thumbStack: { display: 'flex', alignItems: 'center' },
  thumb: { width: 32, height: 32, borderRadius: 6, overflow: 'hidden', flexShrink: 0 },
  img: { width: '100%', height: '100%', objectFit: 'cover', display: 'block' },
  text: { display: 'flex', flexDirection: 'column', gap: 1 },
};
