import { colors, radius } from '../styles/theme';

const LABELS = { '4:3': '4:3', '16:9': '16:9', '1:1': '1:1', 'full': 'Full' };

export default function AspectPicker({ aspects, selected, onChange }) {
  return (
    <div style={styles.bar}>
      {aspects.map((a) => (
        <button
          key={a}
          onClick={() => onChange(a)}
          style={{ ...styles.pill, ...(selected === a ? styles.pillActive : {}) }}
        >
          {LABELS[a] || a}
        </button>
      ))}
    </div>
  );
}

const styles = {
  bar: {
    position: 'absolute', bottom: 150, left: 0, right: 0,
    display: 'flex', justifyContent: 'center', gap: 6, zIndex: 20,
  },
  pill: {
    padding: '5px 14px', borderRadius: radius.round,
    background: 'rgba(255,255,255,0.12)', border: 'none',
    color: 'rgba(255,255,255,0.7)', fontSize: 12, fontWeight: 500,
    cursor: 'pointer', backdropFilter: 'blur(4px)',
    fontFamily: "'DM Sans', system-ui, sans-serif",
  },
  pillActive: {
    background: 'rgba(249,115,22,0.8)', color: 'white',
  },
};
