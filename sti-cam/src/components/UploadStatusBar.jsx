import { colors, radius } from '../styles/theme';

export default function UploadStatusBar({ queue, uploadingCount, doneCount, offlineCount, onRetry }) {
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
                border: `2px solid ${
                  q.status === 'uploading' ? colors.accent
                  : q.status === 'offline' ? '#f0a030'
                  : colors.success
                }`,
              }}>
                <img src={q.thumb} alt="" style={styles.img} />
              </div>
            ))}
          </div>
          <div style={styles.text}>
            {offlineCount > 0 ? (
              <span style={{ color: '#f0a030', fontSize: 13, fontWeight: 500 }}>
                ⏳ {offlineCount} en cola
              </span>
            ) : (
              <span style={{ color: uploadingCount > 0 ? colors.accent : colors.success, fontSize: 13, fontWeight: 500 }}>
                {uploadingCount > 0 ? `⬆ ${uploadingCount} subiendo...` : '✓ Todo listo'}
              </span>
            )}
            <span style={{ fontSize: 11, color: colors.textDim }}>
              {doneCount}/{queue.length} en Drive
            </span>
          </div>
        </div>
        {offlineCount > 0 && onRetry && (
          <button onClick={onRetry} style={styles.retryBtn}>
            Reintentar
          </button>
        )}
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
  retryBtn: {
    padding: '5px 12px', borderRadius: radius.sm,
    background: '#f0a030', border: 'none',
    color: '#19181e', fontSize: 11, fontWeight: 600, cursor: 'pointer',
    fontFamily: 'inherit', whiteSpace: 'nowrap',
  },
};
