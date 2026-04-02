import { useState } from 'react';
import { PROJECTS } from '../config/projects';
import { colors, font, radius } from '../styles/theme';

export default function ProjectSelector({ selected, onSelect }) {
  const [open, setOpen] = useState(false);
  const current = PROJECTS.find((p) => p.id === selected);

  return (
    <div>
      <button onClick={() => setOpen(!open)} style={styles.selector}>
        {current ? (
          <span>{current.icon} {current.name}</span>
        ) : (
          <span style={{ color: colors.textMuted }}>Seleccionar proyecto...</span>
        )}
        <span style={{ transform: open ? 'rotate(180deg)' : 'rotate(0)', transition: 'transform 0.2s' }}>▾</span>
      </button>
      {open && (
        <div style={styles.list}>
          {PROJECTS.map((p) => (
            <button
              key={p.id}
              onClick={() => { onSelect(p.id); setOpen(false); }}
              style={{ ...styles.option, ...(selected === p.id ? styles.optionActive : {}) }}
            >
              <span>{p.icon}</span>
              <span style={{ flex: 1 }}>{p.name}</span>
              {selected === p.id && <span style={{ color: colors.accent, fontWeight: 700 }}>✓</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

const styles = {
  selector: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    width: '100%', padding: '12px 16px', borderRadius: radius.lg,
    border: `1px solid ${colors.borderLight}`, background: colors.bgInput,
    color: colors.textWhite, fontSize: font.lg, cursor: 'pointer', textAlign: 'left',
    fontFamily: font.family,
  },
  list: {
    marginTop: 8, borderRadius: radius.lg, border: `1px solid ${colors.borderLight}`,
    background: colors.bgInput, overflow: 'hidden',
  },
  option: {
    display: 'flex', alignItems: 'center', gap: 10, width: '100%',
    padding: '14px 16px', border: 'none', borderBottom: '1px solid #29303d',
    background: 'transparent', color: colors.text, fontSize: font.base,
    cursor: 'pointer', textAlign: 'left', fontFamily: font.family,
  },
  optionActive: { background: colors.accentLight, color: colors.accent },
};
