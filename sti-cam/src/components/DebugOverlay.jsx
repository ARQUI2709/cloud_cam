import { useEffect, useState } from 'react';
import { logger } from '../infrastructure/Logger';
import { colors, font, radius } from '../styles/theme';

function fmtTime(d) {
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  const ss = String(d.getSeconds()).padStart(2, '0');
  const ms = String(d.getMilliseconds()).padStart(3, '0');
  return `${hh}:${mm}:${ss}.${ms}`;
}

export default function DebugOverlay({ onClose }) {
  const [entries, setEntries] = useState(() => logger.getEntries());
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    return logger.subscribe(() => setEntries(logger.getEntries()));
  }, []);

  const copyAll = async () => {
    const text = entries
      .map((e) => `[${fmtTime(e.ts)}] ${e.level.toUpperCase()} ${e.message}`)
      .join('\n');
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false);
    }
  };

  return (
    <div style={styles.overlay}>
      <style>{safeAreaStyle}</style>
      <div style={styles.header} className="dbg-header">
        <span style={styles.title}>Debug log ({entries.length})</span>
        <button onClick={copyAll} style={styles.btn}>
          {copied ? '✓ Copiado' : 'Copiar'}
        </button>
        <button onClick={() => { logger.clear(); setEntries([]); }} style={styles.btn}>
          Limpiar
        </button>
        <button onClick={onClose} style={styles.btnClose}>✕ Cerrar</button>
      </div>
      <div style={styles.list}>
        {entries.length === 0 ? (
          <p style={styles.empty}>Sin registros aún.</p>
        ) : (
          entries.map((e) => (
            <div key={e.id} style={{ ...styles.line, color: colorFor(e.level) }}>
              <span style={styles.ts}>{fmtTime(e.ts)}</span>
              <span>{e.message}</span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function colorFor(level) {
  if (level === 'error') return colors.error;
  if (level === 'warn') return colors.accent;
  return colors.text;
}

const safeAreaStyle = `
  .dbg-header {
    padding-top: max(10px, env(safe-area-inset-top, 10px)) !important;
    padding-left: max(12px, env(safe-area-inset-left, 12px)) !important;
    padding-right: max(12px, env(safe-area-inset-right, 12px)) !important;
  }
`;

const styles = {
  overlay: {
    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
    background: 'rgba(10,10,12,0.97)', zIndex: 9999,
    display: 'flex', flexDirection: 'column',
    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
  },
  header: {
    display: 'flex', alignItems: 'center', gap: 8,
    padding: '10px 12px', paddingBottom: 10,
    borderBottom: `1px solid ${colors.border}`,
    background: colors.bgCard,
  },
  title: { flex: 1, color: colors.textWhite, fontSize: font.sm, fontWeight: 600 },
  btn: {
    padding: '6px 10px', borderRadius: radius.sm,
    background: colors.bgInput, border: `1px solid ${colors.border}`,
    color: colors.text, fontSize: font.xs, cursor: 'pointer',
  },
  btnClose: {
    padding: '6px 14px', borderRadius: radius.sm,
    background: colors.error, border: 'none',
    color: colors.white, fontSize: font.xs, fontWeight: 700, cursor: 'pointer',
  },
  list: {
    flex: 1, overflowY: 'auto', padding: '8px 12px',
    display: 'flex', flexDirection: 'column', gap: 4,
  },
  line: {
    fontSize: 11, lineHeight: 1.4, wordBreak: 'break-word',
    paddingBottom: 4, borderBottom: `1px dashed ${colors.border}`,
  },
  ts: { color: colors.textDim, marginRight: 6 },
  empty: { color: colors.textMuted, fontSize: font.sm, textAlign: 'center', padding: 24 },
};
