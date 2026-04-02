import { useState } from 'react';

export default function ShutterButton({ onPress, disabled }) {
  const [pressed, setPressed] = useState(false);

  const handleClick = () => {
    if (disabled) return;
    setPressed(true);
    setTimeout(() => setPressed(false), 120);
    onPress();
  };

  return (
    <button onClick={handleClick} disabled={disabled} style={styles.outer}>
      <div style={{
        ...styles.inner,
        transform: pressed ? 'scale(0.88)' : 'scale(1)',
        opacity: disabled ? 0.4 : 1,
      }} />
    </button>
  );
}

const styles = {
  outer: {
    width: 76, height: 76, borderRadius: '50%',
    border: '4px solid white', background: 'transparent',
    cursor: 'pointer', display: 'flex',
    alignItems: 'center', justifyContent: 'center', padding: 0,
  },
  inner: {
    width: 60, height: 60, borderRadius: '50%',
    background: 'white', transition: 'transform 0.1s ease',
  },
};
